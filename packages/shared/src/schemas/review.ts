import { z } from 'zod';
import { normalizeVnPhone } from './order';
import { ExpectedUpdatedAtSchema } from './product';

/**
 * ĐÁNH GIÁ SẢN PHẨM (Bước 8): khách viết thẳng trên trang sản phẩm.
 *
 * Chống đánh giá ảo/spam:
 * 1. Mọi đánh giá CHỜ DUYỆT, chỉ hiện sau khi nhân viên duyệt.
 * 2. Bắt buộc số điện thoại (không hiện công khai).
 * 3. Số điện thoại khớp đơn Hoàn tất có sản phẩm -> tự gắn "Đã mua hàng".
 * 4. Mỗi số điện thoại 1 đánh giá (chưa bị từ chối) cho mỗi sản phẩm; giới hạn số lần gửi theo IP.
 * 5. Tối đa 5 ảnh; ảnh lưu riêng (không vào Thư viện ảnh), từ chối thì xóa ảnh.
 */

export const REVIEW_MAX_PHOTOS = 5;
export const REVIEW_MAX_PHOTO_MB = 5;
export const REVIEW_MAX_CONTENT = 2000;

export type ReviewStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

export const REVIEW_STATUS_LABEL: Record<ReviewStatusValue, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

/** Lý do từ chối hay gặp: bấm chọn nhanh, vẫn sửa được */
export const REVIEW_REJECT_PRESETS = [
  'Nội dung quảng cáo hoặc chứa link',
  'Ngôn từ không phù hợp',
  'Không liên quan đến sản phẩm',
  'Đánh giá trùng lặp',
  'Ảnh không phù hợp',
] as const;

export interface ReviewPhoto {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/**
 * Khách gửi đánh giá (multipart/form-data: các trường chữ + tối đa 5 file "photos").
 * Trường gửi dạng chuỗi nên số sao và ô đồng ý được chuyển kiểu ở đây.
 */
export const ReviewSubmitSchema = z
  .object({
    productId: z.uuid('Sản phẩm không hợp lệ'),
    reviewerName: z.string().trim().min(2, 'Nhập tên của bạn').max(100, 'Tối đa 100 ký tự'),
    phone: z
      .string()
      .trim()
      .transform((value, ctx) => {
        const phone = normalizeVnPhone(value);
        if (!phone) {
          ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ' });
          return z.NEVER;
        }
        return phone;
      }),
    rating: z.coerce.number().int().min(1, 'Chọn số sao').max(5, 'Tối đa 5 sao'),
    content: z
      .string()
      .trim()
      .max(REVIEW_MAX_CONTENT, `Tối đa ${REVIEW_MAX_CONTENT} ký tự`)
      .optional()
      .transform((value) => (value ? value : null)),
    /** Đồng ý cho công ty dùng số điện thoại để xác minh và liên hệ về đánh giá */
    privacyConsent: z
      .union([z.literal('true'), z.literal(true)], 'Cần đồng ý chính sách bảo vệ dữ liệu cá nhân')
      .transform(() => true),
  })
  .strict();
export type ReviewSubmitInput = z.infer<typeof ReviewSubmitSchema>;

export interface ReviewSubmitResult {
  id: string;
  status: 'PENDING';
  verifiedPurchase: boolean;
}

// ---------- Duyệt (nhân viên) ----------

export const ReviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verified: z.enum(['true', 'false']).optional(),
  productId: z.uuid().optional(),
  /** Tên người viết, số điện thoại, nội dung */
  search: z.string().trim().max(200).optional(),
});
export type ReviewListQuery = z.infer<typeof ReviewListQuerySchema>;

export type ReviewStatusCounts = Record<ReviewStatusValue, number>;

export const ReviewApproveSchema = z.object({ expectedUpdatedAt: ExpectedUpdatedAtSchema }).strict();

export const ReviewRejectSchema = z
  .object({
    reason: z.string().trim().min(3, 'Ghi lý do từ chối').max(500, 'Tối đa 500 ký tự'),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type ReviewRejectInput = z.infer<typeof ReviewRejectSchema>;

/** Trả lời công khai dưới đánh giá; content = null để gỡ câu trả lời */
export const ReviewReplySchema = z
  .object({
    content: z.string().trim().min(1, 'Chưa nhập câu trả lời').max(REVIEW_MAX_CONTENT).nullable(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type ReviewReplyInput = z.infer<typeof ReviewReplySchema>;

export interface ReviewItem {
  id: string;
  product: { id: string; name: string; slug: string };
  reviewerName: string;
  /** Chỉ nhân viên thấy */
  reviewerPhone: string;
  rating: number;
  content: string | null;
  photos: ReviewPhoto[];
  status: ReviewStatusValue;
  verifiedPurchase: boolean;
  order: { id: string; code: string } | null;
  customer: { id: string; fullName: string } | null;
  rejectReason: string | null;
  reply: string | null;
  repliedAt: string | null;
  moderatedBy: { id: string; fullName: string } | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}