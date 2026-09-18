import { z } from 'zod';
import { SlugSchema } from './catalog';

export const ProductTypeSchema = z.enum(['LOCK', 'ACCESSORY', 'SERVICE', 'BUNDLE']);
export const ProductStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export type ProductTypeValue = z.infer<typeof ProductTypeSchema>;

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
  status: ProductStatusSchema.optional(),
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
