import { imageUrl } from '@ktm/shared';
import type {
  Paginated,
  StorefrontCard,
  StorefrontHome,
  StorefrontPost,
  StorefrontPostDetail,
  StorefrontPostList,
  StorefrontPolicy,
  StorefrontPolicyDetail,
  StorefrontProduct,
  StorefrontShowroom,
  StorefrontShowroomDetail,
  StorefrontTaxonomy,
} from '@ktm/shared';

/**
 * Gọi API công khai từ phía máy chủ.
 * Toàn bộ trang website đều dựng sẵn ở máy chủ rồi mới gửi về trình duyệt —
 * Google đọc được nội dung ngay trong HTML, không phải chờ JavaScript chạy.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Trang được dựng lại sau ngần này giây; trong khoảng đó khách xem bản đã lưu */
const LAM_MOI_SAU = 60;

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function doc<T>(duongDan: string, revalidate = LAM_MOI_SAU): Promise<T> {
  const res = await fetch(`${API_URL}${duongDan}`, {
    next: { revalidate },
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    let thongBao = `API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) thongBao = body.message;
    } catch {
      // Phản hồi không phải JSON, giữ nguyên thông báo theo mã lỗi
    }
    throw new ApiError(res.status, thongBao);
  }

  return (await res.json()) as T;
}

/** Trả về null khi 404, để trang gọi notFound() thay vì vỡ */
async function docCoThe<T>(duongDan: string, revalidate = LAM_MOI_SAU): Promise<T | null> {
  try {
    return await doc<T>(duongDan, revalidate);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export interface DanhSachSanPham extends Paginated<StorefrontCard> {
  appliedFilters: { doorType?: StorefrontTaxonomy };
}

/* ======================= Chuẩn hóa dữ liệu từ API ======================= */

/**
 * `await res.json() as T` là một LỜI KHAI, không phải một phép kiểm tra.
 * TypeScript tin lời khai đó, nhưng lúc chạy thật dữ liệu có thể thiếu trường:
 * API đang chạy bản cũ chưa khởi động lại, API lỗi trả về hình dạng khác,
 * hoặc sau này API bỏ bớt trường. Khi đó trang vỡ ngay dòng đầu tiên đụng tới.
 *
 * Vì vậy mọi thứ từ /public/home đều đi qua đây trước. Thiếu mảng thì thành
 * mảng rỗng (khối tự ẩn), thiếu số thì thành 0, thiếu điểm đánh giá thì thành
 * null. Trang luôn dựng được, cùng lắm là hiện ít đi.
 */
function mang<T>(giaTri: unknown): T[] {
  return Array.isArray(giaTri) ? (giaTri as T[]) : [];
}

function so(giaTri: unknown, macDinh = 0): number {
  return typeof giaTri === 'number' && Number.isFinite(giaTri) ? giaTri : macDinh;
}

function soHoacNull(giaTri: unknown): number | null {
  return typeof giaTri === 'number' && Number.isFinite(giaTri) ? giaTri : null;
}

function chuoiHoacNull(giaTri: unknown): string | null {
  return typeof giaTri === 'string' && giaTri.trim().length > 0 ? giaTri : null;
}

function chuanHoaTrangChu(tho: unknown): StorefrontHome {
  const goc = (tho ?? {}) as Record<string, unknown>;
  const congTy = (goc.company ?? {}) as Record<string, unknown>;
  const tong = (goc.totals ?? {}) as Record<string, unknown>;

  return {
    doorTypes: mang(goc.doorTypes),
    brands: mang(goc.brands),
    banners: mang(goc.banners),
    promoBanners: mang(goc.promoBanners),
    featured: mang(goc.featured),
    featuredIsAuto: goc.featuredIsAuto === true,
    byBrand: mang(goc.byBrand),
    showrooms: mang(goc.showrooms),
    reviews: mang(goc.reviews),
    posts: mang(goc.posts),
    faqs: mang(goc.faqs),
    company: {
      name: chuoiHoacNull(congTy.name),
      hotline: chuoiHoacNull(congTy.hotline),
      email: chuoiHoacNull(congTy.email),
      address: chuoiHoacNull(congTy.address),
    },
    totals: {
      products: so(tong.products),
      brands: so(tong.brands),
      showrooms: so(tong.showrooms),
      reviews: so(tong.reviews),
      ratingAverage: soHoacNull(tong.ratingAverage),
    },
  };
}

export async function layTrangChu(): Promise<StorefrontHome> {
  return chuanHoaTrangChu(await doc<unknown>('/public/home'));
}

export function layLoaiCua(): Promise<StorefrontTaxonomy[]> {
  return doc<StorefrontTaxonomy[]>('/public/door-types', 300);
}

function chuanHoaDanhSach(tho: unknown): DanhSachSanPham {
  const goc = (tho ?? {}) as Record<string, unknown>;
  const loc = (goc.appliedFilters ?? {}) as Record<string, unknown>;
  const loaiCua = loc.doorType;

  return {
    items: mang<StorefrontCard>(goc.items),
    total: so(goc.total),
    page: so(goc.page, 1),
    pageSize: so(goc.pageSize, 24),
    appliedFilters:
      loaiCua && typeof loaiCua === 'object'
        ? { doorType: loaiCua as StorefrontTaxonomy }
        : {},
  };
}

function chuanHoaSanPham(tho: unknown): StorefrontProduct | null {
  const goc = (tho ?? {}) as Record<string, unknown>;
  // Không có slug và tên thì không phải sản phẩm, coi như không tìm thấy
  if (typeof goc.slug !== 'string' || typeof goc.name !== 'string') return null;

  const danhMuc = (goc.category ?? {}) as Record<string, unknown>;
  const hang = goc.brand as Record<string, unknown> | null | undefined;

  return {
    slug: goc.slug,
    name: goc.name,
    shortDescription: chuoiHoacNull(goc.shortDescription),
    description: chuoiHoacNull(goc.description),
    brand:
      hang && typeof hang === 'object' && typeof hang.slug === 'string'
        ? { slug: hang.slug, name: String(hang.name ?? '') }
        : null,
    category: {
      slug: typeof danhMuc.slug === 'string' ? danhMuc.slug : '',
      name: typeof danhMuc.name === 'string' ? danhMuc.name : '',
    },
    doorTypes: mang(goc.doorTypes),
    warrantyMonths: so(goc.warrantyMonths),
    specs: mang(goc.specs),
    highlights: mang(goc.highlights),
    images: mang<string>(goc.images),
    options: mang(goc.options),
    variants: mang(goc.variants),
    priceFrom: so(goc.priceFrom),
    seoTitle: chuoiHoacNull(goc.seoTitle),
    seoDescription: chuoiHoacNull(goc.seoDescription),
    ratingCount: so(goc.ratingCount),
    ratingAverage: soHoacNull(goc.ratingAverage),
  };
}

export async function timSanPham(
  thamSo: Record<string, string | number | undefined>,
): Promise<DanhSachSanPham> {
  const query = new URLSearchParams();
  for (const [khoa, giaTri] of Object.entries(thamSo)) {
    if (giaTri !== undefined && giaTri !== '') query.set(khoa, String(giaTri));
  }
  const chuoi = query.toString();
  return chuanHoaDanhSach(await doc<unknown>(`/public/products${chuoi ? `?${chuoi}` : ''}`));
}

/** Trả về null khi không có sản phẩm, để trang gọi notFound() */
export async function laySanPham(slug: string): Promise<StorefrontProduct | null> {
  const tho = await docCoThe<unknown>(`/public/products/${slug}`);
  return tho === null ? null : chuanHoaSanPham(tho);
}

/**
 * Danh sách sản phẩm có thể lỗi mạng giữa chừng. Trang danh sách thà hiện
 * "không tìm thấy sản phẩm nào" còn hơn trắng màn hình.
 */
export async function timSanPhamAnToan(
  thamSo: Record<string, string | number | undefined>,
): Promise<DanhSachSanPham> {
  try {
    return await timSanPham(thamSo);
  } catch (error) {
    console.error('[web] Không lấy được danh sách sản phẩm:', error);
    return { items: [], total: 0, page: 1, pageSize: 24, appliedFilters: {} };
  }
}

/**
 * Dữ liệu dùng chung cho thanh điều hướng và chân trang.
 * Lấy từ /public/home nên Next.js gộp chung một lần gọi với trang chủ.
 * Có bọc try/catch: API chết thì website vẫn hiện được chứ không trắng trang.
 */
export interface DuLieuChung {
  loaiCua: StorefrontTaxonomy[];
  congTy: StorefrontHome['company'];
}

const CHUNG_DU_PHONG: DuLieuChung = {
  loaiCua: [],
  congTy: {
    name: 'Khóa Thông Minh Chính Hãng',
    hotline: null,
    email: null,
    address: null,
  },
};

export async function layDuLieuChung(): Promise<DuLieuChung> {
  try {
    const home = await layTrangChu();
    return { loaiCua: home.doorTypes, congTy: home.company };
  } catch (error) {
    console.error('[web] Không lấy được dữ liệu chung, dùng bản dự phòng:', error);
    return CHUNG_DU_PHONG;
  }
}

/* ======================= Bài viết ======================= */

function chuanHoaBaiViet(tho: unknown): StorefrontPost | null {
  const goc = (tho ?? {}) as Record<string, unknown>;
  if (typeof goc.slug !== 'string' || typeof goc.title !== 'string') return null;
  return {
    slug: goc.slug,
    title: goc.title,
    excerpt: chuoiHoacNull(goc.excerpt),
    coverUrl: chuoiHoacNull(goc.coverUrl),
    categoryName: chuoiHoacNull(goc.categoryName),
    categorySlug: chuoiHoacNull(goc.categorySlug),
    publishedAt: chuoiHoacNull(goc.publishedAt),
  };
}

/** Lỗi thì trả danh sách rỗng, trang hiện "chưa có bài" chứ không trắng màn hình */
export async function layDanhSachBaiViet(
  thamSo: Record<string, string | number | undefined> = {},
): Promise<StorefrontPostList> {
  const query = new URLSearchParams();
  for (const [khoa, giaTri] of Object.entries(thamSo)) {
    if (giaTri !== undefined && giaTri !== '') query.set(khoa, String(giaTri));
  }
  const chuoi = query.toString();

  try {
    const goc = (await doc<unknown>(`/public/posts${chuoi ? `?${chuoi}` : ''}`, 300)) as Record<
      string,
      unknown
    >;
    return {
      items: mang<unknown>(goc?.items)
        .map(chuanHoaBaiViet)
        .filter((item): item is StorefrontPost => item !== null),
      total: so(goc?.total),
      page: so(goc?.page, 1),
      pageSize: so(goc?.pageSize, 12),
      categories: mang(goc?.categories),
    };
  } catch (error) {
    console.error('[web] Không lấy được danh sách bài viết:', error);
    return { items: [], total: 0, page: 1, pageSize: 12, categories: [] };
  }
}

export async function layBaiViet(slug: string): Promise<StorefrontPostDetail | null> {
  const tho = await docCoThe<unknown>(`/public/posts/${slug}`, 300);
  if (tho === null) return null;

  const coBan = chuanHoaBaiViet(tho);
  if (!coBan) return null;

  const goc = tho as Record<string, unknown>;
  return {
    ...coBan,
    contentHtml: typeof goc.contentHtml === 'string' ? goc.contentHtml : '',
    seoTitle: chuoiHoacNull(goc.seoTitle),
    seoDescription: chuoiHoacNull(goc.seoDescription),
    authorName: chuoiHoacNull(goc.authorName),
    products: mang(goc.products),
    related: mang<unknown>(goc.related)
      .map(chuanHoaBaiViet)
      .filter((item): item is StorefrontPost => item !== null),
  };
}

/* ======================= Chính sách ======================= */

function chuanHoaChinhSach(tho: unknown): StorefrontPolicyDetail | null {
  const goc = (tho ?? {}) as Record<string, unknown>;
  if (typeof goc.slug !== 'string') return null;
  return {
    slug: goc.slug,
    label: typeof goc.label === 'string' ? goc.label : '',
    title: typeof goc.title === 'string' ? goc.title : '',
    version: typeof goc.version === 'string' ? goc.version : '',
    effectiveAt: typeof goc.effectiveAt === 'string' ? goc.effectiveAt : '',
    contentHtml: typeof goc.contentHtml === 'string' ? goc.contentHtml : '',
  };
}

/**
 * Danh sách chính sách đang có hiệu lực.
 *
 * Lỗi thì trả mảng rỗng chứ không ném: hàm này được chân trang gọi ở MỌI trang,
 * API chết mà ném lỗi là trắng cả website chỉ vì mất mấy cái liên kết ở cuối trang.
 *
 * Để 1800 giây (30 phút): chính sách hiếm khi đổi, không việc gì phải hỏi lại
 * API mỗi phút trên mọi trang.
 */
export async function layDanhSachChinhSach(): Promise<StorefrontPolicy[]> {
  try {
    return mang<StorefrontPolicy>(await doc<unknown>('/public/policies', 1800));
  } catch (error) {
    console.error('[web] Không lấy được danh sách chính sách:', error);
    return [];
  }
}

export async function layChinhSach(slug: string): Promise<StorefrontPolicyDetail | null> {
  const tho = await docCoThe<unknown>(`/public/policies/${slug}`, 1800);
  return tho === null ? null : chuanHoaChinhSach(tho);
}

/* ======================= Showroom ======================= */

function chuanHoaShowroom(tho: unknown): StorefrontShowroomDetail | null {
  const goc = (tho ?? {}) as Record<string, unknown>;
  if (typeof goc.slug !== 'string' || typeof goc.name !== 'string') return null;

  return {
    slug: goc.slug,
    name: goc.name,
    address: typeof goc.address === 'string' ? goc.address : '',
    phone: chuoiHoacNull(goc.phone),
    openingHours: mang<string>(goc.openingHours),
    imageUrl: chuoiHoacNull(goc.imageUrl),
    directionsUrl: chuoiHoacNull(goc.directionsUrl),
    region: goc.region === 'HN' ? 'HN' : 'HCM',
    description: chuoiHoacNull(goc.description),
    email: chuoiHoacNull(goc.email),
    images: mang<string>(goc.images),
    mapEmbedUrl: chuoiHoacNull(goc.mapEmbedUrl),
  };
}

/** Danh sách showroom. Lỗi thì trả mảng rỗng, trang tự ẩn khối đi. */
export async function layDanhSachShowroom(): Promise<StorefrontShowroom[]> {
  try {
    return mang<StorefrontShowroom>(await doc<unknown>('/public/showrooms', 300));
  } catch (error) {
    console.error('[web] Không lấy được danh sách showroom:', error);
    return [];
  }
}

export async function layShowroom(slug: string): Promise<StorefrontShowroomDetail | null> {
  const tho = await docCoThe<unknown>(`/public/showrooms/${slug}`, 300);
  return tho === null ? null : chuanHoaShowroom(tho);
}

/* ======================= Ảnh nhiều cỡ ======================= */

/**
 * Máy chủ tạo sẵn ba cỡ cho mỗi ảnh: 400px (_sm), 900px (_md) và 1600px (bản gốc).
 * Trước đây tôi dùng bản gốc ở MỌI chỗ — kể cả thẻ sản phẩm rộng 170px trên
 * điện thoại. Một trang danh sách 24 sản phẩm là 24 tấm 1600px, phần lớn tải về
 * rồi thu nhỏ lại, phí băng thông của khách.
 *
 * Trả về srcSet để trình duyệt tự chọn cỡ theo bề rộng thật và mật độ màn hình.
 */
export function boAnh(url: string): { src: string; srcSet: string } {
  return {
    // src là cỡ vừa: trình duyệt quá cũ không hiểu srcSet vẫn không tải bản 1600px
    src: imageUrl(url, 'md'),
    srcSet: `${imageUrl(url, 'sm')} 400w, ${imageUrl(url, 'md')} 900w, ${imageUrl(url, 'lg')} 1600w`,
  };
}

/** Ảnh nhỏ (ảnh đại diện, ảnh thu nhỏ): không bao giờ cần quá 400px */
export function anhNho(url: string): string {
  return imageUrl(url, 'sm');
}

/** Tên miền thật của website, dùng cho những chỗ BẮT BUỘC có đường dẫn đầy đủ */
export const DIA_CHI_WEB = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://khoathongminhchinhhang.vn'
).replace(/\/+$/, '');

/**
 * Đổi đường dẫn ảnh tương đối thành đường dẫn ĐẦY ĐỦ.
 *
 * Database lưu "/media/2026/01/abc.webp" — trình duyệt tự ghép với tên miền đang
 * mở nên hiện ảnh bình thường. Nhưng có hai chỗ trình duyệt không ghép hộ:
 *
 *   - Dữ liệu cấu trúc JSON-LD gửi cho Google: trường "image" là dữ liệu thuần,
 *     Google đọc "/media/..." thì không biết nó nằm ở tên miền nào và bỏ qua ảnh.
 *   - Ảnh xem trước khi dán link lên Facebook, Zalo (thẻ og:image).
 *
 * Riêng og:image thì Next.js đã tự lo nhờ metadataBase khai ở layout.tsx; hàm này
 * dành cho JSON-LD và những chỗ mình tự dựng chuỗi.
 *
 * Đường dẫn đã đầy đủ sẵn (ảnh để trên CDN) thì giữ nguyên.
 */
export function anhTuyetDoi(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${DIA_CHI_WEB}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Giá tiền dạng "12.500.000 ₫" — dùng chung một chỗ để mọi trang hiện giống nhau */
export function dinhDangTien(soTien: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(soTien)} ₫`;
}

/** "từ 12.500.000 ₫" khi sản phẩm có nhiều biến thể khác giá nhau */
export function dinhDangGiaTu(soTien: number, nhieuBienThe: boolean): string {
  return nhieuBienThe ? `từ ${dinhDangTien(soTien)}` : dinhDangTien(soTien);
}

/** "0902330328" → "0902 330 328" cho dễ đọc; số không đúng dạng thì giữ nguyên */
export function dinhDangDienThoai(soDienThoai: string): string {
  const so = soDienThoai.replace(/\D/g, '');
  if (so.length === 10) return `${so.slice(0, 4)} ${so.slice(4, 7)} ${so.slice(7)}`;
  if (so.length === 11) return `${so.slice(0, 4)} ${so.slice(4, 8)} ${so.slice(8)}`;
  return soDienThoai;
}

/** Số để gắn vào tel: và zalo.me — chỉ giữ chữ số */
export function soGoi(soDienThoai: string): string {
  return soDienThoai.replace(/\D/g, '');
}
