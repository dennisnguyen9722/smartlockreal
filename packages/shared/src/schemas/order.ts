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

// ---------- Đặt hàng từ website ----------

/** Phiên bản chính sách bảo vệ dữ liệu cá nhân khách đã đồng ý (Nghị định 13/2023). Đổi khi sửa chính sách. */
export const PRIVACY_POLICY_VERSION = '2026-09';

/**
 * Khách tự đặt trên website. .strict(): gửi thêm trường lạ (vd: unitPrice để tự sửa giá) là bị từ chối.
 * Không có thanh toán online: nhân viên gọi xác nhận và hỏi hãng trước.
 */
export const ShopOrderCreateSchema = z
  .object({
    /** Website tạo một lần khi mở trang đặt hàng; gửi lại cùng mã thì trả lại đúng đơn cũ */
    idempotencyKey: z.uuid('Thiếu mã chống đặt trùng'),
    customerName: z.string().trim().min(1, 'Chưa nhập họ tên').max(200),
    customerPhone: VnPhoneSchema,
    fulfillmentType: z.enum(['DELIVERY', 'STORE_PICKUP']).default('DELIVERY'),
    shipAddressRaw: z.string().trim().max(500).optional(),
    fulfillmentLocationId: z.uuid().optional(),
    customerNote: z.string().trim().max(1000).optional(),
    lines: z
      .array(
        z
          .object({
            variantId: z.uuid(),
            quantity: z.number().int().min(1).max(20, 'Mua số lượng lớn vui lòng liên hệ để được báo giá công trình'),
          })
          .strict(),
      )
      .min(1, 'Giỏ hàng trống')
      .max(20),
    privacyConsent: z.literal(true, 'Vui lòng đồng ý chính sách bảo vệ dữ liệu cá nhân'),
    /** Ô bẫy chống bot: ẩn với người thật nên luôn để trống */
    website: z.string().max(0, 'Dữ liệu không hợp lệ').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === 'DELIVERY' && !data.shipAddressRaw) {
      ctx.addIssue({ code: 'custom', path: ['shipAddressRaw'], message: 'Chưa nhập địa chỉ giao hàng' });
    }
    if (data.fulfillmentType === 'STORE_PICKUP' && !data.fulfillmentLocationId) {
      ctx.addIssue({ code: 'custom', path: ['fulfillmentLocationId'], message: 'Chưa chọn showroom nhận hàng' });
    }
  });

export type ShopOrderCreateInput = z.infer<typeof ShopOrderCreateSchema>;

/** Kết quả trả về cho website: đủ để hiện trang "cảm ơn", không lộ ID nội bộ */
export interface ShopOrderResult {
  code: string;
  grandTotal: number;
  status: OrderStatusValue;
  placedAt: string;
}

// ---------- Sự kiện realtime ----------

/** Payload của RealtimeEvent.ORDER_CREATED */
export interface OrderCreatedEvent {
  id: string;
  code: string;
  channel: SalesChannelValue;
  customerName: string | null;
  grandTotal: number;
  /** "Khóa Huyndai HY-SL007 - Black và 1 sản phẩm khác" */
  lineSummary: string;
  /** true = nhân viên tạo (không cần chuông); false = khách tự đặt trên web */
  createdByStaff: boolean;
}

// ---------- Chuyển trạng thái (API và giao diện dùng CHUNG bảng này) ----------

/**
 * Được chuyển từ trạng thái nào sang trạng thái nào.
 * Phần tử đầu = bước tiếp theo; có thể lùi đúng một bước (bấm nhầm); hủy được trước khi hoàn tất.
 */
export const ORDER_TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  PENDING_PAYMENT: ['PENDING_CONFIRMATION', 'CANCELLED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ORDERED_FROM_BRAND', 'PENDING_CONFIRMATION', 'CANCELLED'],
  ORDERED_FROM_BRAND: ['GOODS_ARRIVED', 'CONFIRMED', 'CANCELLED'],
  GOODS_ARRIVED: ['FULFILLING', 'ORDERED_FROM_BRAND', 'CANCELLED'],
  FULFILLING: ['COMPLETED', 'GOODS_ARRIVED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Bước tiếp theo trong quy trình chính (null = đã kết thúc) */
export function nextOrderStatus(status: OrderStatusValue): OrderStatusValue | null {
  const index = ORDER_STATUS_FLOW.indexOf(status);
  if (index < 0 || index === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[index + 1] ?? null;
}

/** Bước liền trước trong quy trình chính (để lùi khi bấm nhầm) */
export function previousOrderStatus(status: OrderStatusValue): OrderStatusValue | null {
  const index = ORDER_STATUS_FLOW.indexOf(status);
  if (index <= 0 || status === 'COMPLETED') return null;
  return ORDER_STATUS_FLOW[index - 1] ?? null;
}

/** Tên nút chuyển sang bước tiếp theo */
export const ORDER_NEXT_ACTION_LABEL: Partial<Record<OrderStatusValue, string>> = {
  CONFIRMED: 'Xác nhận đơn',
  ORDERED_FROM_BRAND: 'Đã đặt hãng',
  GOODS_ARRIVED: 'Hàng đã về',
  FULFILLING: 'Bắt đầu giao lắp',
  COMPLETED: 'Hoàn tất đơn',
};

export const OrderStatusChangeSchema = z.object({
  to: z.enum([
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'ORDERED_FROM_BRAND',
    'GOODS_ARRIVED',
    'FULFILLING',
    'COMPLETED',
    'CANCELLED',
  ]),
  /** Khóa lạc quan: cột orders.version mà nhân viên đang thấy */
  expectedVersion: z.number().int().min(1),
  note: z.string().trim().max(1000).optional(),
  /** Bắt buộc khi hủy */
  cancelReason: z.string().trim().max(1000).optional(),
  /** Tùy chọn khi chuyển sang Đã đặt hãng */
  brandOrderRef: z.string().trim().min(1).max(100).optional(),
});
export type OrderStatusChangeInput = z.infer<typeof OrderStatusChangeSchema>;

// ---------- Sửa thông tin đơn ----------

const NullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

export const OrderUpdateSchema = z.object({
  expectedVersion: z.number().int().min(1),
  // Giao hàng (tên tỉnh/phường do API tra từ mã)
  shipRecipientName: NullableText(200),
  shipRecipientPhone: VnPhoneSchema.nullable().optional(),
  shipProvinceCode: z.string().regex(/^\d{2}$/, 'Mã tỉnh không hợp lệ').nullable().optional(),
  shipWardCode: z.string().regex(/^\d{5}$/, 'Mã phường/xã không hợp lệ').nullable().optional(),
  shipStreet: NullableText(500),
  fulfillmentLocationId: z.uuid().nullable().optional(),
  // Làm việc với hãng
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
  brandOrderRef: NullableText(100),
  brandTechnicianNote: NullableText(2000),
  // Nội bộ
  internalNote: z.string().trim().max(2000).nullable().optional(),
  assignedStaffId: z.uuid().nullable().optional(),
  // Tiền
  depositRequired: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  shippingFee: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  // Hóa đơn VAT: bật thì cộng VAT theo thuế suất từng dòng
  vatInvoiceRequested: z.boolean().optional(),
  invoiceBuyerName: NullableText(200),
  invoiceCompanyName: NullableText(255),
  invoiceTaxCode: z
    .string()
    .trim()
    .regex(/^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/, 'Mã số thuế gồm 10 số, 10-3 số (chi nhánh) hoặc 12 số')
    .nullable()
    .optional(),
  invoiceAddress: NullableText(500),
  invoiceEmail: z.email('Email không hợp lệ').toLowerCase().nullable().optional(),
});
export type OrderUpdateInput = z.infer<typeof OrderUpdateSchema>;

// ---------- Thanh toán ----------

export type PaymentMethodValue = 'CASH' | 'COD' | 'BANK_TRANSFER' | 'VNPAY';
export type PaymentPurposeValue = 'DEPOSIT' | 'BALANCE' | 'FULL' | 'REFUND';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  CASH: 'Tiền mặt',
  COD: 'Thu hộ khi giao (COD)',
  BANK_TRANSFER: 'Chuyển khoản',
  VNPAY: 'VNPay',
};

export const PAYMENT_PURPOSE_LABEL: Record<PaymentPurposeValue, string> = {
  DEPOSIT: 'Đặt cọc',
  BALANCE: 'Thu tiếp',
  FULL: 'Thu đủ',
  REFUND: 'Hoàn tiền',
};

/** Nhân viên ghi nhận khoản tiền ĐÃ thu (hoặc đã hoàn). Không có thanh toán online. */
export const PaymentRecordSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    method: z.enum(['CASH', 'COD', 'BANK_TRANSFER']),
    purpose: z.enum(['DEPOSIT', 'BALANCE', 'FULL', 'REFUND']),
    amount: z.number().int().min(1, 'Số tiền phải lớn hơn 0').max(Number.MAX_SAFE_INTEGER),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'COD' && data.purpose === 'REFUND') {
      ctx.addIssue({ code: 'custom', path: ['method'], message: 'Không hoàn tiền bằng COD' });
    }
  });
export type PaymentRecordInput = z.infer<typeof PaymentRecordSchema>;

export const PaymentCancelSchema = z.object({
  expectedVersion: z.number().int().min(1),
  reason: z.string().trim().min(1, 'Chưa nhập lý do hủy khoản thu').max(500),
});
export type PaymentCancelInput = z.infer<typeof PaymentCancelSchema>;

// ---------- Serial đã giao ----------

/** Khớp CHECK serial của database: viết hoa, chữ số và . _ / - */
export const ORDER_SERIAL_PATTERN = /^[A-Z0-9][A-Z0-9._/-]*$/;

export const OrderLineSerialsSchema = z.object({
  serialNumbers: z
    .array(
      z
        .string()
        .transform((value) => value.trim().toUpperCase())
        .pipe(z.string().min(1).max(100).regex(ORDER_SERIAL_PATTERN, 'Serial chỉ gồm chữ, số và . _ / -')),
    )
    .max(999),
});
export type OrderLineSerialsInput = z.infer<typeof OrderLineSerialsSchema>;

// ---------- Sửa sản phẩm trong đơn, tra cứu khách ----------

/** Thay toàn bộ danh sách sản phẩm (chỉ trước bước Đã đặt hãng) */
export const OrderLinesReplaceSchema = z.object({
  expectedVersion: z.number().int().min(1),
  lines: z.array(OrderLineInputSchema).min(1, 'Đơn phải có ít nhất một sản phẩm').max(50),
});
export type OrderLinesReplaceInput = z.infer<typeof OrderLinesReplaceSchema>;

/** Trạng thái còn sửa được sản phẩm: đặt hãng rồi mà đổi thì hàng về không khớp đơn */
export const ORDER_LINES_EDITABLE_STATUSES: readonly OrderStatusValue[] = ['PENDING_CONFIRMATION', 'CONFIRMED'];

export const CustomerLookupQuerySchema = z.object({ phone: VnPhoneSchema });

export interface CustomerLookupResult {
  id: string;
  fullName: string;
  phone: string | null;
  _count: { orders: number };
  lastOrder: { code: string; placedAt: string } | null;
  lastAddress: string | null;
}