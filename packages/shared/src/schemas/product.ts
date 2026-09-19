import { z } from 'zod';
import { SlugSchema } from './catalog';
import { HighlightsSchema } from './spec';

export const ProductTypeSchema = z.enum(['LOCK', 'ACCESSORY', 'SERVICE', 'BUNDLE']);
export const ProductStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export type ProductTypeValue = z.infer<typeof ProductTypeSchema>;
export type ProductStatusValue = z.infer<typeof ProductStatusSchema>;

/**
 * Đường dẫn trang sản phẩm trên website. Đặt ở đây để API (tạo redirect khi đổi slug)
 * và storefront (Bước 12) dùng CÙNG một quy tắc.
 */
export const PRODUCT_PATH_PREFIX = '/san-pham';

export function productPath(slug: string): string {
  return `${PRODUCT_PATH_PREFIX}/${slug}`;
}

/**
 * Thời điểm cập nhật mà client đã đọc. API so với giá trị hiện tại để phát hiện
 * người khác đã sửa xen giữa (trả lỗi EDIT_CONFLICT thay vì ghi đè im lặng).
 */
export const ExpectedUpdatedAtSchema = z.iso.datetime({ offset: true });

/** Mã dùng trong tùy chọn và tổ hợp biến thể */
const CodeSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Mã chỉ gồm chữ thường, số và gạch ngang')
  .max(60);

export const SkuSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'SKU chỉ gồm chữ IN HOA, số và gạch ngang')
  .max(64);

/** Một trục lựa chọn: Màu, Phiên bản... */
export const ProductOptionSchema = z.object({
  code: CodeSchema,
  name: z.string().trim().min(1).max(60),
  values: z
    .array(z.object({ code: CodeSchema, value: z.string().trim().min(1).max(60) }))
    .min(1, 'Tùy chọn phải có ít nhất một giá trị')
    .max(30),
});

export const VariantInputSchema = z.object({
  /** Bỏ trống thì hệ thống tự sinh từ slug sản phẩm và mã tùy chọn */
  sku: SkuSchema.optional(),
  name: z.string().trim().min(1).max(200),
  /** VND, chưa VAT */
  price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  barcode: z.string().trim().max(64).optional(),
  weightGrams: z.number().int().positive().nullable().optional(),
  trackSerial: z.boolean().optional(),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  /** Tổ hợp tùy chọn: { mau: 'den', phien-ban: 'wifi' }. Bỏ trống nếu sản phẩm không có tùy chọn. */
  optionValues: z.record(CodeSchema, CodeSchema).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const ProductCreateSchema = z
  .object({
    type: ProductTypeSchema,
    name: z.string().trim().min(1, 'Chưa nhập tên sản phẩm').max(200),
    slug: SlugSchema.optional(),
    categoryId: z.uuid('Chưa chọn danh mục'),
    brandId: z.uuid().optional(),
    installationClassId: z.uuid().optional(),
    manufacturerCode: z.string().trim().max(80).optional(),
    shortDescription: z.string().max(1000).optional(),
    description: z.string().max(50000).optional(),
    warrantyMonths: z.number().int().min(0).max(240).optional(),
    seoTitle: z.string().trim().max(200).optional(),
    seoDescription: z.string().trim().max(320).optional(),
    specs: z.record(z.string(), z.unknown()).default({}),
    highlights: HighlightsSchema.default([]),
    options: z.array(ProductOptionSchema).max(3).default([]),
    variants: z.array(VariantInputSchema).min(1, 'Sản phẩm phải có ít nhất một biến thể').max(100),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'LOCK' && !data.brandId) {
      ctx.addIssue({ code: 'custom', path: ['brandId'], message: 'Khóa bắt buộc có hãng' });
    }
    if (data.installationClassId && data.type !== 'LOCK') {
      ctx.addIssue({
        code: 'custom',
        path: ['installationClassId'],
        message: 'Chỉ khóa mới gán được nhóm lắp đặt',
      });
    }

    const optionCodes = data.options.map((option) => option.code);
    if (new Set(optionCodes).size !== optionCodes.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mã tùy chọn bị trùng' });
    }

    // Không có tùy chọn thì chỉ được một biến thể
    if (optionCodes.length === 0 && data.variants.length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Sản phẩm không có tùy chọn thì chỉ được một biến thể',
      });
    }

    const seenKeys = new Set<string>();
    data.variants.forEach((variant, index) => {
      const chosen = variant.optionValues ?? {};

      // Mỗi biến thể phải chọn đúng một giá trị cho MỌI tùy chọn
      for (const option of data.options) {
        const picked = chosen[option.code];
        if (!picked) {
          ctx.addIssue({
            code: 'custom',
            path: ['variants', index, 'optionValues', option.code],
            message: `Chưa chọn ${option.name}`,
          });
        } else if (!option.values.some((value) => value.code === picked)) {
          ctx.addIssue({
            code: 'custom',
            path: ['variants', index, 'optionValues', option.code],
            message: `Giá trị "${picked}" không có trong ${option.name}`,
          });
        }
      }
      for (const code of Object.keys(chosen)) {
        if (!optionCodes.includes(code)) {
          ctx.addIssue({
            code: 'custom',
            path: ['variants', index, 'optionValues', code],
            message: 'Tùy chọn không được khai báo',
          });
        }
      }

      const key = buildOptionKey(chosen);
      if (seenKeys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index],
          message: 'Hai biến thể trùng tổ hợp tùy chọn',
        });
      }
      seenKeys.add(key);

      if (variant.compareAtPrice != null && variant.compareAtPrice <= variant.price) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index, 'compareAtPrice'],
          message: 'Giá gạch ngang phải lớn hơn giá bán',
        });
      }
    });
  });

/**
 * Sửa thông tin chung. KHÔNG gồm trạng thái: đổi trạng thái có điều kiện riêng,
 * phải đi qua POST /catalog/products/:id/status.
 * Loại sản phẩm (type) không đổi được sau khi tạo.
 */
export const ProductUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: SlugSchema.optional(),
  categoryId: z.uuid().optional(),
  brandId: z.uuid().nullable().optional(),
  installationClassId: z.uuid().nullable().optional(),
  manufacturerCode: z.string().trim().max(80).nullable().optional(),
  shortDescription: z.string().max(1000).nullable().optional(),
  description: z.string().max(50000).nullable().optional(),
  warrantyMonths: z.number().int().min(0).max(240).optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  highlights: HighlightsSchema.optional(),
  expectedUpdatedAt: ExpectedUpdatedAtSchema.optional(),
});

export const ProductStatusChangeSchema = z.object({
  status: ProductStatusSchema,
  expectedUpdatedAt: ExpectedUpdatedAtSchema.optional(),
});

export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  type: ProductTypeSchema.optional(),
  status: ProductStatusSchema.optional(),
  brandId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
export type ProductStatusChangeInput = z.infer<typeof ProductStatusChangeSchema>;
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
export type VariantInput = z.infer<typeof VariantInputSchema>;

/**
 * Tổ hợp tùy chọn dạng chuỗi cố định, vd: "mau:den|phien-ban:wifi".
 * Sắp xếp theo mã để hai biến thể cùng tổ hợp luôn cho cùng chuỗi,
 * nhờ đó ràng buộc duy nhất trong database phát hiện được trùng lặp.
 */
export function buildOptionKey(optionValues: Record<string, string>): string {
  return Object.keys(optionValues)
    .sort()
    .map((code) => `${code}:${optionValues[code]}`)
    .join('|');
}

/** Sinh SKU từ slug sản phẩm và các giá trị tùy chọn */
export function buildSku(productSlug: string, optionValues: Record<string, string>): string {
  const suffix = Object.keys(optionValues)
    .sort()
    .map((code) => optionValues[code])
    .join('-');
  const base = [productSlug, suffix].filter(Boolean).join('-');
  return base.toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').slice(0, 64);
}

/** Thêm biến thể mới vào sản phẩm đã có */
export const VariantCreateSchema = VariantInputSchema;

export const VariantUpdateSchema = z.object({
  sku: SkuSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  weightGrams: z.number().int().positive().nullable().optional(),
  trackSerial: z.boolean().optional(),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export type VariantCreateInput = z.infer<typeof VariantCreateSchema>;
export type VariantUpdateInput = z.infer<typeof VariantUpdateSchema>;

export const ProductMediaAttachSchema = z.object({
  /** ID của ảnh đã tải lên thư viện */
  mediaAssetId: z.uuid('Chưa chọn ảnh'),
  /** Gắn riêng cho một biến thể; bỏ trống = ảnh chung của sản phẩm */
  variantId: z.uuid().nullable().optional(),
  altText: z.string().trim().max(200).optional(),
});

/** Sắp xếp lại thứ tự ảnh; ảnh đầu tiên là ảnh đại diện */
export const ProductMediaReorderSchema = z.object({
  mediaIds: z.array(z.uuid()).min(1).max(50),
});

export type ProductMediaAttachInput = z.infer<typeof ProductMediaAttachSchema>;

/** Thêm giá trị vào trục lựa chọn đã có (vd: thêm màu Bạc). Mã tự sinh từ nhãn. */
export const OptionValueCreateSchema = z.object({
  value: z.string().trim().min(1, 'Chưa nhập giá trị').max(60),
});

/** Chỉ đổi nhãn hiển thị; mã giữ nguyên vì tổ hợp biến thể (optionKey) được ghép từ mã */
export const OptionValueUpdateSchema = OptionValueCreateSchema;

/** Tạo nhiều biến thể trong MỘT transaction: tạo đủ hoặc không tạo gì */
export const VariantBatchCreateSchema = z.object({
  variants: z.array(VariantCreateSchema).min(1, 'Chưa chọn biến thể nào').max(50),
});

export type OptionValueCreateInput = z.infer<typeof OptionValueCreateSchema>;
export type OptionValueUpdateInput = z.infer<typeof OptionValueUpdateSchema>;
export type VariantBatchCreateInput = z.infer<typeof VariantBatchCreateSchema>;

/**
 * Thêm một trục lựa chọn cho sản phẩm đã tạo (kể cả sản phẩm đang chỉ có một biến thể).
 * Mọi biến thể đang có được gán vào `defaultValue`; các tổ hợp còn lại tạo sau.
 */
export const ProductOptionAddSchema = z
  .object({
    name: z.string().trim().min(1, 'Chưa nhập tên tùy chọn').max(60),
    values: z
      .array(z.string().trim().min(1).max(60))
      .min(1, 'Cần ít nhất một giá trị')
      .max(30, 'Tối đa 30 giá trị'),
    defaultValue: z.string().trim().min(1, 'Chưa chọn giá trị cho các biến thể đang có'),
  })
  .superRefine((data, ctx) => {
    const lower = data.values.map((value) => value.toLocaleLowerCase('vi'));
    if (new Set(lower).size !== lower.length) {
      ctx.addIssue({ code: 'custom', path: ['values'], message: 'Có giá trị bị trùng' });
    }
    if (!lower.includes(data.defaultValue.toLocaleLowerCase('vi'))) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'Giá trị cho biến thể đang có phải nằm trong danh sách',
      });
    }
  });

export type ProductOptionAddInput = z.infer<typeof ProductOptionAddSchema>;

/** Một thuộc tính của biến thể theo NHÃN: { name: 'Màu sắc', value: 'Rose Gold' } */
export const VariantAttributeSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên thuộc tính').max(60),
  value: z.string().trim().min(1, 'Chưa nhập giá trị').max(60),
});

/**
 * Thêm biến thể theo nhãn, kiểu "Màu sắc: Rose Gold, App: TTLock".
 * API tự tạo tùy chọn và giá trị còn thiếu, tất cả trong một transaction.
 * existingValues: với thuộc tính MỚI, các biến thể đang có thuộc giá trị nào (khóa = tên thuộc tính).
 */
export const VariantQuickCreateSchema = z
  .object({
    attributes: z
      .array(VariantAttributeSchema)
      .min(1, 'Cần ít nhất một thuộc tính')
      .max(3, 'Tối đa 3 thuộc tính'),
    existingValues: z.record(z.string(), z.string().trim().min(1).max(60)).default({}),
    name: z.string().trim().max(200).optional(),
    sku: SkuSchema.optional(),
    price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    compareAtPrice: z.number().int().min(0).nullable().optional(),
    trackSerial: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const names = data.attributes.map((attribute) => attribute.name.toLocaleLowerCase('vi'));
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', path: ['attributes'], message: 'Tên thuộc tính bị trùng' });
    }
    if (data.compareAtPrice != null && data.compareAtPrice <= data.price) {
      ctx.addIssue({
        code: 'custom',
        path: ['compareAtPrice'],
        message: 'Giá gạch ngang phải lớn hơn giá bán',
      });
    }
  });

export type VariantAttribute = z.infer<typeof VariantAttributeSchema>;
export type VariantQuickCreateInput = z.infer<typeof VariantQuickCreateSchema>;

/** Xóa nhiều sản phẩm; sản phẩm không xóa được sẽ bị bỏ qua kèm lý do */
export const ProductBulkDeleteSchema = z.object({
  ids: z.array(z.uuid()).min(1, 'Chưa chọn sản phẩm nào').max(100, 'Mỗi lần xóa tối đa 100 sản phẩm'),
});

export type ProductBulkDeleteInput = z.infer<typeof ProductBulkDeleteSchema>;

/**
 * Lý do không xóa được sản phẩm:
 * ACTIVE: đang bán; IN_USE: đã có giao dịch/KM/combo; VOUCHER: đang nằm trong voucher; NOT_FOUND
 */
export type ProductDeleteBlockCode = 'ACTIVE' | 'IN_USE' | 'VOUCHER' | 'NOT_FOUND';

export interface ProductDeleteBlock {
  code: ProductDeleteBlockCode;
  message: string;
}

export interface ProductBulkDeleteResult {
  deleted: { id: string; name: string }[];
  skipped: { id: string; name: string; code: ProductDeleteBlockCode; message: string }[];
}