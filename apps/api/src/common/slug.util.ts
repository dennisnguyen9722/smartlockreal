import { slugifyVi } from '@ktm/shared';

/**
 * Tạo slug duy nhất từ tên. Nếu trùng, thêm hậu tố -2, -3...
 * isTaken: hàm kiểm tra slug đã có trong database chưa.
 */
export async function generateUniqueSlug(
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxLength = 160,
): Promise<string> {
  const base = slugifyVi(name).slice(0, maxLength - 5) || 'muc';

  if (!(await isTaken(base))) return base;

  for (let i = 2; i <= 100; i += 1) {
    const candidate = `${base}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Rất hiếm khi tới đây; dùng hậu tố thời gian cho chắc chắn
  return `${base}-${Date.now().toString(36)}`;
}
