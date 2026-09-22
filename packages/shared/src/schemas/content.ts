import { z } from 'zod';
import { SlugSchema } from './catalog';
import { ExpectedUpdatedAtSchema } from './product';
import { POST_MAX_CONTENT_LENGTH, type PostStatusValue } from './post';

/**
 * NỘI DUNG TĨNH (Bước 8): trang tĩnh, chính sách, câu hỏi thường gặp.
 * Nội dung soạn bằng TinyMCE; API lọc HTML bằng cùng bộ lọc với bài viết (apps/api/src/common/rich-text.ts).
 */

const HtmlSchema = z.string().max(POST_MAX_CONTENT_LENGTH, 'Nội dung quá dài');
const OptionalText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự`).nullable().optional();

// =====================================================================
// TRANG TĨNH: Giới thiệu, Liên hệ, Tuyển dụng...
// =====================================================================

/**
 * Trang tĩnh nằm ngay dưới tên miền (/gioi-thieu) cho gọn và tốt cho SEO,
 * nên KHÔNG được trùng đường dẫn các khu vực khác của website.
 */
export const PAGE_RESERVED_SLUGS = [
  'san-pham',
  'danh-muc',
  'hang',
  'bai-viet',
  'showroom',
  'chinh-sach',
  'cau-hoi-thuong-gap',
  'gio-hang',
  'thanh-toan',
  'dat-hang',
  'don-hang',
  'tai-khoan',
  'dang-nhap',
  'dang-ky',
  'tim-kiem',
  'khuyen-mai',
  'bao-hanh',
  'so-sanh',
  'api',
  'media',
  'admin',
] as const;

export function pagePath(slug: string): string {
  return `/${slug}`;
}

const PageSlugSchema = SlugSchema.refine((slug) => !(PAGE_RESERVED_SLUGS as readonly string[]).includes(slug), {
  message: 'Đường dẫn này dành cho khu vực khác của website, hãy chọn tên khác',
});

const PageFields = {
  title: z.string().trim().min(1, 'Chưa nhập tiêu đề').max(255, 'Tối đa 255 ký tự'),
  slug: PageSlugSchema.optional(),
  content: HtmlSchema.optional(),
  seoTitle: OptionalText(200),
  seoDescription: OptionalText(320),
};

export const PageCreateSchema = z.object(PageFields).strict();
export type PageCreateInput = z.infer<typeof PageCreateSchema>;

export const PageUpdateSchema = z
  .object({ ...PageFields, title: PageFields.title.optional(), expectedUpdatedAt: ExpectedUpdatedAtSchema })
  .strict();
export type PageUpdateInput = z.infer<typeof PageUpdateSchema>;

/** Trang tĩnh không hẹn giờ (khác bài viết) */
export const PageStatusActionSchema = z
  .object({ action: z.enum(['PUBLISH', 'UNPUBLISH', 'ARCHIVE', 'RESTORE']), expectedUpdatedAt: ExpectedUpdatedAtSchema })
  .strict();
export type PageStatusActionInput = z.infer<typeof PageStatusActionSchema>;

export interface PageListItem {
  id: string;
  title: string;
  slug: string;
  status: PostStatusValue;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: { id: string; fullName: string } | null;
}

export interface PageDetail extends PageListItem {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  missing: string[];
  wordCount: number;
}

// =====================================================================
// CHÍNH SÁCH: mỗi lần sửa là một PHIÊN BẢN MỚI, không sửa/xóa bản cũ
// =====================================================================

/**
 * Bảng policy_versions có trigger chặn UPDATE/DELETE: bản khách đã đồng ý phải còn nguyên để đối chiếu
 * (quy định bảo vệ dữ liệu cá nhân, tranh chấp đổi trả). Website hiện bản mới nhất đã tới ngày hiệu lực.
 */
export const POLICY_CODES = ['PRIVACY', 'TERMS', 'WARRANTY', 'RETURN', 'SHIPPING', 'PAYMENT'] as const;
export type PolicyCode = (typeof POLICY_CODES)[number];

export const POLICY_INFO: Record<PolicyCode, { label: string; slug: string; hint: string }> = {
  PRIVACY: {
    label: 'Chính sách bảo vệ dữ liệu cá nhân',
    slug: 'bao-mat-thong-tin',
    hint: 'Khách đồng ý khi đặt hàng; hệ thống ghi lại phiên bản khách đã đồng ý.',
  },
  TERMS: { label: 'Điều khoản sử dụng', slug: 'dieu-khoan-su-dung', hint: 'Điều khoản chung khi dùng website và mua hàng.' },
  WARRANTY: { label: 'Chính sách bảo hành', slug: 'bao-hanh', hint: 'Thời hạn, điều kiện bảo hành; bảo hành do hãng thực hiện.' },
  RETURN: { label: 'Chính sách đổi trả', slug: 'doi-tra', hint: 'Điều kiện và thời hạn đổi trả hàng.' },
  SHIPPING: { label: 'Chính sách giao hàng và lắp đặt', slug: 'giao-hang-lap-dat', hint: 'Phí, thời gian giao và lắp đặt.' },
  PAYMENT: { label: 'Chính sách thanh toán', slug: 'thanh-toan', hint: 'Các hình thức thanh toán, đặt cọc.' },
};

export function policyPath(code: PolicyCode): string {
  return `/chinh-sach/${POLICY_INFO[code].slug}`;
}

/** Gợi ý số phiên bản theo tháng: "2026-09", trùng thì "2026-09-2" */
export function suggestPolicyVersion(existing: string[], now = new Date()): string {
  const base = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .format(now)
    .slice(0, 7);
  if (!existing.includes(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`.slice(0, 20);
}

export const PolicyVersionCreateSchema = z
  .object({
    code: z.enum(POLICY_CODES),
    version: z
      .string()
      .trim()
      .min(1, 'Chưa nhập số phiên bản')
      .max(20, 'Tối đa 20 ký tự')
      .regex(/^[0-9A-Za-z][0-9A-Za-z.-]*$/, 'Chỉ dùng chữ, số, dấu chấm và gạch ngang, vd 2026-09'),
    title: z.string().trim().min(1, 'Chưa nhập tiêu đề').max(255),
    content: HtmlSchema,
    /** Bỏ trống = có hiệu lực ngay. Có thể đặt ngày trong tương lai (báo trước cho khách) */
    effectiveAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type PolicyVersionCreateInput = z.infer<typeof PolicyVersionCreateSchema>;

export interface PolicyVersionItem {
  id: string;
  code: PolicyCode;
  version: string;
  title: string;
  effectiveAt: string;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
  /** Bản website đang hiện */
  isCurrent: boolean;
  /** Chưa tới ngày hiệu lực */
  isUpcoming: boolean;
}

export interface PolicyVersionDetail extends PolicyVersionItem {
  content: string;
}

export interface PolicySummary {
  code: PolicyCode;
  current: PolicyVersionItem | null;
  upcoming: PolicyVersionItem | null;
  versionCount: number;
}

// =====================================================================
// CÂU HỎI THƯỜNG GẶP
// =====================================================================

export const FAQ_GROUPS = ['MUA_HANG', 'THANH_TOAN', 'GIAO_LAP', 'BAO_HANH', 'SU_DUNG'] as const;
export type FaqGroupCode = (typeof FAQ_GROUPS)[number];

export const FAQ_GROUP_LABEL: Record<FaqGroupCode, string> = {
  MUA_HANG: 'Mua hàng',
  THANH_TOAN: 'Thanh toán',
  GIAO_LAP: 'Giao hàng và lắp đặt',
  BAO_HANH: 'Bảo hành',
  SU_DUNG: 'Sử dụng khóa',
};

/** Câu trả lời ngắn hơn bài viết */
const FAQ_MAX_ANSWER_LENGTH = 20_000;

const FaqFields = {
  groupCode: z.enum(FAQ_GROUPS, 'Chưa chọn nhóm'),
  question: z.string().trim().min(1, 'Chưa nhập câu hỏi').max(500, 'Tối đa 500 ký tự'),
  answer: z.string().max(FAQ_MAX_ANSWER_LENGTH, 'Câu trả lời quá dài, nên viết thành bài viết'),
  /** Gắn vào một sản phẩm (hiện ở trang sản phẩm); null = câu hỏi chung */
  productId: z.uuid().nullable().optional(),
  isPublished: z.boolean().optional(),
};

export const FaqCreateSchema = z.object(FaqFields).strict();
export type FaqCreateInput = z.infer<typeof FaqCreateSchema>;

export const FaqUpdateSchema = z
  .object({
    ...FaqFields,
    groupCode: FaqFields.groupCode.optional(),
    question: FaqFields.question.optional(),
    answer: FaqFields.answer.optional(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type FaqUpdateInput = z.infer<typeof FaqUpdateSchema>;

/** Sắp xếp trong một nhóm câu hỏi chung, hoặc trong các câu hỏi của một sản phẩm */
export const FaqReorderSchema = z
  .object({
    groupCode: z.enum(FAQ_GROUPS).optional(),
    productId: z.uuid().optional(),
    ids: z.array(z.uuid()).min(1).max(500),
  })
  .strict()
  .refine((data) => Boolean(data.groupCode) !== Boolean(data.productId), 'Chọn một nhóm hoặc một sản phẩm');
export type FaqReorderInput = z.infer<typeof FaqReorderSchema>;

export const FaqListQuerySchema = z.object({
  groupCode: z.enum(FAQ_GROUPS).optional(),
  productId: z.uuid().optional(),
  /** true: chỉ câu hỏi gắn sản phẩm; false: chỉ câu hỏi chung */
  scope: z.enum(['GENERAL', 'PRODUCT', 'ALL']).default('ALL'),
  search: z.string().trim().max(200).optional(),
});
export type FaqListQuery = z.infer<typeof FaqListQuerySchema>;

export interface FaqItem {
  id: string;
  groupCode: FaqGroupCode;
  question: string;
  answer: string;
  product: { id: string; name: string } | null;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
}