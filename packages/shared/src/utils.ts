/**
 * Tạo slug tiếng Việt cho URL.
 * Ví dụ: "Khóa vân tay Đa năng SHP-DP609" -> "khoa-van-tay-da-nang-shp-dp609"
 */
export function slugifyVi(input: string): string {
  return input
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const vndNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/**
 * Định dạng tiền VND để hiển thị. Tiền luôn lưu dạng số nguyên.
 * Ví dụ: 12500000 -> "12.500.000 ₫"
 */
export function formatVnd(amount: number | bigint): string {
  return `${vndNumber.format(amount)}\u00A0₫`;
}