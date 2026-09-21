import { z } from 'zod';

// ---------- Trạng thái ----------

export type OrderStatusValue =
  | 'PENDING_PAYMENT'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'ORDERED_FROM_BRAND'
  | 'GOODS_ARRIVED'
  | 'FULFILLING'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  ORDERED_FROM_BRAND: 'Đã đặt hãng',
  GOODS_ARRIVED: 'Hàng về',
  FULFILLING: 'Đang giao lắp',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

/** Quy trình chính, theo thứ tự. PENDING_PAYMENT không dùng (không thanh toán online). */
export const ORDER_STATUS_FLOW: readonly OrderStatusValue[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'ORDERED_FROM_BRAND',
  'GOODS_ARRIVED',
  'FULFILLING',
  'COMPLETED',
];

/** Đơn chưa kết thúc: nhân viên còn việc phải làm */
export const OPEN_ORDER_STATUSES: readonly OrderStatusValue[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'ORDERED_FROM_BRAND',
  'GOODS_ARRIVED',
  'FULFILLING',
];

/** Bộ lọc danh sách: OPEN = đang xử lý, ALL = tất cả */
export const OrderListStatusSchema = z.enum([
  'OPEN',
  'ALL',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'ORDERED_FROM_BRAND',
  'GOODS_ARRIVED',
  'FULFILLING',
  'COMPLETED',
  'CANCELLED',
]);
export type OrderListStatus = z.infer<typeof OrderListStatusSchema>;
export type OrderStatusCounts = Record<OrderListStatus, number>;

// ---------- Kênh và hình thức nhận hàng ----------

export type SalesChannelValue = 'WEBSITE' | 'ZALO' | 'STORE' | 'PROJECT';
export const SALES_CHANNEL_LABEL: Record<SalesChannelValue, string> = {
  WEBSITE: 'Website',
  ZALO: 'Zalo',
  STORE: 'Tại showroom',
  PROJECT: 'Công trình',
};

/** TAKE_AWAY (mua mang về) không dùng: công ty không giữ hàng sẵn */
export type FulfillmentTypeValue = 'DELIVERY' | 'STORE_PICKUP' | 'TAKE_AWAY';
export const FULFILLMENT_TYPE_LABEL: Record<FulfillmentTypeValue, string> = {
  DELIVERY: 'Giao lắp tận nơi',
  STORE_PICKUP: 'Nhận tại showroom',
  TAKE_AWAY: 'Mua mang về',
};

// ---------- Số điện thoại ----------

const VN_PHONE_PATTERN = /^\+84[0-9]{9,10}$/;

/**
 * Chuẩn hóa số điện thoại Việt Nam về dạng database yêu cầu: +84901234567.
 * Nhận "0901 234 567", "0901.234.567", "84901234567", "+84 901 234 567".
 * Trả về null nếu không phải số hợp lệ.
 */
export function normalizeVnPhone(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, '');
  let normalized: string;
  if (digits.startsWith('+84')) normalized = digits;
  else if (digits.startsWith('84')) normalized = `+${digits}`;
  else if (digits.startsWith('0')) normalized = `+84${digits.slice(1)}`;
  else return null;
  return VN_PHONE_PATTERN.test(normalized) ? normalized : null;
}

/** Hiển thị: +84901234567 -> 0901 234 567 */
export function formatVnPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  if (!phone.startsWith('+84')) return phone;
  const local = `0${phone.slice(3)}`;
  return local.length === 10
    ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
    : `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 11)}`;
}

export const VnPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Chưa nhập số điện thoại')
  .transform((value, ctx) => {
    const normalized = normalizeVnPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ' });
      return z.NEVER;
    }
    return normalized;
  });

// ---------- Tạo đơn ----------

export const OrderLineInputSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1, 'Số lượng tối thiểu là 1').max(999),
  /** Nhân viên sửa giá (chưa VAT). Bỏ trống = giá niêm yết. Web không được gửi trường này. */
  unitPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
});

/** Nhân viên tạo đơn (khách nhắn Zalo, mua tại showroom) */
export const OrderCreateSchema = z
  .object({
    channel: z.enum(['ZALO', 'STORE', 'WEBSITE']),
    fulfillmentType: z.enum(['DELIVERY', 'STORE_PICKUP']),
    customerName: z.string().trim().min(1, 'Chưa nhập tên khách').max(200),
    customerPhone: VnPhoneSchema,
    /** Địa chỉ gõ tự do; nhân viên chuẩn hóa khi xác nhận đơn */
    shipAddressRaw: z.string().trim().max(500).optional(),
    /** Showroom khách đến nhận (bắt buộc với STORE_PICKUP) */
    fulfillmentLocationId: z.uuid().optional(),
    customerNote: z.string().trim().max(2000).optional(),
    internalNote: z.string().trim().max(2000).optional(),
    depositRequired: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    assignedStaffId: z.uuid().optional(),
    lines: z.array(OrderLineInputSchema).min(1, 'Đơn phải có ít nhất một sản phẩm').max(50),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === 'DELIVERY' && !data.shipAddressRaw) {
      ctx.addIssue({ code: 'custom', path: ['shipAddressRaw'], message: 'Chưa nhập địa chỉ giao hàng' });
    }
    if (data.fulfillmentType === 'STORE_PICKUP' && !data.fulfillmentLocationId) {
      ctx.addIssue({ code: 'custom', path: ['fulfillmentLocationId'], message: 'Chưa chọn showroom nhận hàng' });
    }
  });

export type OrderLineInput = z.infer<typeof OrderLineInputSchema>;
export type OrderCreateInput = z.infer<typeof OrderCreateSchema>;

// ---------- Danh sách ----------

export const OrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** Mã đơn, số điện thoại hoặc tên khách */
  search: z.string().trim().max(200).optional(),
  status: OrderListStatusSchema.default('OPEN'),
  channel: z.enum(['WEBSITE', 'ZALO', 'STORE', 'PROJECT']).optional(),
  /** 'true' = chỉ đơn mình phụ trách */
  mine: z.enum(['true', 'false']).optional(),
});

export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;