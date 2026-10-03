import type { MetadataRoute } from 'next';
import {
    layDanhSachBaiViet,
    layDanhSachChinhSach,
    layDanhSachShowroom,
    layLoaiCua,
    timSanPham,
} from '@/lib/api';

/**
 * Sơ đồ website cho Google, tự sinh ra ở /sitemap.xml.
 *
 * Không có file này thì Google phải tự mò theo liên kết, rất chậm với 201 trang
 * sản phẩm vừa mới đổi đường dẫn. Có nó thì gửi một lần trong Search Console là
 * Google biết hết.
 *
 * Chỉ liệt kê trang ĐƯỢC lập chỉ mục. Trang /san-pham có bộ lọc bị chặn index
 * nên ở đây chỉ có đường dẫn gốc, không có tổ hợp lọc nào.
 */

export const revalidate = 3600;

const DIA_CHI = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://khoathongminhchinhhang.vn').replace(
    /\/+$/,
    '',
);

const PAGE_SIZE = 48;

/** Lấy hết slug sản phẩm, lật trang cho tới khi đủ */
async function laySlugSanPham(): Promise<string[]> {
    const slug: string[] = [];
    let trang = 1;
    for (;;) {
        const ketQua = await timSanPham({ page: trang, pageSize: PAGE_SIZE });
        slug.push(...ketQua.items.map((item) => item.slug));
        if (slug.length >= ketQua.total || ketQua.items.length === 0) break;
        trang += 1;
        // Chặn an toàn: API lỗi trả về total sai thì cũng không lặp vô tận
        if (trang > 50) break;
    }
    return slug;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const bayGio = new Date();

    const tinh: MetadataRoute.Sitemap = [
        { url: `${DIA_CHI}/`, lastModified: bayGio, changeFrequency: 'daily', priority: 1 },
        { url: `${DIA_CHI}/san-pham`, lastModified: bayGio, changeFrequency: 'daily', priority: 0.9 },
        { url: `${DIA_CHI}/thuong-hieu`, lastModified: bayGio, changeFrequency: 'monthly', priority: 0.6 },
        { url: `${DIA_CHI}/showroom`, lastModified: bayGio, changeFrequency: 'monthly', priority: 0.7 },
        { url: `${DIA_CHI}/lien-he`, lastModified: bayGio, changeFrequency: 'monthly', priority: 0.6 },
        { url: `${DIA_CHI}/bai-viet`, lastModified: bayGio, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${DIA_CHI}/chinh-sach`, lastModified: bayGio, changeFrequency: 'yearly', priority: 0.3 },
    ];

    // API chết thì vẫn trả về sơ đồ tối thiểu, đừng để /sitemap.xml lỗi 500
    const [loaiCua, showroom, baiViet, chinhSach, slugSanPham] = await Promise.all([
        layLoaiCua().catch(() => []),
        layDanhSachShowroom(),
        // Lấy nhiều hơn số bài thực tế một chút; API chặn tối đa 24 mỗi lần
        layDanhSachBaiViet({ pageSize: 24 }),
        layDanhSachChinhSach(),
        laySlugSanPham().catch((error) => {
            console.error('[web] Không lấy được danh sách sản phẩm cho sitemap:', error);
            return [] as string[];
        }),
    ]);

    return [
        ...tinh,
        ...loaiCua.map((muc) => ({
            url: `${DIA_CHI}/khoa/${muc.slug}`,
            lastModified: bayGio,
            changeFrequency: 'weekly' as const,
            // Trang đích theo loại cửa là nơi khách tìm kiếm vào nhiều nhất
            priority: 0.9,
        })),
        ...showroom.map((muc) => ({
            url: `${DIA_CHI}/showroom/${muc.slug}`,
            lastModified: bayGio,
            changeFrequency: 'monthly' as const,
            // Trang showroom ăn tìm kiếm theo địa phương ("khóa thông minh quận 7")
            priority: 0.7,
        })),
        ...baiViet.items.map((muc) => ({
            url: `${DIA_CHI}/bai-viet/${muc.slug}`,
            lastModified: muc.publishedAt ? new Date(muc.publishedAt) : bayGio,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
        })),
        ...chinhSach.map((muc) => ({
            url: `${DIA_CHI}/chinh-sach/${muc.slug}`,
            // Ngày chính sách bắt đầu áp dụng chính là lần sửa cuối, chuẩn hơn ngày hôm nay
            lastModified: muc.effectiveAt ? new Date(muc.effectiveAt) : bayGio,
            changeFrequency: 'yearly' as const,
            // Ưu tiên thấp: cần có để website đủ tin cậy, nhưng không phải trang đi kiếm khách
            priority: 0.3,
        })),
        ...slugSanPham.map((slug) => ({
            url: `${DIA_CHI}/san-pham/${slug}`,
            lastModified: bayGio,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        })),
    ];
}
