import { z } from 'zod';

/**
 * Hợp đồng dữ liệu giữa API công khai và storefront.
 * Mọi số tiền ở đây là SỐ NGUYÊN ĐỒNG dạng number (không phải BigInt),
 * vì JSON không gửi được BigInt. Giá VND lớn nhất cũng chưa tới 2^53 nên an toàn.
 */

export const STOREFRONT_SORTS = ['moi-nhat', 'gia-tang', 'gia-giam', 'ban-chay'] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export const STOREFRONT_SORT_LABEL: Record<StorefrontSort, string> = {
  'moi-nhat': 'Mới nhất',
  'gia-tang': 'Giá thấp đến cao',
  'gia-giam': 'Giá cao đến thấp',
  'ban-chay': 'Bán chạy',
};

const SlugParam = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Đường dẫn không hợp lệ');

export const StorefrontListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
  /** Lọc theo đường dẫn, không phải id — để URL đọc được và lên Google */
  doorType: SlugParam.optional(),
  brand: SlugParam.optional(),
  category: SlugParam.optional(),
  q: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(STOREFRONT_SORTS).default('moi-nhat'),
});

export const StorefrontSlugSchema = z.object({ slug: SlugParam });

export type StorefrontListQuery = z.infer<typeof StorefrontListQuerySchema>;

export interface StorefrontTaxonomy {
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
}

export interface StorefrontCard {
  slug: string;
  name: string;
  brandName: string | null;
  categoryName: string;
  doorTypeSlugs: string[];
  /** Giá thấp nhất trong các biến thể đang bán */
  priceFrom: number;
  /** Giá gạch ngang của biến thể rẻ nhất, null nếu không giảm */
  compareAtPrice: number | null;
  variantCount: number;
  /** Màu để hiện chấm tròn trên thẻ sản phẩm */
  colorLabels: string[];
  imageUrl: string | null;
  warrantyMonths: number;
}

export interface StorefrontVariant {
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  optionValues: Record<string, string>;
  imageUrl: string | null;
}

export interface StorefrontOption {
  code: string;
  name: string;
  values: { code: string; value: string }[];
}

export interface StorefrontProduct {
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  brand: { slug: string; name: string } | null;
  category: { slug: string; name: string };
  doorTypes: { slug: string; name: string }[];
  warrantyMonths: number;
  specs: { name: string; value: string }[];
  highlights: { title: string; items: string[] }[];
  images: string[];
  options: StorefrontOption[];
  variants: StorefrontVariant[];
  priceFrom: number;
  seoTitle: string | null;
  seoDescription: string | null;
  ratingCount: number;
  ratingAverage: number | null;
}

export interface StorefrontShowroom {
  slug: string;
  name: string;
  address: string;
  phone: string | null;
  /** Các dòng giờ mở cửa đã gộp sẵn, vd: "Thứ Hai – Thứ Sáu: 08:00–21:00" */
  openingHours: string[];
  imageUrl: string | null;
  /** Link mở Google Maps chỉ đường; null khi showroom chưa có tọa độ */
  directionsUrl: string | null;
  region: 'HCM' | 'HN';
}

export interface StorefrontReview {
  reviewerName: string;
  rating: number;
  content: string | null;
  photoUrls: string[];
  /** Số điện thoại khớp một đơn đã hoàn tất có sản phẩm này */
  verifiedPurchase: boolean;
  createdAt: string;
  product: { slug: string; name: string };
}

export interface StorefrontPost {
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  categoryName: string | null;
  publishedAt: string | null;
}

export interface StorefrontFaq {
  question: string;
  answerHtml: string;
  groupLabel: string;
}

export interface StorefrontBanner {
  title: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  linkUrl: string | null;
}

export interface StorefrontBrandSection {
  brand: StorefrontTaxonomy;
  products: StorefrontCard[];
}

export interface StorefrontHome {
  doorTypes: StorefrontTaxonomy[];
  brands: StorefrontTaxonomy[];
  /** Banner lớn đầu trang (HOME_HERO) */
  banners: StorefrontBanner[];
  /** Banner khuyến mãi giữa trang (HOME_SECONDARY) */
  promoBanners: StorefrontBanner[];
  /** Khối "Sản phẩm nổi bật": do admin chọn tay, chưa chọn thì lấy hàng mới nhất */
  featured: StorefrontCard[];
  /** true khi khối nổi bật đang lấy tạm hàng mới nhất vì chưa ai chọn */
  featuredIsAuto: boolean;
  /** Mỗi hãng một dải sản phẩm riêng ở cuối trang */
  byBrand: StorefrontBrandSection[];
  showrooms: StorefrontShowroom[];
  reviews: StorefrontReview[];
  posts: StorefrontPost[];
  faqs: StorefrontFaq[];
  company: {
    name: string | null;
    hotline: string | null;
    email: string | null;
    address: string | null;
  };
  totals: {
    products: number;
    brands: number;
    showrooms: number;
    reviews: number;
    /** Điểm trung bình toàn bộ đánh giá đã duyệt, làm tròn 1 chữ số */
    ratingAverage: number | null;
  };
}


