import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
import {
  buildOptionKey,
  buildSku,
  ErrorCode,
  type VariantCreateInput,
  type VariantUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';

@Injectable()
export class VariantService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async create(productId: string, input: VariantCreateInput, staffId: string, ctx: AuditContext) {
    const product = await this.db.product.findUnique({
      where: { id: productId },
      include: { options: { include: { values: true } } },
    });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const chosen = input.optionValues ?? {};
    const errors: { field: string; message: string }[] = [];

    // Phải chọn đúng một giá trị cho mọi tùy chọn của sản phẩm
    for (const option of product.options) {
      const picked = chosen[option.code];
      if (!picked) {
        errors.push({ field: `optionValues.${option.code}`, message: `Chưa chọn ${option.name}` });
      } else if (!option.values.some((value) => value.code === picked)) {
        errors.push({
          field: `optionValues.${option.code}`,
          message: `Giá trị "${picked}" không có trong ${option.name}`,
        });
      }
    }
    for (const code of Object.keys(chosen)) {
      if (!product.options.some((option) => option.code === code)) {
        errors.push({ field: `optionValues.${code}`, message: 'Tùy chọn không thuộc sản phẩm này' });
      }
    }
    if (errors.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, errors);
    }

    const optionKey = buildOptionKey(chosen);
    const sku = input.sku ?? buildSku(product.slug, chosen);

    // Tìm id của các giá trị tùy chọn đã chọn
    const optionValueIds = product.options
      .flatMap((option) => option.values)
      .filter((value) =>
        product.options.some(
          (option) => option.id === value.optionId && chosen[option.code] === value.code,
        ),
      )
      .map((value) => value.id);

    try {
      const variant = await this.db.productVariant.create({
        data: {
          productId,
          sku,
          name: input.name,
          optionKey,
          price: BigInt(input.price),
          compareAtPrice: input.compareAtPrice != null ? BigInt(input.compareAtPrice) : null,
          barcode: input.barcode,
          weightGrams: input.weightGrams,
          trackSerial: input.trackSerial ?? product.type === 'LOCK',
          vatRateBps: input.vatRateBps ?? 1000,
          sortOrder: input.sortOrder ?? 0,
          optionValues: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) },
        },
      });

      await this.audit.log({
        staffId,
        action: 'variant.create',
        entityType: 'PRODUCT_VARIANT',
        entityId: variant.id,
        changes: { after: { productId, sku, name: input.name, price: input.price } },
        ctx,
      });
      return variant;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(id: string, input: VariantUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.db.productVariant.findUnique({ where: { id } });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    if (input.sku && input.sku !== before.sku) {
      const usage = await this.countUsage(id);
      if (usage.total > 0) {
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          ...usage,
          hint: 'SKU đã xuất hiện trong chứng từ, không đổi được',
        });
      }
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

      await this.audit.log({
        staffId,
        action: input.price != null && input.price !== Number(before.price) ? 'variant.price_change' : 'variant.update',
        entityType: 'PRODUCT_VARIANT',
        entityId: id,
        changes: {
          before: { sku: before.sku, price: before.price, isActive: before.isActive },
          after: input,
        },
        ctx,
      });
      return variant;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const variant = await this.db.productVariant.findUnique({ where: { id } });
    if (!variant) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const usage = await this.countUsage(id);
    if (usage.total > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        ...usage,
        hint: 'Hãy tắt hoạt động thay vì xóa',
      });
    }

    try {
      await this.db.productVariant.delete({ where: { id } });
      await this.audit.log({
        staffId,
        action: 'variant.delete',
        entityType: 'PRODUCT_VARIANT',
        entityId: id,
        changes: { before: { sku: variant.sku, name: variant.name } },
        ctx,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  /** Đếm các nơi đang tham chiếu tới biến thể, để quyết định cho xóa hay không */
  private async countUsage(variantId: string) {
    const [orderLines, stockLevels, serials, receiptLines, bundleItems] = await Promise.all([
      this.db.orderLine.count({ where: { variantId } }),
      this.db.stockLevel.count({ where: { variantId, OR: [{ onHand: { gt: 0 } }, { reserved: { gt: 0 } }] } }),
      this.db.serialUnit.count({ where: { variantId } }),
      this.db.goodsReceiptLine.count({ where: { variantId } }),
      this.db.bundleItem.count({ where: { componentVariantId: variantId } }),
    ]);

    return {
      orderLines,
      stockLevels,
      serials,
      receiptLines,
      bundleItems,
      total: orderLines + stockLevels + serials + receiptLines + bundleItems,
    };
  }
}
