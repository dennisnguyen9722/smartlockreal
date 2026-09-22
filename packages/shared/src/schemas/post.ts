import { z } from 'zod';
import { SlugSchema } from './catalog';
import { ExpectedUpdatedAtSchema } from './product';

/**
 * BÀI VIẾT (Bước 8): tin tức, hướng dẫn chọn khóa, so sánh sản phẩm... phục vụ SEO.
 *
 * Soạn bằng TinyMCE (bản cloud, khóa NEXT_PUBLIC_TINYMCE_API_KEY). Trình duyệt gửi HTML,
 * API LỌC SẠCH bằng danh sách thẻ cho phép (apps/api/src/posts/rich-text.ts) rồi lưu vào content_html.
 * Không bao giờ tin HTML từ trình duyệt. Cột content_json (thiết kế cho trình soạn thảo dạng JSON) để trống "{}".
 */

export const POST_PATH_PREFIX = '/bai-viet';

/** Đường dẫn bài viết trên website. API (redirect khi đổi slug) và storefront PHẢI dùng hàm này */
export function postPath(slug: string): string {
  return `${POST_PATH_PREFIX}/${slug}`;
}

export type PostStatusValue = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const POST_STATUS_LABEL: Record<PostStatusValue, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã đăng',
  ARCHIVED: 'Lưu trữ',
};

/** Số sản phẩm gắn kèm tối đa ("Sản phẩm nhắc tới trong bài") */
export const POST_MAX_PRODUCTS = 12;

/** HTML tối đa ~500 KB: đủ cho bài rất dài. Ảnh luôn là link tới Thư viện ảnh, không nhúng base64 */
export const POST_MAX_CONTENT_LENGTH = 500_000;

/** Chữ thuần từ HTML (đếm chữ, kiểm tra bài trống). Chỉ dùng cho HTML đã lọc sạch */
export function htmlPlainText(html: string): string {
  return html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/td|\/th|\/blockquote|\/figcaption)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const OptionalText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự`).nullable().optional();

// ---------- Chuyên mục ----------

export const PostCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Chưa nhập tên chuyên mục').max(120),
    /** Bỏ trống thì tự tạo từ tên */
    slug: SlugSchema.max(120).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();
export type PostCategoryCreateInput = z.infer<typeof PostCategoryCreateSchema>;

export const PostCategoryUpdateSchema = PostCategoryCreateSchema.partial().strict();
export type PostCategoryUpdateInput = z.infer<typeof PostCategoryUpdateSchema>;

export interface PostCategoryItem {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  postCount: number;
}

// ---------- Bài viết ----------

const PostFields = {
  title: z.string().trim().min(1, 'Chưa nhập tiêu đề').max(255, 'Tối đa 255 ký tự'),
  slug: SlugSchema.optional(),
  /** Đoạn tóm tắt ở danh sách bài; bỏ trống thì website tự lấy đầu bài */
  excerpt: OptionalText(500),
  /** HTML từ TinyMCE; API lọc sạch trước khi lưu */
  content: z.string().max(POST_MAX_CONTENT_LENGTH, 'Nội dung quá dài, hãy tách thành nhiều bài').optional(),
  categoryId: z.uuid().nullable().optional(),
  coverMediaId: z.uuid().nullable().optional(),
  seoTitle: OptionalText(200),
  seoDescription: OptionalText(320),
  /** Thứ tự theo mảng */
  productIds: z
    .array(z.uuid())
    .max(POST_MAX_PRODUCTS, `Tối đa ${POST_MAX_PRODUCTS} sản phẩm`)
    .refine((ids) => new Set(ids).size === ids.length, 'Sản phẩm bị trùng')
    .optional(),
};

export const PostCreateSchema = z.object(PostFields).strict();
export type PostCreateInput = z.infer<typeof PostCreateSchema>;

export const PostUpdateSchema = z
  .object({ ...PostFields, title: PostFields.title.optional(), expectedUpdatedAt: ExpectedUpdatedAtSchema })
  .strict();
export type PostUpdateInput = z.infer<typeof PostUpdateSchema>;

/**
 * Đổi trạng thái:
 * - PUBLISH: đăng ngay, hoặc hẹn giờ nếu có publishAt trong tương lai
 * - UNPUBLISH: gỡ về Nháp
 * - ARCHIVE: lưu trữ (ẩn khỏi website, giữ link cũ để sau này đăng lại)
 * - RESTORE: từ Lưu trữ về Nháp
 */
export const PostStatusActionSchema = z
  .object({
    action: z.enum(['PUBLISH', 'UNPUBLISH', 'ARCHIVE', 'RESTORE']),
    publishAt: z.iso.datetime({ offset: true }).optional(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type PostStatusActionInput = z.infer<typeof PostStatusActionSchema>;

export const PostListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(['ALL', 'DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).default('ALL'),
  categoryId: z.uuid().optional(),
});
export type PostListQuery = z.infer<typeof PostListQuerySchema>;

/** SCHEDULED = đã bấm đăng nhưng publishedAt còn ở tương lai (website chưa hiện) */
export type PostListStatus = PostListQuery['status'];
export type PostStatusCounts = Record<PostListStatus, number>;

export interface PostListItem {
  id: string;
  title: string;
  slug: string;
  status: PostStatusValue;
  /** Đã bấm đăng nhưng chưa tới giờ */
  scheduled: boolean;
  publishedAt: string | null;
  updatedAt: string;
  category: { id: string; name: string } | null;
  coverUrl: string | null;
  author: { id: string; fullName: string } | null;
}

export interface PostDetail extends PostListItem {
  excerpt: string | null;
  /** HTML đã lọc sạch (mở lại trong TinyMCE để sửa tiếp) */
  content: string;
  categoryId: string | null;
  coverMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  products: { id: string; name: string; slug: string; status: string; coverUrl: string | null }[];
  /** Còn thiếu gì để đăng (rỗng = đăng được) */
  missing: string[];
  wordCount: number;
}