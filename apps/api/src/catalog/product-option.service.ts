import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  buildOptionKey,
  ErrorCode,
  slugifyVi,
  type OptionValueCreateInput,
  type OptionValueUpdateInput,
  type ProductOptionAddInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';

export const MAX_OPTIONS_PER_PRODUCT = 3;
const MAX_VALUES_PER_OPTION = 30;
/** Tên biến thể mà trang tạo sản phẩm đặt cho sản phẩm không có tùy chọn */
const DEFAULT_VARIANT_NAME = 'Mặc định';

type Tx = Prisma.TransactionClient;

export function sameLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi');
}

/** Mã của tùy chọn/giá trị, sinh từ nhãn. Không bao giờ đổi sau khi tạo. */
export function toOptionCode(label: string): string {
  return slugifyVi(label).slice(0, 60).replace(/-+$/, '');
}

function invalid(field: string, message: string): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [{ field, message }]);
}

/** Lỗi nghiệp vụ giữ nguyên; lỗi Prisma dịch sang lỗi chuẩn */
function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
  throw error;
}

interface OptionWithValues {
  id: string;
  name: string;
  values: { id: string; code: string; value: string; sortOrder: number }[];
}

/**
 * Tùy chọn (Màu sắc, App...) và giá trị của chúng.
 * MÃ không bao giờ đổi, vì optionKey của biến thể được ghép từ mã.
 */
@Injectable()
export class ProductOptionService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async addOption(productId: string, input: ProductOptionAddInput, staffId: string, ctx: AuditContext) {
    try {
      const result = await this.db.$transaction((tx) => this.addAxisInTx(tx, productId, input));
      await this.audit.log({
        staffId,
        action: 'product_option.add',
        entityType: 'PRODUCT',
        entityId: productId,
        changes: {
          after: {
            option: result.option.code,
            name: result.option.name,
            values: input.values,
            defaultValue: input.defaultValue,
            variantsAssigned: result.variantsAssigned,
            variantsRenamed: result.variantsRenamed,
          },
        },
        ctx,
      });
      return { variantsAssigned: result.variantsAssigned, variantsRenamed: result.variantsRenamed };
    } catch (error) {
      rethrow(error);
    }
  }

  /**
   * Thêm một trục lựa chọn, chạy bên trong transaction của nơi gọi.
   * Mọi biến thể đang có được gán vào defaultValue, nên giữ nguyên SKU, giá, tồn kho, lịch sử
   * (chứng từ gắn theo biến thể, không theo tổ hợp).
   */
  async addAxisInTx(
    tx: Tx,
    productId: string,
    input: { name: string; values: string[]; defaultValue: string },
  ) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        options: { orderBy: { sortOrder: 'asc' }, include: { values: true } },
        variants: {
          include: { optionValues: { include: { optionValue: { include: { option: true } } } } },
        },
      },
    });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    if (product.status === 'ARCHIVED') {
      invalid('name', 'Sản phẩm đang lưu trữ, hãy chuyển về Nháp trước');
    }
    if (product.options.length >= MAX_OPTIONS_PER_PRODUCT) {
      invalid('name', `Mỗi sản phẩm tối đa ${MAX_OPTIONS_PER_PRODUCT} thuộc tính`);
    }

    const code = toOptionCode(input.name);
    if (!code) invalid('name', 'Tên thuộc tính phải có chữ hoặc số');
    if (product.options.some((option) => option.code === code || sameLabel(option.name, input.name))) {
      throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, [
        { field: 'name', message: `Sản phẩm đã có thuộc tính "${input.name}"` },
      ]);
    }

    const values = input.values.map((label, index) => ({
      value: label.trim(),
      code: toOptionCode(label),
      sortOrder: index,
    }));
    if (values.some((value) => !value.code)) invalid('values', 'Mỗi giá trị phải có chữ hoặc số');
    // "Đen" và "Den" khác nhãn nhưng cùng mã
    const codes = values.map((value) => value.code);
    if (new Set(codes).size !== codes.length) invalid('values', 'Có giá trị bị trùng');

    const defaultValue = values.find((value) => sameLabel(value.value, input.defaultValue));
    if (!defaultValue) invalid('defaultValue', 'Giá trị cho biến thể đang có phải nằm trong danh sách');

    const nextOrder = Math.max(-1, ...product.options.map((option) => option.sortOrder)) + 1;

    const option = await tx.productOption.create({
      data: {
        productId,
        code,
        name: input.name.trim(),
        sortOrder: nextOrder,
        values: { create: values },
      },
      include: { values: true },
    });
    const defaultRow = option.values.find((value) => value.code === defaultValue.code);
    if (!defaultRow) throw new Error('Không tìm thấy giá trị mặc định vừa tạo');

    let variantsRenamed = 0;
    for (const variant of product.variants) {
      const chosen: Record<string, string> = {};
      for (const link of variant.optionValues) {
        chosen[link.optionValue.option.code] = link.optionValue.code;
      }

      // Nhãn theo thứ tự thuộc tính, để nhận ra tên do hệ thống tự sinh
      const oldLabels = product.options.map(
        (existing) =>
          variant.optionValues.find((link) => link.optionValue.optionId === existing.id)?.optionValue
            .value ?? '',
      );
      const autoName = oldLabels.length > 0 ? oldLabels.join(' / ') : DEFAULT_VARIANT_NAME;
      const isAutoName = variant.name === autoName || variant.name === DEFAULT_VARIANT_NAME;

      await tx.variantOptionValue.create({
        data: { variantId: variant.id, optionValueId: defaultRow.id },
      });
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          optionKey: buildOptionKey({ ...chosen, [code]: defaultValue.code }),
          // Chỉ đổi tên tự sinh; tên nhân viên tự đặt thì giữ nguyên
          ...(isAutoName ? { name: [...oldLabels, defaultValue.value].join(' / ') } : {}),
        },
      });
      if (isAutoName) variantsRenamed += 1;
    }

    return { option, variantsAssigned: product.variants.length, variantsRenamed };
  }

  /**
   * Lấy giá trị theo nhãn, chưa có thì tạo. Chạy bên trong transaction của nơi gọi.
   * "ttlock" khớp với "TTLock" đã có, tránh tạo hai giá trị cho cùng một thứ.
   */
  async ensureValueInTx(tx: Tx, option: OptionWithValues, label: string) {
    const code = toOptionCode(label);
    const existing =
      option.values.find((value) => sameLabel(value.value, label)) ??
      option.values.find((value) => value.code === code);
    if (existing) return existing;

    if (!code) invalid('attributes', `Giá trị ${option.name} phải có chữ hoặc số`);
    if (option.values.length >= MAX_VALUES_PER_OPTION) {
      invalid('attributes', `${option.name} tối đa ${MAX_VALUES_PER_OPTION} giá trị`);
    }

    const nextOrder = Math.max(-1, ...option.values.map((value) => value.sortOrder)) + 1;
    return tx.productOptionValue.create({
      data: { optionId: option.id, code, value: label.trim(), sortOrder: nextOrder },
    });
  }

  async addValue(
    productId: string,
    optionId: string,
    input: OptionValueCreateInput,
    staffId: string,
    ctx: AuditContext,
  ) {
    const option = await this.db.productOption.findUnique({
      where: { id: optionId },
      include: { values: true, product: { select: { status: true } } },
    });
    if (!option || option.productId !== productId) {
      throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (option.product.status === 'ARCHIVED') {
      invalid('value', 'Sản phẩm đang lưu trữ, hãy chuyển về Nháp trước');
    }
    if (option.values.some((item) => sameLabel(item.value, input.value))) {
      throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, [
        { field: 'value', message: `"${input.value}" đã có trong ${option.name}` },
      ]);
    }

    try {
      const value = await this.db.$transaction((tx) => this.ensureValueInTx(tx, option, input.value));
      await this.audit.log({
        staffId,
        action: 'product_option.value_add',
        entityType: 'PRODUCT',
        entityId: productId,
        changes: { after: { option: option.code, code: value.code, value: value.value } },
        ctx,
      });
      return value;
    } catch (error) {
      rethrow(error);
    }
  }

  async updateValue(valueId: string, input: OptionValueUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.db.productOptionValue.findUnique({
      where: { id: valueId },
      include: { option: { include: { values: true } } },
    });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const duplicate = before.option.values.some(
      (item) => item.id !== valueId && sameLabel(item.value, input.value),
    );
    if (duplicate) {
      throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, [
        { field: 'value', message: `"${input.value}" đã có trong ${before.option.name}` },
      ]);
    }

    const value = await this.db.productOptionValue.update({
      where: { id: valueId },
      // Chỉ đổi nhãn; tên các biến thể đã tạo giữ nguyên, sửa ở thẻ biến thể nếu cần
      data: { value: input.value.trim() },
    });

    await this.audit.log({
      staffId,
      action: 'product_option.value_update',
      entityType: 'PRODUCT',
      entityId: before.option.productId,
      changes: { before: { value: before.value }, after: { value: value.value }, code: before.code },
      ctx,
    });
    return value;
  }

  async removeValue(valueId: string, staffId: string, ctx: AuditContext) {
    const value = await this.db.productOptionValue.findUnique({
      where: { id: valueId },
      include: {
        option: { include: { _count: { select: { values: true } } } },
        _count: { select: { variants: true } },
      },
    });
    if (!value) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    // Liên kết biến thể ↔ giá trị là Cascade: xóa giá trị đang dùng sẽ làm hỏng tổ hợp biến thể
    if (value._count.variants > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        variants: value._count.variants,
        hint: 'Đang có biến thể dùng giá trị này. Hãy xóa các biến thể đó trước (hoặc giữ lại và tắt).',
      });
    }
    if (value.option._count.values <= 1) {
      invalid('value', 'Thuộc tính phải còn ít nhất một giá trị');
    }

    await this.db.productOptionValue.delete({ where: { id: valueId } });
    await this.audit.log({
      staffId,
      action: 'product_option.value_delete',
      entityType: 'PRODUCT',
      entityId: value.option.productId,
      changes: { before: { option: value.option.code, code: value.code, value: value.value } },
      ctx,
    });
  }
}