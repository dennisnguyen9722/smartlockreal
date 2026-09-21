import { z } from 'zod';
import { OrderLineInputSchema } from './order';

export type QuoteStatusValue =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export const QUOTE_STATUS_LABEL: Record<QuoteStatusValue, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  SENT: 'Đã gửi khách',
  ACCEPTED: 'Khách đồng ý',
  REJECTED: 'Khách từ chối',
  EXPIRED: 'Hết hạn',
  CONVERTED: 'Đã thành đơn',
  SUPERSEDED: 'Đã thay thế',
  CANCELLED: 'Đã hủy',
};

/** Báo giá còn phải theo dõi */
export const OPEN_QUOTE_STATUSES: readonly QuoteStatusValue[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED'];

export const QuoteListStatusSchema = z.enum([
  'OPEN',
  'ALL',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACCEPTED',
  'CONVERTED',
  /** Từ chối, hết hạn, hủy */
  'CLOSED',
]);
export type QuoteListStatus = z.infer<typeof QuoteListStatusSchema>;
export type QuoteStatusCounts = Record<QuoteListStatus, number>;

/** "Giảm 12,5%" từ phần vạn */
export function formatDiscountBps(bps: number): string {
  const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Math.abs(bps) / 100);
  return bps >= 0 ? `${percent}%` : `+${percent}%`;
}

// ---------- Tạo, sửa ----------

const DateOnlySchema = z.iso.date('Ngày không hợp lệ');

export const QuoteCreateSchema = z.object({
  customerId: z.uuid('Chưa chọn khách hàng'),
  contactId: z.uuid().optional(),
  projectName: z.string().trim().min(1).max(255).optional(),
  siteAddress: z.string().trim().min(1).max(500).optional(),
  /** Bỏ trống = hôm nay + số ngày cấu hình (quote.default_valid_days) */
  validUntil: DateOnlySchema.optional(),
  vatInvoiceRequested: z.boolean().default(true),
  shippingFee: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  depositRequired: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  terms: z.string().trim().max(5000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
  lines: z.array(OrderLineInputSchema).min(1, 'Báo giá phải có ít nhất một sản phẩm').max(200),
});
export type QuoteCreateInput = z.infer<typeof QuoteCreateSchema>;

const NullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

/** Sửa thông tin chung: chỉ khi Nháp (trừ ghi chú nội bộ) */
export const QuoteUpdateSchema = z.object({
  expectedVersion: z.number().int().min(1),
  contactId: z.uuid().nullable().optional(),
  projectName: NullableText(255),
  siteAddress: NullableText(500),
  validUntil: DateOnlySchema.optional(),
  vatInvoiceRequested: z.boolean().optional(),
  shippingFee: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  depositRequired: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  terms: NullableText(5000),
  internalNote: z.string().trim().max(2000).nullable().optional(),
});
export type QuoteUpdateInput = z.infer<typeof QuoteUpdateSchema>;

export const QuoteLinesReplaceSchema = z.object({
  expectedVersion: z.number().int().min(1),
  lines: z.array(OrderLineInputSchema).min(1, 'Báo giá phải có ít nhất một sản phẩm').max(200),
});
export type QuoteLinesReplaceInput = z.infer<typeof QuoteLinesReplaceSchema>;

// ---------- Duyệt, hủy ----------

export type QuoteSendChannelValue = 'ZALO' | 'EMAIL' | 'OTHER';
export const QUOTE_SEND_CHANNEL_LABEL: Record<QuoteSendChannelValue, string> = {
  ZALO: 'Zalo',
  EMAIL: 'Email',
  OTHER: 'Kênh khác',
};

/**
 * SUBMIT: gửi duyệt · WITHDRAW: nhân viên rút lại · APPROVE/RETURN: quản trị duyệt/trả lại
 * REOPEN: đã duyệt nhưng cần sửa -> về Nháp (bỏ duyệt) · CANCEL: hủy
 * MARK_SENT: đã gửi khách (kèm kênh) · ACCEPT: khách đồng ý · REJECT: khách từ chối (kèm lý do)
 */
export const QuoteActionSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    action: z.enum(['SUBMIT', 'WITHDRAW', 'APPROVE', 'RETURN', 'REOPEN', 'CANCEL', 'MARK_SENT', 'ACCEPT', 'REJECT']),
    note: z.string().trim().max(1000).optional(),
    /** Bắt buộc với MARK_SENT */
    via: z.enum(['ZALO', 'EMAIL', 'OTHER']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'MARK_SENT' && !data.via) {
      ctx.addIssue({ code: 'custom', path: ['via'], message: 'Chưa chọn kênh gửi báo giá' });
    }
    if (data.action === 'REJECT' && !data.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Ghi lý do khách từ chối' });
    }
  });
export type QuoteActionInput = z.infer<typeof QuoteActionSchema>;
export type QuoteActionValue = QuoteActionInput['action'];

export const QuoteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: QuoteListStatusSchema.default('OPEN'),
  customerId: z.uuid().optional(),
  mine: z.enum(['true', 'false']).optional(),
});
export type QuoteListQuery = z.infer<typeof QuoteListQuerySchema>;

/** Tạo phiên bản mới (khách muốn sửa sau khi đã gửi) */
export const QuoteReviseSchema = z.object({ expectedVersion: z.number().int().min(1) });

/** Khách đồng ý -> tạo đơn kênh Công trình, giữ nguyên giá đã báo */
export const QuoteConvertSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    fulfillmentType: z.enum(['DELIVERY', 'STORE_PICKUP']).default('DELIVERY'),
    /** Bỏ trống = địa chỉ công trình trên báo giá */
    shipAddressRaw: z.string().trim().min(1).max(500).optional(),
    fulfillmentLocationId: z.uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === 'STORE_PICKUP' && !data.fulfillmentLocationId) {
      ctx.addIssue({ code: 'custom', path: ['fulfillmentLocationId'], message: 'Chưa chọn showroom nhận hàng' });
    }
  });
export type QuoteConvertInput = z.infer<typeof QuoteConvertSchema>;

/** Thông tin công ty in trên báo giá (đọc từ system_settings, khóa company.*) */
export interface CompanyInfo {
  name: string;
  brandName: string;
  taxCode: string;
  address: string;
  hotline: string;
  email: string;
  website: string;
  logoUrl: string;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
}