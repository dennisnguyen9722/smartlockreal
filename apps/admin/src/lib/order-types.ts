import type {
  FulfillmentTypeValue,
  OrderStatusValue,
  PaymentMethodValue,
  PaymentPurposeValue,
  SalesChannelValue,
} from '@ktm/shared';

/** Khớp OrderWorkflowService.getById (API đã đổi BigInt sang số) */
export interface OrderDetail {
  id: string;
  code: string;
  channel: SalesChannelValue;
  status: OrderStatusValue;
  fulfillmentType: FulfillmentTypeValue;
  version: number;

  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customer: { id: string; fullName: string; phone: string | null; type: string; _count: { orders: number } } | null;

  fulfillmentLocationId: string | null;
  fulfillmentLocation: { id: string; name: string; address: string } | null;
  shipAddressRaw: string | null;
  shipRecipientName: string | null;
  shipRecipientPhone: string | null;
  shipProvinceCode: string | null;
  shipProvinceName: string | null;
  shipWardCode: string | null;
  shipWardName: string | null;
  shipStreet: string | null;
  shipRegion: 'HCM' | 'HN' | null;

  brandOrderRef: string | null;
  brandOrderedAt: string | null;
  goodsArrivedAt: string | null;
  scheduledAt: string | null;
  brandTechnicianNote: string | null;

  vatInvoiceRequested: boolean;
  invoiceBuyerName: string | null;
  invoiceCompanyName: string | null;
  invoiceTaxCode: string | null;
  invoiceAddress: string | null;
  invoiceEmail: string | null;

  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  vatTotal: number;
  grandTotal: number;
  paidTotal: number;
  depositRequired: number;
  balanceDue: number;

  customerNote: string | null;
  internalNote: string | null;
  placedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;

  assignedStaff: { id: string; fullName: string } | null;
  createdBy: { id: string; fullName: string } | null;

  lines: {
    id: string;
    variantId: string | null;
    sku: string | null;
    name: string;
    quantity: number;
    listPrice: number;
    unitPrice: number;
    priceSource: string;
    lineTotal: number;
    vatRateBps: number;
    vatAmount: number;
    serialNumbers: string[] | null;
  }[];
  payments: {
    id: string;
    method: PaymentMethodValue;
    purpose: PaymentPurposeValue;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
    amount: number;
    transferContent: string | null;
    paidAt: string | null;
    note: string | null;
    createdAt: string;
    receivedBy: { id: string; fullName: string } | null;
  }[];
  statusHistory: {
    id: string;
    fromStatus: OrderStatusValue | null;
    toStatus: OrderStatusValue;
    note: string | null;
    createdAt: string;
    staff: { id: string; fullName: string } | null;
  }[];

  allowedTransitions: OrderStatusValue[];
  nextStepBlockers: { field: string; message: string }[];
}

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTimeVn(value: string | null | undefined): string {
  return value ? DATE_TIME.format(new Date(value)) : '—';
}

/** ISO -> giá trị cho <input type="datetime-local"> theo giờ Việt Nam */
export function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Giá trị <input type="datetime-local"> (giờ Việt Nam) -> ISO */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null;
}