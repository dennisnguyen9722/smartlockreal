import { z } from 'zod';

/**
 * Loại cửa: trục phân loại thứ hai bên cạnh danh mục.
 * Danh mục trả lời "hãng nào, dòng nào", loại cửa trả lời "lắp được cửa gì" —
 * đó mới là câu khách hỏi đầu tiên.
 */

const SlugSchema = z
  .string()
  .trim()
  .min(1, 'Chưa nhập đường dẫn')
  .max(80, 'Đường dẫn tối đa 80 ký tự')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Đường dẫn chỉ gồm chữ thường, số và gạch ngang');

export const DoorTypeCreateSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên loại cửa').max(80, 'Tên tối đa 80 ký tự'),
  /** Bỏ trống thì tự sinh từ tên */
  slug: SlugSchema.optional(),
  description: z.string().trim().max(320, 'Mô tả tối đa 320 ký tự').optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const DoorTypeUpdateSchema = DoorTypeCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
  /** Khóa lạc quan: gửi kèm updatedAt đang thấy để chặn ghi đè của người khác */
  expectedUpdatedAt: z.iso.datetime().optional(),
});

/** Đặt lại toàn bộ loại cửa của MỘT sản phẩm */
export const ProductDoorTypeSetSchema = z.object({
  doorTypeIds: z.array(z.uuid('Loại cửa không hợp lệ')).max(20, 'Tối đa 20 loại cửa'),
});

/** Gắn hoặc gỡ loại cửa cho NHIỀU sản phẩm một lượt */
export const ProductDoorTypeBulkSchema = z.object({
  productIds: z.array(z.uuid()).min(1, 'Chưa chọn sản phẩm nào').max(500, 'Tối đa 500 sản phẩm mỗi lần'),
  doorTypeIds: z.array(z.uuid()).min(1, 'Chưa chọn loại cửa nào').max(20),
  /**
   * ADD     giữ nguyên cái đã có, thêm vào
   * REMOVE  gỡ những cái được chọn
   * REPLACE xóa hết rồi đặt lại đúng danh sách này
   */
  mode: z.enum(['ADD', 'REMOVE', 'REPLACE']),
});

/** Bộ lọc của trang gắn loại cửa hàng loạt */
export const DoorTypeAssignQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).optional(),
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  /** 'CHUA_GAN' = chỉ sản phẩm chưa có loại cửa nào; hoặc id một loại cửa cụ thể */
  doorTypeId: z.union([z.literal('CHUA_GAN'), z.uuid()]).optional(),
});

export type DoorTypeCreateInput = z.infer<typeof DoorTypeCreateSchema>;
export type DoorTypeUpdateInput = z.infer<typeof DoorTypeUpdateSchema>;
export type ProductDoorTypeSetInput = z.infer<typeof ProductDoorTypeSetSchema>;
export type ProductDoorTypeBulkInput = z.infer<typeof ProductDoorTypeBulkSchema>;
export type DoorTypeAssignQuery = z.infer<typeof DoorTypeAssignQuerySchema>;

export interface DoorTypeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  updatedAt: string;
}

export interface ProductDoorTypeRow {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  brandName: string | null;
  doorTypeIds: string[];
}

export const BULK_MODE_LABEL: Record<ProductDoorTypeBulkInput['mode'], string> = {
  ADD: 'Thêm loại cửa',
  REMOVE: 'Gỡ loại cửa',
  REPLACE: 'Đặt lại đúng danh sách này',
};
