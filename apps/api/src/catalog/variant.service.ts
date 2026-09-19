import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import {
  buildOptionKey,
  buildSku,
  ErrorCode,
  type VariantCreateInput,
  type VariantQuickCreateInput,
  type VariantUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';
import { MAX_OPTIONS_PER_PRODUCT, ProductOptionService, sameLabel } from './product-option.service';
import { summarizeUsage, VARIANT_USAGE_COUNT } from './variant-usage';

type FieldError = { field: string; message: string };
type Tx = Prisma.TransactionClient;

function invalid(errors: FieldError[]): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, errors);
}

/** Lỗi nghiệp vụ giữ nguyên; lỗi Prisma dịch sang lỗi chuẩn */
function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
  throw error;
}

@Injectable()
export class VariantService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly options: ProductOptionService,
  ) {}

  /** Thêm một biến thể theo mã tùy chọn */
  async create(productId: string, input: VariantCreateInput, staffId: string, ctx: AuditContext) {
    const created = await this.createMany(productId, [input], staffId, ctx);
    return created[0];
  }

  /** Thêm nhiều biến thể trong MỘT transaction: tạo đủ hoặc không tạo gì */
  async createMany(
    productId: string,
    inputs: VariantCreateInput[],
    staffId: string,
    ctx: AuditContext,
  ) {
    try {
      const created = await this.db.$transaction((tx) => this.createInTx(tx, productId, inputs));
      await this.logCreated(created, productId, staffId, ctx);
      return created;
    } catch (error) {
      rethrow(error);
    }
  }

  /**
   * Thêm biến thể theo NHÃN: "Màu sắc: Rose Gold, App: TTLock".
   * Thuộc tính hoặc giá trị chưa có thì tự tạo; thuộc tính mới thì các biến thể đang có
   * được gán vào giá trị trong existingValues. Tất cả trong một transaction.
   */
  async quickCreate(
    productId: string,
    input: VariantQuickCreateInput,
    staffId: string,
    ctx: AuditContext,
  ) {
    try {
      const created = await this.db.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            _count: { select: { variants: true } },
          },
        });
        if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

        // Biến thể mới phải có giá trị cho MỌI thuộc tính đang có
        const missing = product.options.filter(
          (option) => !input.attributes.some((attribute) => sameLabel(attribute.name, option.name)),
        );
        if (missing.length > 0) {
          invalid(missing.map((option) => ({ field: 'attributes', message: `Chưa nhập ${option.name}` })));
        }

        const newAttributes = input.attributes.filter(
          (attribute) => !product.options.some((option) => sameLabel(option.name, attribute.name)),
        );
        if (product.options.length + newAttributes.length > MAX_OPTIONS_PER_PRODUCT) {
          invalid([
            { field: 'attributes', message: `Mỗi sản phẩm tối đa ${MAX_OPTIONS_PER_PRODUCT} thuộc tính` },
          ]);
        }

        // Thuộc tính mới: tạo trục, gán các biến thể đang có vào giá trị đã khai báo
        for (const attribute of newAttributes) {
          const existingKey = Object.keys(input.existingValues).find((key) =>
            sameLabel(key, attribute.name),
          );
          const existingValue = existingKey ? input.existingValues[existingKey] : undefined;
          if (product._count.variants > 0 && !existingValue) {
            invalid([
              {
                field: `existingValues.${attribute.name}`,
                message: `Các biến thể đang có thuộc ${attribute.name} nào?`,
              },
            ]);
          }
          const defaultValue = existingValue ?? attribute.value;
          const values = sameLabel(defaultValue, attribute.value)
            ? [attribute.value]
            : [defaultValue, attribute.value];
          await this.options.addAxisInTx(tx, productId, {
            name: attribute.name,
            values,
            defaultValue,
          });
        }

        // Đọc lại thuộc tính (đã gồm trục mới), lấy hoặc tạo giá trị theo nhãn
        const options = await tx.productOption.findMany({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
          include: { values: true },
        });
        const chosen: Record<string, string> = {};
        const labels: string[] = [];
        for (const option of options) {
          const attribute = input.attributes.find((item) => sameLabel(item.name, option.name));
          if (!attribute) {
            invalid([{ field: 'attributes', message: `Chưa nhập ${option.name}` }]);
          }
          const value = await this.options.ensureValueInTx(tx, option, attribute.value);
          chosen[option.code] = value.code;
          labels.push(value.value);
        }

        return this.createInTx(tx, productId, [
          {
            name: input.name?.trim() || labels.join(' / '),
            sku: input.sku,
            price: input.price,
            compareAtPrice: input.compareAtPrice,
            trackSerial: input.trackSerial,
            optionValues: chosen,
          },
        ]);
      });

      await this.logCreated(created, productId, staffId, ctx);
      return created[0];
    } catch (error) {
      rethrow(error);
    }
  }

  /**
   * Lõi tạo biến thể, chạy bên trong transaction của nơi gọi.
   * Lỗi trả về theo đường dẫn variants.<vị trí>.<trường> khi tạo nhiều, để giao diện báo đúng dòng.
   */
  private async createInTx(tx: Tx, productId: string, inputs: VariantCreateInput[]) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        options: { include: { values: true } },
        variants: { select: { optionKey: true } },
      },
    });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    if (product.status === 'ARCHIVED') {
      invalid([{ field: 'productId', message: 'Sản phẩm đang lưu trữ, hãy chuyển về Nháp trước' }]);
    }
    if (product.options.length === 0 && product.variants.length + inputs.length > 1) {
      invalid([
        {
          field: 'variants',
          message: 'Sản phẩm chưa có thuộc tính thì chỉ được một biến thể. Hãy thêm thuộc tính (vd: Màu sắc).',
        },
      ]);
    }

    const single = inputs.length === 1;
    const errors: FieldError[] = [];
    const existingKeys = new Set(product.variants.map((variant) => variant.optionKey));
    const batchKeys = new Set<string>();
    const batchSkus = new Set<string>();

    const prepared = inputs.map((input, index) => {
      const at = (field: string) => (single ? field : `variants.${index}.${field}`);
      const chosen = input.optionValues ?? {};

      for (const option of product.options) {
        const picked = chosen[option.code];
        if (!picked) {
          errors.push({ field: at(`optionValues.${option.code}`), message: `Chưa chọn ${option.name}` });
        } else if (!option.values.some((value) => value.code === picked)) {
          errors.push({
            field: at(`optionValues.${option.code}`),
            message: `Giá trị "${picked}" không có trong ${option.name}`,
          });
        }
      }
      for (const code of Object.keys(chosen)) {
        if (!product.options.some((option) => option.code === code)) {
          errors.push({ field: at(`optionValues.${code}`), message: 'Thuộc tính không thuộc sản phẩm này' });
        }
      }
      if (input.compareAtPrice != null && input.compareAtPrice <= input.price) {
        errors.push({ field: at('compareAtPrice'), message: 'Giá gạch ngang phải lớn hơn giá bán' });
      }

      const optionKey = buildOptionKey(chosen);
      const sku = input.sku ?? buildSku(product.slug, chosen);

      if (existingKeys.has(optionKey) || batchKeys.has(optionKey)) {
        errors.push({ field: at('optionValues'), message: 'Đã có biến thể với các thuộc tính này' });
      }
      if (batchSkus.has(sku)) {
        errors.push({ field: at('sku'), message: `SKU ${sku} bị trùng trong danh sách` });
      }
      batchKeys.add(optionKey);
      batchSkus.add(sku);

      const optionValueIds = product.options.flatMap((option) =>
        option.values.filter((value) => chosen[option.code] === value.code).map((value) => value.id),
      );

      return { input, optionKey, sku, optionValueIds, index };
    });

    // SKU là duy nhất toàn hệ thống: báo trước cho dễ hiểu thay vì để database chặn
    const taken = await tx.productVariant.findMany({
      where: { sku: { in: [...batchSkus] } },
      select: { sku: true },
    });
    const takenSkus = new Set(taken.map((item) => item.sku));
    for (const item of prepared) {
      if (takenSkus.has(item.sku)) {
        errors.push({
          field: single ? 'sku' : `variants.${item.index}.sku`,
          message: `SKU ${item.sku} đã được dùng`,
        });
      }
    }

    if (errors.length > 0) invalid(errors);

    const created = [];
    for (const item of prepared) {
      created.push(
        await tx.productVariant.create({
          data: {
            productId,
            sku: item.sku,
            name: item.input.name,
            optionKey: item.optionKey,
            price: BigInt(item.input.price),
            compareAtPrice:
              item.input.compareAtPrice != null ? BigInt(item.input.compareAtPrice) : null,
            barcode: item.input.barcode,
            weightGrams: item.input.weightGrams,
            trackSerial: item.input.trackSerial ?? product.type === 'LOCK',
            vatRateBps: item.input.vatRateBps ?? 1000,
            // Mặc định xếp cuối danh sách
            sortOrder: item.input.sortOrder ?? product.variants.length + item.index,
            optionValues: {
              create: item.optionValueIds.map((optionValueId) => ({ optionValueId })),
            },
          },
        }),
      );
    }
    return created;
  }

  private async logCreated(
    created: { id: string; sku: string; name: string; price: bigint }[],
    productId: string,
    staffId: string,
    ctx: AuditContext,
  ) {
    for (const variant of created) {
      await this.audit.log({
        staffId,
        action: 'variant.create',
        entityType: 'PRODUCT_VARIANT',
        entityId: variant.id,
        changes: { after: { productId, sku: variant.sku, name: variant.name, price: variant.price } },
        ctx,
      });
    }
  }

  async update(id: string, input: VariantUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.db.productVariant.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, status: true } },
        _count: { select: VARIANT_USAGE_COUNT },
      },
    });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const usage = summarizeUsage(before._count);

    // SKU in trên chứng từ; trackSerial quyết định cách đếm tồn kho.
    // Đã có chứng từ hoặc tồn kho thì đổi một trong hai sẽ làm lệch dữ liệu.
    const lockedFields: string[] = [];
    if (input.sku !== undefined && input.sku !== before.sku) lockedFields.push('sku');
    if (input.trackSerial !== undefined && input.trackSerial !== before.trackSerial) {
      lockedFields.push('trackSerial');
    }
    if (lockedFields.length > 0 && usage.locked) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        fields: lockedFields,
        usage,
        hint: 'Biến thể đã có chứng từ hoặc tồn kho nên không đổi được SKU và cách quản lý serial',
      });
    }

    // Chỉ kiểm tra giá gạch ngang khi người dùng đang sửa giá
    if (input.price !== undefined || input.compareAtPrice !== undefined) {
      const price = input.price ?? Number(before.price);
      const compareAt =
        input.compareAtPrice !== undefined
          ? input.compareAtPrice
          : before.compareAtPrice == null
            ? null
            : Number(before.compareAtPrice);
      if (compareAt != null && compareAt <= price) {
        invalid([{ field: 'compareAtPrice', message: 'Giá gạch ngang phải lớn hơn giá bán' }]);
      }
    }

    if (input.isActive === true && !before.isActive && before.product.status === 'ARCHIVED') {
      invalid([{ field: 'isActive', message: 'Sản phẩm đang lưu trữ, hãy chuyển về Nháp trước' }]);
    }
    if (input.isActive === false && before.isActive) {
      await this.assertNotLastActive(before.productId, id, before.product.status, 'tắt');
    }

    try {
      const variant = await this.db.productVariant.update({
        where: { id },
        data: {
          ...input,
          price: input.price != null ? BigInt(input.price) : undefined,
          compareAtPrice:
            input.compareAtPrice === undefined
              ? undefined
              : input.compareAtPrice === null
                ? null
                : BigInt(input.compareAtPrice),
        },
      });

      const priceChanged = input.price != null && BigInt(input.price) !== before.price;
      await this.audit.log({
        staffId,
        action: priceChanged ? 'variant.price_change' : 'variant.update',
        entityType: 'PRODUCT_VARIANT',
        entityId: id,
        changes: {
          before: {
            sku: before.sku,
            price: before.price,
            compareAtPrice: before.compareAtPrice,
            isActive: before.isActive,
          },
          after: input,
        },
        ctx,
      });
      return variant;
    } catch (error) {
      rethrow(error);
    }
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const variant = await this.db.productVariant.findUnique({
      where: { id },
      include: {
        product: { select: { status: true } },
        _count: { select: VARIANT_USAGE_COUNT },
      },
    });
    if (!variant) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const usage = summarizeUsage(variant._count);
    if (!usage.deletable) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        usage,
        hint: 'Hãy tắt hoạt động thay vì xóa',
      });
    }

    const siblings = await this.db.productVariant.count({
      where: { productId: variant.productId, id: { not: id } },
    });
    if (siblings === 0) {
      invalid([{ field: 'variants', message: 'Sản phẩm phải còn ít nhất một biến thể' }]);
    }
    if (variant.isActive) {
      await this.assertNotLastActive(variant.productId, id, variant.product.status, 'xóa');
    }

    try {
      await this.db.productVariant.delete({ where: { id } });
    } catch (error) {
      // Có người vừa tạo chứng từ cho biến thể này giữa lúc kiểm tra và lúc xóa
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          hint: 'Hãy tắt hoạt động thay vì xóa',
        });
      }
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'variant.delete',
      entityType: 'PRODUCT_VARIANT',
      entityId: id,
      changes: { before: { sku: variant.sku, name: variant.name, price: variant.price } },
      ctx,
    });
  }

  /** Sản phẩm đang bán phải còn ít nhất một biến thể đang bật */
  private async assertNotLastActive(
    productId: string,
    variantId: string,
    productStatus: string,
    verb: string,
  ) {
    if (productStatus !== 'ACTIVE') return;
    const others = await this.db.productVariant.count({
      where: { productId, isActive: true, id: { not: variantId } },
    });
    if (others === 0) {
      invalid([
        {
          field: 'isActive',
          message: `Đây là biến thể cuối cùng đang bán. Hãy chuyển sản phẩm về Nháp trước khi ${verb}.`,
        },
      ]);
    }
  }
}