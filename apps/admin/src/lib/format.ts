import { formatVnd } from '@ktm/shared';

export { formatVnd };

/** Khoảng giá của sản phẩm nhiều biến thể, vd: "8.800.000 ₫ – 9.100.000 ₫" */
export function priceRange(prices: number[]): string {
  if (prices.length === 0) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
}

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  LOCK: 'Khóa',
  ACCESSORY: 'Phụ kiện',
  SERVICE: 'Dịch vụ',
  BUNDLE: 'Combo',
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang bán',
  ARCHIVED: 'Đã lưu trữ',
};

export function formatDateVn(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
