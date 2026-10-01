import type {
  Paginated,
  StorefrontCard,
  StorefrontHome,
  StorefrontProduct,
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

export function timSanPham(thamSo: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [khoa, giaTri] of Object.entries(thamSo)) {
    if (giaTri !== undefined && giaTri !== '') query.set(khoa, String(giaTri));
  }
  const chuoi = query.toString();
  return doc<DanhSachSanPham>(`/public/products${chuoi ? `?${chuoi}` : ''}`);
}

export function laySanPham(slug: string) {
  return docCoThe<StorefrontProduct>(`/public/products/${slug}`);
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
