import { z } from 'zod';
import { ExpectedUpdatedAtSchema } from './product';

/**
 * BANNER (Bước 8): ảnh quảng cáo trên website.
 * Ảnh là media_assets (khóa ngoại): ảnh đang làm banner không xóa được ở Thư viện ảnh.
 * Banner hiện khi: đang bật VÀ (chưa có ngày bắt đầu hoặc đã tới) VÀ (chưa có ngày kết thúc hoặc chưa qua).
 */

export const BANNER_PLACEMENTS = ['HOME_HERO', 'HOME_SECONDARY', 'CATEGORY_TOP', 'POPUP'] as const;
export type BannerPlacementValue = (typeof BANNER_PLACEMENTS)[number];

export interface BannerPlacementInfo {
  label: string;
  description: string;
  /** Kích thước ảnh nên dùng (rộng × cao) */
  desktopSize: [number, number];
  mobileSize: [number, number];
}

export const BANNER_PLACEMENT_INFO: Record<BannerPlacementValue, BannerPlacementInfo> = {
  HOME_HERO: {
    label: 'Trang chủ: ảnh lớn đầu trang',
    description: 'Ảnh trượt ở đầu trang chủ. Nên 3–5 ảnh.',
    desktopSize: [1920, 640],
    mobileSize: [800, 1000],
  },
  HOME_SECONDARY: {
    label: 'Trang chủ: banner phụ',
    description: 'Các ô ảnh nhỏ giữa trang chủ (khuyến mãi, dòng sản phẩm).',
    desktopSize: [1200, 400],
    mobileSize: [800, 530],
  },
  CATEGORY_TOP: {
    label: 'Đầu trang danh mục',
    description: 'Ảnh ở đầu trang danh mục sản phẩm. Chọn danh mục, hoặc bỏ trống để hiện ở mọi danh mục.',
    desktopSize: [1600, 320],
    mobileSize: [800, 320],
  },
  POPUP: {
    label: 'Cửa sổ nổi (popup)',
    description: 'Hiện một lần khi khách vào website. Chỉ nên bật 1 popup cùng lúc.',
    desktopSize: [800, 800],
    mobileSize: [600, 800],
  },
};

/** Tình trạng tính từ isActive + thời gian (không lưu trong database) */
export type BannerState = 'RUNNING' | 'SCHEDULED' | 'EXPIRED' | 'OFF';

export const BANNER_STATE_LABEL: Record<BannerState, string> = {
  RUNNING: 'Đang chạy',
  SCHEDULED: 'Chờ tới ngày',
  EXPIRED: 'Đã hết hạn',
  OFF: 'Đã tắt',
};

export function bannerState(
  banner: { isActive: boolean; startsAt: string | Date | null; endsAt: string | Date | null },
  now = new Date(),
): BannerState {
  if (!banner.isActive) return 'OFF';
  if (banner.endsAt && new Date(banner.endsAt) <= now) return 'EXPIRED';
  if (banner.startsAt && new Date(banner.startsAt) > now) return 'SCHEDULED';
  return 'RUNNING';
}

/** Khớp CHECK banners_link_format: đường dẫn nội bộ "/..." hoặc link https:// */
const LinkSchema = z
  .string()
  .trim()
  .max(500, 'Tối đa 500 ký tự')
  .refine((value) => value === '' || value.startsWith('/') || value.startsWith('https://'), {
    message: 'Link bắt đầu bằng / (trang trong website) hoặc https://',
  })
  .transform((value) => (value === '' ? null : value));

const BannerFields = {
  title: z.string().trim().min(1, 'Chưa nhập tên banner').max(200, 'Tối đa 200 ký tự'),
  placement: z.enum(BANNER_PLACEMENTS, 'Chưa chọn vị trí'),
  desktopMediaId: z.uuid('Chưa có ảnh cho máy tính'),
  /** Bỏ trống thì điện thoại dùng ảnh máy tính */
  mobileMediaId: z.uuid().nullable().optional(),
  linkUrl: LinkSchema.nullable().optional(),
  /** Mô tả ảnh cho Google và người khiếm thị; bỏ trống thì dùng tên banner */
  altText: z.string().trim().max(200, 'Tối đa 200 ký tự').nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.uuid().nullable().optional(),
};

function timeRangeValid(data: { startsAt?: string | null; endsAt?: string | null }) {
  return !data.startsAt || !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt);
}

export const BannerCreateSchema = z
  .object(BannerFields)
  .strict()
  .refine(timeRangeValid, { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['endsAt'] })
  .refine((data) => !data.categoryId || data.placement === 'CATEGORY_TOP', {
    message: 'Chỉ banner "Đầu trang danh mục" mới chọn danh mục',
    path: ['categoryId'],
  });
export type BannerCreateInput = z.infer<typeof BannerCreateSchema>;

export const BannerUpdateSchema = z
  .object({
    ...BannerFields,
    title: BannerFields.title.optional(),
    placement: BannerFields.placement.optional(),
    desktopMediaId: BannerFields.desktopMediaId.optional(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type BannerUpdateInput = z.infer<typeof BannerUpdateSchema>;

/** Kéo thứ tự trong một vị trí: gửi đủ id các banner của vị trí đó theo thứ tự mới */
export const BannerReorderSchema = z
  .object({
    placement: z.enum(BANNER_PLACEMENTS),
    ids: z.array(z.uuid()).min(1).max(200),
  })
  .strict();
export type BannerReorderInput = z.infer<typeof BannerReorderSchema>;

export interface BannerItem {
  id: string;
  title: string;
  placement: BannerPlacementValue;
  desktop: { id: string; url: string; width: number | null; height: number | null };
  mobile: { id: string; url: string; width: number | null; height: number | null } | null;
  linkUrl: string | null;
  altText: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  state: BannerState;
  sortOrder: number;
  category: { id: string; name: string } | null;
  updatedAt: string;
}