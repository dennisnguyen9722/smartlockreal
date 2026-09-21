import type { CustomerTypeValue, OrderStatusValue, QuoteStatusValue } from '@ktm/shared';

export interface QuoteListItem {
  id: string;
  code: string;
  revision: number;
  status: QuoteStatusValue;
  projectName: string | null;
  validUntil: string;
  grandTotal: number;
  referenceSubtotal: number;
  subtotal: number;
  maxDiscountBps: number;
  requiresApproval: boolean;
  createdAt: string;
  customer: { id: string; fullName: string; companyName: string | null };
  createdBy: { id: string; fullName: string } | null;
  _count: { lines: number };
}

export interface QuoteContactOption {
  id: string;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  isPrimary?: boolean;
}

/** Khớp QuoteService.getById */
export interface QuoteDetail {
  id: string;
  code: string;
  revision: number;
  status: QuoteStatusValue;
  version: number;
  customerId: string;
  contactId: string | null;
  projectName: string | null;
  siteAddress: string | null;
  validUntil: string;
  vatInvoiceRequested: boolean;
  referenceSubtotal: number;
  subtotal: number;
  shippingFee: number;
  vatTotal: number;
  grandTotal: number;
  depositRequired: number;
  savings: number;
  maxDiscountBps: number;
  requiresApproval: boolean;
  approvalThresholdBps: number;
  approvedAt: string | null;
  approvalNote: string | null;
  sentAt: string | null;
  terms: string | null;
  internalNote: string | null;
  rejectedReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    type: CustomerTypeValue;
    fullName: string;
    companyName: string | null;
    taxCode: string | null;
    phone: string | null;
    email: string | null;
    invoiceAddress: string | null;
    contacts: QuoteContactOption[];
  };
  contact: QuoteContactOption | null;
  createdBy: { id: string; fullName: string } | null;
  approvedBy: { id: string; fullName: string } | null;
  sentBy: { id: string; fullName: string } | null;
  order: { id: string; code: string; status: OrderStatusValue } | null;
  lines: {
    id: string;
    variantId: string | null;
    sku: string | null;
    name: string;
    quantity: number;
    referencePrice: number;
    unitPrice: number;
    discountBps: number;
    lineTotal: number;
    vatRateBps: number;
    vatAmount: number;
  }[];
  revisions: { id: string; revision: number; status: QuoteStatusValue; grandTotal: number; createdAt: string }[];
}

/** Điều khoản mặc định in trên báo giá (nhân viên sửa được từng báo giá) */
export const DEFAULT_QUOTE_TERMS = [
  '1. Đơn giá chưa gồm VAT; VAT được ghi riêng trong bảng tổng.',
  '2. Thời gian giao hàng: 3–7 ngày làm việc kể từ khi xác nhận đơn và nhận tiền cọc.',
  '3. Bảo hành: theo chính sách chính hãng của từng thương hiệu, tính từ ngày lắp đặt.',
  '4. Thanh toán: đặt cọc theo báo giá, thanh toán đủ khi bàn giao. Không áp dụng công nợ.',
].join('\n');