import { z } from 'zod';
import { ExpectedUpdatedAtSchema } from './product';
import { VnPhoneSchema } from './order';

/**
 * Yêu cầu tư vấn: khách để lại số trên website, nhân viên kinh doanh gọi lại.
 *
 * Đây là DỮ LIỆU CÁ NHÂN (tên, số điện thoại, email). Vì vậy:
 *  - form bắt buộc tick đồng ý trước khi gửi,
 *  - API đọc danh sách đòi quyền customer.view,
 *  - không ghi số điện thoại ra nhật ký ứng dụng.
 */

export const CONSULT_KINDS = ['RETAIL', 'PROJECT'] as const;
export type ConsultKindValue = (typeof CONSULT_KINDS)[number];

export const CONSULT_KIND_LABEL: Record<ConsultKindValue, string> = {
  RETAIL: 'Khách lẻ',
  PROJECT: 'Dự án / nhà thầu',
};

export const CONSULT_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST', 'SPAM'] as const;
export type ConsultStatusValue = (typeof CONSULT_STATUSES)[number];

export const CONSULT_STATUS_LABEL: Record<ConsultStatusValue, string> = {
  NEW: 'Mới',
  CONTACTED: 'Đã gọi',
  QUOTED: 'Đã báo giá',
  WON: 'Chốt đơn',
  LOST: 'Không chốt',
  SPAM: 'Rác',
};

const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

/**
 * Form khách gửi. Không đăng nhập, nên trường nào cũng phải tự phòng vệ.
 *
 * Trường `website` là bẫy bot (honeypot): form thật giấu nó bằng CSS nên người
 * không bao giờ điền, còn bot tự động điền mọi ô nó thấy. Có chữ trong đó là
 * loại ngay, không tốn một dòng captcha nào và không làm phiền khách thật.
 */
export const ConsultSubmitSchema = z
  .object({
    kind: z.enum(CONSULT_KINDS).default('RETAIL'),
    fullName: z.string().trim().min(2, 'Chưa nhập họ tên').max(100),
    phone: VnPhoneSchema,
    // Tự kiểm bằng biểu thức thay vì z.email(): khách bỏ trống ô này rất nhiều,
    // mà chuỗi rỗng phải đi qua được chứ không được báo lỗi.
    email: z
      .string()
      .trim()
      .max(255)
      .optional()
      .transform((value) => (value ? value : null))
      .refine(
        (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Email không hợp lệ',
      ),
    company: OptionalText(200),
    quantity: z.coerce.number().int().min(1).max(100000).optional(),
    doorTypeName: OptionalText(120),
    productSlug: OptionalText(160),
    productName: OptionalText(200),
    message: OptionalText(2000),
    sourcePath: OptionalText(500),
    /** Đồng ý cho công ty dùng số điện thoại để gọi lại tư vấn */
    privacyConsent: z
      .union([z.literal('true'), z.literal(true)], 'Cần đồng ý để chúng tôi gọi lại cho bạn')
      .transform(() => true),
    /** Bẫy bot: phải rỗng */
    website: z.string().max(0, 'Yêu cầu không hợp lệ').optional(),
  })
  .strict();

export type ConsultSubmitInput = z.infer<typeof ConsultSubmitSchema>;

export const ConsultListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(CONSULT_STATUSES).optional(),
  kind: z.enum(CONSULT_KINDS).optional(),
  /** Tìm theo tên, số điện thoại hoặc tên công ty */
  q: z.string().trim().max(120).optional(),
});
export type ConsultListQuery = z.infer<typeof ConsultListQuerySchema>;

export const ConsultUpdateSchema = z
  .object({
    status: z.enum(CONSULT_STATUSES).optional(),
    internalNote: z.string().max(5000).nullable().optional(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema.optional(),
  })
  .strict();
export type ConsultUpdateInput = z.infer<typeof ConsultUpdateSchema>;

export interface ConsultItem {
  id: string;
  kind: ConsultKindValue;
  status: ConsultStatusValue;
  fullName: string;
  /** Dạng +84xxxxxxxxx; dùng formatVnPhone để hiện */
  phone: string;
  email: string | null;
  company: string | null;
  quantity: number | null;
  doorTypeName: string | null;
  productSlug: string | null;
  productName: string | null;
  message: string | null;
  sourcePath: string | null;
  internalNote: string | null;
  contactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Nội dung bắn qua Socket.IO khi có yêu cầu mới.
 *
 * CÓ kèm số điện thoại: kênh realtime đã xác thực bằng token và chỉ bắn vào
 * phòng của những vai trò có quyền customer.view — đúng những người được xem
 * số khách. Nhân viên kinh doanh thấy số ngay trong thông báo là gọi lại được
 * luôn, không phải mở trang rồi tìm.
 */
export interface ConsultRequestedEvent {
  id: string;
  kind: ConsultKindValue;
  fullName: string;
  phone: string;
  /** Một dòng tóm tắt: "40 bộ · Chung cư ABC" hoặc tên sản phẩm khách đang xem */
  summary: string;
}

/** Số yêu cầu theo từng trạng thái, để hiện lên các tab */
export type ConsultStatusCounts = Record<ConsultStatusValue, number>;

/** Kết quả trả về cho khách sau khi gửi form */
export interface ConsultSubmitResult {
  id: string;
  /** true khi đây là lần gửi trùng trong thời gian ngắn, hệ thống dùng lại bản ghi cũ */
  duplicated: boolean;
}
