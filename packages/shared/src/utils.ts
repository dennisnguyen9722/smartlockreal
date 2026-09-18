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
/** Giá trị chuyển được sang JSON. Dùng cho các cột JSON trong database. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/**
 * Chuyển object bất kỳ thành dữ liệu JSON an toàn:
 * BigInt -> chuỗi, Date -> ISO, undefined và hàm bị loại bỏ.
 * Cần thiết vì dự án dùng BigInt cho tiền, mà JSON không hỗ trợ BigInt.
 */
export function toJsonSafe(value: unknown): JsonValue {
  if (value === null) return null;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : null;
    case 'bigint':
      return value.toString();
    case 'undefined':
    case 'function':
    case 'symbol':
      return null;
  }

  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);

  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined || typeof item === 'function') continue;
    result[key] = toJsonSafe(item);
  }
  return result;
}

/** Kích thước ảnh: nhỏ (danh sách), vừa (trang sản phẩm), lớn (xem chi tiết) */
export type ImageSize = 'sm' | 'md' | 'lg';

/**
 * Lấy đường dẫn ảnh theo kích thước.
 * Ảnh lưu theo quy ước: <hash>.webp (lớn), <hash>_md.webp, <hash>_sm.webp
 */
export function imageUrl(url: string, size: ImageSize = 'md'): string {
  if (size === 'lg') return url;
  return url.replace(/\.webp$/, `_${size}.webp`);
}
