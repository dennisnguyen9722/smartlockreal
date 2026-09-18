import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import {
  buildOptionKey,
  buildSku,
  ErrorCode,
  toJsonSafe,
  type JsonObject,
  type Paginated,
  type ProductCreateInput,
  type ProductListQuery,
  type ProductUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';
import { SpecDefinitionService } from './spec-definition.service';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly specs: SpecDefinitionService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProductListQuery): Promise<Paginated<unknown>> {
    const where: Prisma.ProductWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
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
        },
      }),
      this.db.product.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getById(id: string) {
    const product = await this.db.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        installationClass: { select: { id: true, code: true, name: true } },
        options: { include: { values: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
        variants: {
          orderBy: { sortOrder: 'asc' },
          include: { optionValues: { include: { optionValue: true } } },
        },
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return product;
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
    const before = await this.db.product.findUnique({ where: { id } });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const categoryId = input.categoryId ?? before.categoryId;
    let specs: JsonObject | undefined;

    // Đổi danh mục thì phải kiểm tra lại thông số theo khuôn mới
    if (input.specs !== undefined || input.categoryId !== undefined) {
      const raw = input.specs ?? (before.specs as Record<string, unknown>);
      const validation = await this.specs.validate(categoryId, raw);
      if (!validation.valid) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, validation.errors);
      }
      specs = toJsonSafe(validation.value) as JsonObject;
    }

    // Đăng bán lần đầu thì ghi lại thời điểm
    const publishedAt =
      input.status === 'ACTIVE' && !before.publishedAt ? new Date() : undefined;

    try {
      await this.db.product.update({
        where: { id },
        data: { ...input, specs, publishedAt },
      });

      await this.audit.log({
        staffId,
        action: 'product.update',
        entityType: 'PRODUCT',
        entityId: id,
        changes: {
          before: { name: before.name, status: before.status, categoryId: before.categoryId },
          after: input,
        },
        ctx,
      });
      return this.getById(id);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  /** Sản phẩm không bị xóa, chỉ chuyển sang lưu trữ để giữ lịch sử đơn hàng */
  async archive(id: string, staffId: string, ctx: AuditContext) {
    const product = await this.db.product.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    await this.db.$transaction([
      this.db.product.update({ where: { id }, data: { status: 'ARCHIVED' } }),
      this.db.productVariant.updateMany({ where: { productId: id }, data: { isActive: false } }),
    ]);

    await this.audit.log({
      staffId,
      action: 'product.archive',
      entityType: 'PRODUCT',
      entityId: id,
      changes: { before: { status: product.status } },
      ctx,
    });
    return this.getById(id);
  }
}
