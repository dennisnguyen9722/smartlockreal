import { z } from 'zod';

/** Slug: chữ thường, số, gạch ngang (khớp ràng buộc CHECK trong database) */
export const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang');

/** Ảnh lưu theo url (như product_media): xóa ảnh ở Thư viện ảnh phải kiểm tra cột này */
const BrandLogoSchema = z
  .string()
  .trim()
  .max(500, 'Đường dẫn quá dài')
  .refine((value) => value === '' || value.startsWith('/') || /^https?:\/\//.test(value), 'Đường dẫn ảnh không hợp lệ')
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const BrandCreateSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên hãng').max(120),
  /** Logo hãng, hiện ở danh sách sản phẩm và trang hãng trên website */
  logoUrl: BrandLogoSchema.optional(),
  /** Bỏ trống thì hệ thống tự tạo từ tên */
  slug: SlugSchema.optional(),
  description: z.string().max(5000).optional(),
  countryOfOrigin: z.string().trim().max(80).optional(),
  isAuthorized: z.boolean().optional(),
  authorizationDocUrl: z.string().url().max(500).optional(),
  /** Ngày hết hạn giấy ủy quyền, dạng YYYY-MM-DD */
  authorizationExpiresAt: z.iso.date().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const BrandUpdateSchema = BrandCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const CategoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên danh mục').max(120),
  slug: SlugSchema.optional(),
  parentId: z.uuid().optional(),
  description: z.string().max(5000).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
  /** null = chuyển thành danh mục gốc */
  parentId: z.uuid().nullable().optional(),
});

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  includeInactive: z.stringbool().default(false),
});

export type BrandCreateInput = z.infer<typeof BrandCreateSchema>;
export type BrandUpdateInput = z.infer<typeof BrandUpdateSchema>;
export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
