import type { HighlightGroup } from '@ktm/shared';
import { ApiError } from '@/lib/api';
import type { ProductDetail } from '@/lib/product-types';

/**
 * Giá trị form thông tin chung. Mọi ô nhập dạng chuỗi để gõ tự nhiên;
 * chuyển sang số hoặc null khi tạo payload.
 */
export interface ProductInfoDraft {
  type: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  manufacturerCode: string;
  warrantyMonths: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  specs: Record<string, unknown>;
  highlights: HighlightGroup[];
}

export const EMPTY_INFO_DRAFT: ProductInfoDraft = {
  type: 'LOCK',
  name: '',
  slug: '',
  brandId: '',
  categoryId: '',
  manufacturerCode: '',
  warrantyMonths: '24',
  shortDescription: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
  specs: {},
  highlights: [],
};

export function draftFromProduct(product: ProductDetail): ProductInfoDraft {
  return {
    type: product.type,
    name: product.name,
    slug: product.slug,
    brandId: product.brandId ?? '',
    categoryId: product.categoryId,
    manufacturerCode: product.manufacturerCode ?? '',
    warrantyMonths: String(product.warrantyMonths),
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    specs: { ...product.specs },
    highlights: product.highlights.map((group) => ({ title: group.title, items: [...group.items] })),
  };
}

/** Bỏ nhóm trống và dòng trống trước khi gửi */
export function cleanHighlights(highlights: HighlightGroup[]): HighlightGroup[] {
  return highlights
    .map((group) => ({
      title: group.title.trim(),
      items: group.items.map((item) => item.trim()).filter(Boolean),
    }))
    .filter((group) => group.title && group.items.length > 0);
}

/** Các trường chung khi TẠO sản phẩm (chưa gồm tùy chọn và biến thể) */
export function buildCreateInfo(draft: ProductInfoDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: draft.type,
    name: draft.name.trim(),
    categoryId: draft.categoryId || undefined,
    specs: draft.specs,
    highlights: cleanHighlights(draft.highlights),
    warrantyMonths: Number(draft.warrantyMonths) || 0,
  };
  const optional = {
    slug: draft.slug,
    brandId: draft.brandId,
    manufacturerCode: draft.manufacturerCode,
    shortDescription: draft.shortDescription,
    description: draft.description,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value.trim()) body[key] = value.trim();
  }
  return body;
}

const NULLABLE_TEXT = [
  'manufacturerCode',
  'shortDescription',
  'description',
  'seoTitle',
  'seoDescription',
] as const;

/**
 * Chỉ gồm những trường KHÁC bản gốc. Rỗng = không có gì thay đổi.
 * Dùng cho cả nút Lưu lẫn việc xác định "có thay đổi chưa lưu",
 * để hai thứ không bao giờ lệch nhau.
 */
export function buildUpdatePayload(
  draft: ProductInfoDraft,
  original: ProductInfoDraft,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (draft.name.trim() !== original.name.trim()) body.name = draft.name.trim();
  if (draft.slug.trim() !== original.slug) body.slug = draft.slug.trim();
  if (draft.brandId !== original.brandId) body.brandId = draft.brandId || null;
  if (draft.categoryId !== original.categoryId) body.categoryId = draft.categoryId;

  const warranty = Number(draft.warrantyMonths) || 0;
  if (warranty !== (Number(original.warrantyMonths) || 0)) body.warrantyMonths = warranty;

  for (const key of NULLABLE_TEXT) {
    if (draft[key].trim() !== original[key].trim()) body[key] = draft[key].trim() || null;
  }

  // Đổi danh mục thì luôn gửi thông số để API kiểm tra theo khuôn mới
  if (
    draft.categoryId !== original.categoryId ||
    JSON.stringify(draft.specs) !== JSON.stringify(original.specs)
  ) {
    body.specs = draft.specs;
  }

  const highlights = cleanHighlights(draft.highlights);
  if (JSON.stringify(highlights) !== JSON.stringify(cleanHighlights(original.highlights))) {
    body.highlights = highlights;
  }

  return body;
}

/**
 * Gom lỗi từ Zod hoặc từ API về dạng { tên ô: thông báo }.
 * Lỗi của biến thể và điểm nổi bật gom về một dòng cho dễ đọc.
 */
export function collectFieldErrors(
  issues: { path: PropertyKey[] | string; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = Array.isArray(issue.path) ? issue.path.map(String).join('.') : issue.path;
    const key = path.startsWith('variants')
      ? 'variants'
      : path.startsWith('highlights')
        ? 'highlights'
        : path;
    // Giữ lỗi đầu tiên của mỗi ô
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Lấy danh sách lỗi từng ô trong details của API, nếu có */
export function apiFieldErrors(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return null;
  const items = (error.details as { field?: string; message?: string }[]).filter(
    (item) => typeof item.field === 'string' && typeof item.message === 'string',
  ) as { field: string; message: string }[];
  if (items.length === 0) return null;
  return collectFieldErrors(items.map((item) => ({ path: item.field, message: item.message })));
}