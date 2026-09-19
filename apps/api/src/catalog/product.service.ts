import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import {
  buildOptionKey,
  buildSku,
  ErrorCode,
  productPath,
  toJsonSafe,
  type JsonObject,
  type Paginated,
  type ProductCreateInput,
  type ProductBulkDeleteResult,
  type ProductDeleteBlock,
  type ProductListQuery,
  type ProductStatusChangeInput,
  type ProductStatusCounts,
  type ProductStatusValue,
  type ProductUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';
import { SpecDefinitionService } from './spec-definition.service';
import { summarizeUsage, VARIANT_USAGE_COUNT } from './variant-usage';

/**
 * Chuyển trạng thái hợp lệ.
 * ARCHIVED không lên thẳng ACTIVE: lúc lưu trữ đã tắt mọi biến thể,
 * nên phải về Nháp, bật lại biến thể cần bán, rồi mới đăng bán.
 */
const ALLOWED_TRANSITIONS: Record<ProductStatusValue, readonly ProductStatusValue[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

const DETAIL_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true, isActive: true } },
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  installationClass: { select: { id: true, code: true, name: true } },
  options: {
    include: { values: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  },
  variants: {
    orderBy: { sortOrder: 'asc' },
    include: {
      optionValues: { include: { optionValue: true } },
      _count: { select: { ...VARIANT_USAGE_COUNT, bundleItems: true } },
    },
  },
  media: {
    orderBy: { sortOrder: 'asc' },
    include: { variant: { select: { id: true, sku: true, name: true } } },
  },
  // voucher_targets là Cascade: xóa sản phẩm sẽ âm thầm làm voucher mất điều kiện
  _count: { select: { voucherTargets: true } },
} satisfies Prisma.ProductInclude;

type ProductDetailRow = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export interface ReadinessIssue {
  field: string;
  message: string;
}

/** Lỗi P2025: không có bản ghi khớp điều kiện where (ở đây là updatedAt đã đổi) */
function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function editConflict(): never {
  throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
}

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly specs: SpecDefinitionService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProductListQuery): Promise<Paginated<unknown> & { statusCounts: ProductStatusCounts }> {
    // Mọi bộ lọc trừ trạng thái: dùng chung cho danh sách và số đếm từng tab trạng thái
    const baseWhere: Prisma.ProductWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { manufacturerCode: { contains: query.search, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: query.search.toUpperCase() } } } },
            ],
          }
        : {}),
    };

    // Bỏ trống: ẩn lưu trữ (an toàn cho ô chọn sản phẩm khi tạo đơn, báo giá). ALL: lấy hết.
    const statusWhere: Prisma.ProductWhereInput =
      query.status === 'ALL'
        ? {}
        : query.status
          ? { status: query.status }
          : { status: { not: 'ARCHIVED' } };
    const where: Prisma.ProductWhereInput = { ...baseWhere, ...statusWhere };

    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          variants: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, sku: true, name: true, price: true, isActive: true },
          },
          // Ảnh đầu tiên = ảnh đại diện
          media: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        },
      }),
      this.db.product.count({ where }),
    ]);
    // groupBy để riêng: kiểu generic của groupBy hay làm TypeScript suy luận sai khi nằm trong Promise.all
    const grouped = await this.db.product.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    });

    const statusCounts: ProductStatusCounts = { ALL: 0, DRAFT: 0, ACTIVE: 0, ARCHIVED: 0 };
    for (const row of grouped) {
      statusCounts[row.status] = row._count._all;
      statusCounts.ALL += row._count._all;
    }

    return { items, total, page: query.page, pageSize: query.pageSize, statusCounts };
  }

  /**
   * Chi tiết cho trang quản trị. Kèm:
   * - usage của từng biến thể: giao diện khóa ô SKU, ẩn nút xóa từ đầu
   * - readiness: những điều còn thiếu để đăng bán
   */
  async getById(id: string) {
    const product = await this.findDetail(id);
    const readiness = await this.checkReadiness(product);

    return {
      ...product,
      variants: product.variants.map(({ _count, ...variant }) => ({
        ...variant,
        bundleItemCount: _count.bundleItems,
        usage: summarizeUsage(_count),
      })),
      readiness,
      /** null = xóa được; có giá trị = lý do không xóa được */
      deletionBlock: this.deletionBlock(product),
    };
  }

  async create(input: ProductCreateInput, staffId: string, ctx: AuditContext) {
    // Kiểm tra thông số theo khuôn của danh mục (gồm cả kế thừa)
    const validation = await this.specs.validate(input.categoryId, input.specs);
    if (!validation.valid) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, validation.errors);
    }

    const slug =
      input.slug ??
      (await generateUniqueSlug(input.name, async (candidate) =>
        Boolean(await this.db.product.findUnique({ where: { slug: candidate }, select: { id: true } })),
      ));

    // Sinh SKU cho biến thể chưa có, rồi kiểm tra trùng trong chính danh sách
    const variants = input.variants.map((variant) => ({
      ...variant,
      sku: variant.sku ?? buildSku(slug, variant.optionValues ?? {}),
      optionKey: buildOptionKey(variant.optionValues ?? {}),
    }));

    const skus = variants.map((variant) => variant.sku);
    if (new Set(skus).size !== skus.length) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [
        { field: 'variants', message: 'SKU bị trùng trong danh sách biến thể' },
      ]);
    }

    try {
      const product = await this.db.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            type: input.type,
            categoryId: input.categoryId,
            brandId: input.brandId,
            installationClassId: input.installationClassId,
            slug,
            name: input.name,
            manufacturerCode: input.manufacturerCode,
            shortDescription: input.shortDescription,
            description: input.description,
            specs: toJsonSafe(validation.value) as JsonObject,
            highlights: toJsonSafe(input.highlights) as JsonObject[],
            warrantyMonths: input.warrantyMonths ?? 0,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
          },
        });

        // Tùy chọn và giá trị của chúng
        const valueIdByKey = new Map<string, string>();
        for (const [optionIndex, option] of input.options.entries()) {
          const createdOption = await tx.productOption.create({
            data: { productId: created.id, code: option.code, name: option.name, sortOrder: optionIndex },
          });
          for (const [valueIndex, value] of option.values.entries()) {
            const createdValue = await tx.productOptionValue.create({
              data: {
                optionId: createdOption.id,
                code: value.code,
                value: value.value,
                sortOrder: valueIndex,
              },
            });
            valueIdByKey.set(`${option.code}:${value.code}`, createdValue.id);
          }
        }

        // Biến thể và liên kết tới giá trị tùy chọn
        for (const [index, variant] of variants.entries()) {
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: created.id,
              sku: variant.sku,
              name: variant.name,
              optionKey: variant.optionKey,
              price: BigInt(variant.price),
              compareAtPrice: variant.compareAtPrice != null ? BigInt(variant.compareAtPrice) : null,
              barcode: variant.barcode,
              weightGrams: variant.weightGrams,
              // Khóa mặc định quản lý serial, hàng khác thì không
              trackSerial: variant.trackSerial ?? input.type === 'LOCK',
              vatRateBps: variant.vatRateBps ?? 1000,
              sortOrder: variant.sortOrder ?? index,
            },
          });

          for (const [optionCode, valueCode] of Object.entries(variant.optionValues ?? {})) {
            const optionValueId = valueIdByKey.get(`${optionCode}:${valueCode}`);
            if (!optionValueId) continue;
            await tx.variantOptionValue.create({
              data: { variantId: createdVariant.id, optionValueId },
            });
          }
        }

        return created;
      });

      await this.audit.log({
        staffId,
        action: 'product.create',
        entityType: 'PRODUCT',
        entityId: product.id,
        changes: { after: { name: product.name, slug, type: input.type, variants: variants.length } },
        ctx,
      });

      return this.getById(product.id);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(id: string, input: ProductUpdateInput, staffId: string, ctx: AuditContext) {
    const { expectedUpdatedAt, ...changes } = input;

    const before = await this.db.product.findUnique({ where: { id } });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    this.assertNotStale(before.updatedAt, expectedUpdatedAt);

    // Quy tắc theo loại sản phẩm (loại không đổi được sau khi tạo)
    const brandId = changes.brandId === undefined ? before.brandId : changes.brandId;
    const installationClassId =
      changes.installationClassId === undefined
        ? before.installationClassId
        : changes.installationClassId;
    const errors: ReadinessIssue[] = [];
    if (before.type === 'LOCK' && !brandId) {
      errors.push({ field: 'brandId', message: 'Khóa bắt buộc có hãng' });
    }
    if (installationClassId && before.type !== 'LOCK') {
      errors.push({ field: 'installationClassId', message: 'Chỉ khóa mới gán được nhóm lắp đặt' });
    }
    if (errors.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, errors);
    }

    // Đổi danh mục thì phải kiểm tra lại thông số theo khuôn mới
    let specs: JsonObject | undefined;
    if (changes.specs !== undefined || changes.categoryId !== undefined) {
      const raw = changes.specs ?? ((before.specs ?? {}) as Record<string, unknown>);
      const validation = await this.specs.validate(changes.categoryId ?? before.categoryId, raw);
      if (!validation.valid) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, validation.errors);
      }
      specs = toJsonSafe(validation.value) as JsonObject;
    }

    const slugChanged = changes.slug !== undefined && changes.slug !== before.slug;

    try {
      await this.db.$transaction(async (tx) => {
        await tx.product.update({
          // Kèm updatedAt: nếu có người ghi xen giữa lúc đọc và lúc ghi thì không khớp -> P2025
          where: { id, updatedAt: before.updatedAt },
          data: {
            ...changes,
            specs,
            highlights: changes.highlights
              ? (toJsonSafe(changes.highlights) as JsonObject[])
              : undefined,
          },
        });

        // Chỉ cần redirect khi trang đã từng công khai
        if (slugChanged && changes.slug && before.publishedAt) {
          await this.redirectSlug(tx, before.slug, changes.slug, staffId);
        }
      });
    } catch (error) {
      if (isRecordNotFound(error)) editConflict();
      mapPrismaError(error);
    }

    await this.audit.log({
      staffId,
      action: 'product.update',
      entityType: 'PRODUCT',
      entityId: id,
      changes: {
        before: {
          name: before.name,
          slug: before.slug,
          categoryId: before.categoryId,
          brandId: before.brandId,
        },
        after: changes,
      },
      ctx,
    });
    return this.getById(id);
  }

  async changeStatus(
    id: string,
    input: ProductStatusChangeInput,
    staffId: string,
    ctx: AuditContext,
  ) {
    const product = await this.findDetail(id);
    this.assertNotStale(product.updatedAt, input.expectedUpdatedAt);

    const from = product.status;
    const to = input.status;
    if (from === to) return this.getById(id);

    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, {
        from,
        to,
        hint: 'Sản phẩm đã lưu trữ phải chuyển về Nháp, bật lại biến thể rồi mới đăng bán',
      });
    }

    if (to === 'ACTIVE') {
      const issues = await this.checkReadiness(product);
      if (issues.length > 0) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, issues);
      }
    }

    if (to === 'ARCHIVED') {
      // Combo còn bán mà thành phần bị lưu trữ thì combo không giao được
      const bundles = await this.db.bundleItem.findMany({
        where: {
          componentVariant: { productId: id },
          bundleVariant: { product: { status: { not: 'ARCHIVED' } } },
        },
        select: { bundleVariant: { select: { product: { select: { id: true, name: true } } } } },
      });
      if (bundles.length > 0) {
        const unique = new Map(
          bundles.map((item) => [item.bundleVariant.product.id, item.bundleVariant.product]),
        );
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          bundles: [...unique.values()],
          hint: 'Sản phẩm đang là thành phần của combo. Hãy gỡ khỏi combo hoặc lưu trữ combo trước.',
        });
      }
    }

    try {
      await this.db.$transaction(async (tx) => {
        await tx.product.update({
          where: { id, updatedAt: product.updatedAt },
          data: {
            status: to,
            // Đăng bán lần đầu thì ghi lại thời điểm
            ...(to === 'ACTIVE' && !product.publishedAt ? { publishedAt: new Date() } : {}),
          },
        });
        if (to === 'ARCHIVED') {
          await tx.productVariant.updateMany({ where: { productId: id }, data: { isActive: false } });
        }
      });
    } catch (error) {
      if (isRecordNotFound(error)) editConflict();
      mapPrismaError(error);
    }

    await this.audit.log({
      staffId,
      action: 'product.status_change',
      entityType: 'PRODUCT',
      entityId: id,
      changes: { before: { status: from }, after: { status: to } },
      ctx,
    });
    return this.getById(id);
  }

  /** Giữ lại cho nơi đang gọi POST /:id/archive */
  archive(id: string, staffId: string, ctx: AuditContext) {
    return this.changeStatus(id, { status: 'ARCHIVED' }, staffId, ctx);
  }

  /** Xóa hẳn một sản phẩm. Chỉ được khi chưa từng phát sinh giao dịch (xem deletionBlock). */
  async remove(id: string, staffId: string, ctx: AuditContext) {
    const product = await this.findDetail(id);
    const block = this.deletionBlock(product);
    if (block) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, { code: block.code, hint: block.message });
    }
    await this.performDelete(product, staffId, ctx);
  }

  /**
   * Xóa nhiều sản phẩm. Mỗi sản phẩm một transaction riêng: cái không xóa được
   * bị bỏ qua kèm lý do, không ảnh hưởng những cái khác.
   */
  async removeMany(ids: string[], staffId: string, ctx: AuditContext): Promise<ProductBulkDeleteResult> {
    const result: ProductBulkDeleteResult = { deleted: [], skipped: [] };

    for (const id of new Set(ids)) {
      const product = await this.db.product.findUnique({ where: { id }, include: DETAIL_INCLUDE });
      if (!product) {
        result.skipped.push({ id, name: '', code: 'NOT_FOUND', message: 'Không tìm thấy (có thể đã bị xóa)' });
        continue;
      }

      const block = this.deletionBlock(product);
      if (block) {
        result.skipped.push({ id, name: product.name, ...block });
        continue;
      }

      try {
        await this.performDelete(product, staffId, ctx);
        result.deleted.push({ id, name: product.name });
      } catch {
        result.skipped.push({
          id,
          name: product.name,
          code: 'IN_USE',
          message: 'Vừa phát sinh giao dịch trong lúc xóa: chỉ lưu trữ được',
        });
      }
    }
    return result;
  }

  /** Lý do KHÔNG xóa được; null = xóa được */
  private deletionBlock(product: ProductDetailRow): ProductDeleteBlock | null {
    if (product.status === 'ACTIVE') {
      return { code: 'ACTIVE', message: 'Đang bán: hãy tạm ẩn (về Nháp) hoặc lưu trữ trước khi xóa' };
    }
    const used = product.variants.some((variant) => !summarizeUsage(variant._count).deletable);
    if (used) {
      return {
        code: 'IN_USE',
        message: 'Đã có đơn hàng, báo giá, tồn kho hoặc nằm trong khuyến mãi/combo: chỉ lưu trữ được',
      };
    }
    if (product._count.voucherTargets > 0) {
      return { code: 'VOUCHER', message: 'Đang được chọn trong voucher: gỡ khỏi voucher trước khi xóa' };
    }
    return null;
  }

  private async performDelete(product: ProductDetailRow, staffId: string, ctx: AuditContext) {
    try {
      await this.db.$transaction(async (tx) => {
        // Biến thể là Restrict với sản phẩm nên phải xóa trước; bảng con của biến thể tự Cascade
        await tx.productVariant.deleteMany({ where: { productId: product.id } });
        // Redirect đang trỏ về trang sản phẩm này sẽ thành 404: dọn luôn
        await tx.urlRedirect.deleteMany({ where: { toPath: productPath(product.slug) } });
        // Thuộc tính, ảnh gắn, sản phẩm liên quan, FAQ... là Cascade theo sản phẩm
        await tx.product.delete({ where: { id: product.id } });
      });
    } catch (error) {
      // Có người vừa tạo chứng từ cho biến thể giữa lúc kiểm tra và lúc xóa
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          code: 'IN_USE',
          hint: 'Sản phẩm vừa phát sinh giao dịch: chỉ lưu trữ được',
        });
      }
      mapPrismaError(error);
    }

    await this.audit.log({
      staffId,
      action: 'product.delete',
      entityType: 'PRODUCT',
      entityId: product.id,
      // Giữ lại thông tin đủ để tra cứu sau khi sản phẩm đã mất
      changes: {
        before: {
          name: product.name,
          slug: product.slug,
          type: product.type,
          status: product.status,
          skus: product.variants.map((variant) => variant.sku),
        },
      },
      ctx,
    });
  }

  private async findDetail(id: string): Promise<ProductDetailRow> {
    const product = await this.db.product.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return product;
  }

  /** Những điều còn thiếu để đăng bán. Rỗng = đăng bán được. */
  private async checkReadiness(product: ProductDetailRow): Promise<ReadinessIssue[]> {
    const issues: ReadinessIssue[] = [];
    const active = product.variants.filter((variant) => variant.isActive);

    if (active.length === 0) {
      issues.push({ field: 'variants', message: 'Chưa có biến thể nào đang bật' });
    } else if (product.type !== 'SERVICE' && active.some((variant) => variant.price <= 0n)) {
      // Dịch vụ được phép giá 0 (vd: khảo sát miễn phí)
      issues.push({ field: 'variants', message: 'Có biến thể đang bật nhưng chưa có giá' });
    }

    if (product.type === 'BUNDLE' && active.some((variant) => variant._count.bundleItems === 0)) {
      issues.push({ field: 'variants', message: 'Có biến thể combo chưa khai báo thành phần' });
    }

    if (product.type !== 'SERVICE' && product.media.length === 0) {
      issues.push({ field: 'media', message: 'Chưa có ảnh sản phẩm' });
    }

    if (product.brand && !product.brand.isActive) {
      issues.push({ field: 'brandId', message: `Hãng ${product.brand.name} đang tắt hoạt động` });
    }
    if (!product.category.isActive) {
      issues.push({
        field: 'categoryId',
        message: `Danh mục ${product.category.name} đang tắt hoạt động`,
      });
    }

    // Danh mục có thể vừa thêm thông số bắt buộc sau khi sản phẩm được tạo
    const specs = await this.specs.validate(
      product.categoryId,
      (product.specs ?? {}) as Record<string, unknown>,
    );
    issues.push(...specs.errors);

    return issues;
  }

  private assertNotStale(current: Date, expected: string | undefined) {
    if (expected !== undefined && new Date(expected).getTime() !== current.getTime()) {
      throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT, {
        currentUpdatedAt: current.toISOString(),
      });
    }
  }

  /**
   * Link cũ đã chia sẻ (Zalo, Facebook, Google) chuyển 301 sang slug mới.
   * - Redirect đang trỏ vào đường dẫn cũ được trỏ thẳng sang đường dẫn mới (không tạo chuỗi A→B→C)
   * - Redirect nào xuất phát từ đường dẫn mới thì xóa, vì đường dẫn đó nay có trang thật
   *   (tránh vòng lặp khi đổi về slug cũ)
   */
  private async redirectSlug(
    tx: Prisma.TransactionClient,
    oldSlug: string,
    newSlug: string,
    staffId: string,
  ) {
    const fromPath = productPath(oldSlug);
    const toPath = productPath(newSlug);

    await tx.urlRedirect.deleteMany({ where: { fromPath: toPath } });
    await tx.urlRedirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
    await tx.urlRedirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 301, createdById: staffId },
      update: { toPath },
    });
  }
}