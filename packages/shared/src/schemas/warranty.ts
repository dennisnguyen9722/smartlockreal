import { z } from 'zod';
import type { OrderStatusValue } from './order';

/**
 * TRA CỨU BẢO HÀNH
 *
 * Bảo hành do hãng làm; công ty chỉ cần tìm ra máy nào, serial gì, giao ngày nào để báo hãng.
 * Dữ liệu lấy thẳng từ đơn hàng (order_lines.serial_numbers). Các bảng warranties/serial_units
 * gắn với kho nên KHÔNG dùng (công ty không giữ kho, quyết định ở Bước 6).
 */

/** Serial khớp CHECK database: viết hoa, chữ số và . _ / - ; tra cứu cho phép gõ một phần */
const SERIAL_SEARCH_PATTERN = /^[A-Z0-9._/-]{4,100}$/;

export const WarrantyLookupQuerySchema = z.object({
  q: z.string().trim().min(3, 'Nhập ít nhất 3 ký tự').max(100, 'Tối đa 100 ký tự'),
});
export type WarrantyLookupQuery = z.infer<typeof WarrantyLookupQuerySchema>;

/** Chuẩn hóa chuỗi gõ vào để tìm serial: bỏ khoảng trắng, viết hoa. Không hợp lệ -> null */
export function normalizeSerialSearch(raw: string): string | null {
  const value = raw.replace(/\s+/g, '').toUpperCase();
  return SERIAL_SEARCH_PATTERN.test(value) ? value : null;
}

/** "dh260922-0001", "DH 260922 0001", "DH2609220001" -> "DH-260922-0001" */
export function normalizeOrderCodeSearch(raw: string): string | null {
  const match = raw.replace(/\s+/g, '').toUpperCase().match(/^DH-?(\d{6})-?(\d{4})$/);
  return match ? `DH-${match[1]}-${match[2]}` : null;
}

/**
 * Tình trạng bảo hành ƯỚC TÍNH theo số tháng bảo hành hiện tại của sản phẩm, tính từ ngày hoàn tất đơn.
 * Hãng mới là bên quyết định cuối cùng.
 */
export type WarrantyState =
  /** Đơn chưa hoàn tất (chưa giao lắp xong) */
  | 'NOT_DELIVERED'
  /** Sản phẩm chưa khai báo số tháng bảo hành */
  | 'UNKNOWN'
  | 'ACTIVE'
  | 'EXPIRED';

export const WARRANTY_STATE_LABEL: Record<WarrantyState, string> = {
  NOT_DELIVERED: 'Chưa giao',
  UNKNOWN: 'Chưa rõ thời hạn',
  ACTIVE: 'Còn bảo hành',
  EXPIRED: 'Hết bảo hành',
};

/** Cách tìm ra đơn: để giao diện giải thích vì sao đơn này hiện ra */
export type WarrantyMatch = 'PHONE' | 'SERIAL' | 'ORDER_CODE';

export interface WarrantyDevice {
  lineId: string;
  name: string;
  sku: string | null;
  brandName: string | null;
  quantity: number;
  serialNumbers: string[];
  /** Serial khớp với chuỗi tìm (để tô đậm) */
  matchedSerials: string[];
  /** 0 = sản phẩm chưa khai báo */
  warrantyMonths: number;
  /** yyyy-mm-dd theo giờ Việt Nam; null khi đơn chưa hoàn tất */
  startsOn: string | null;
  endsOn: string | null;
  state: WarrantyState;
}

export interface WarrantyOrder {
  orderId: string;
  orderCode: string;
  status: OrderStatusValue;
  matchedBy: WarrantyMatch[];
  placedAt: string;
  completedAt: string | null;
  /** Ngày hoàn tất theo giờ Việt Nam (yyyy-mm-dd) = ngày bắt đầu tính bảo hành */
  completedOn: string | null;
  customer: {
    id: string | null;
    name: string;
    companyName: string | null;
    phone: string | null;
  };
  /** Địa chỉ lắp đặt: địa chỉ chuẩn nếu có, không thì địa chỉ khách tự gõ */
  address: string | null;
  brandTechnicianNote: string | null;
  devices: WarrantyDevice[];
}

export interface WarrantyLookupResult {
  query: string;
  /** Chuỗi tìm được hiểu là gì (để giao diện nói rõ) */
  interpretedAs: { phone: string | null; serial: string | null; orderCode: string | null };
  orders: WarrantyOrder[];
  /** Có nhiều hơn số đơn trả về: nên tìm cụ thể hơn */
  truncated: boolean;
}