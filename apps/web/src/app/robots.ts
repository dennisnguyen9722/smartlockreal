import type { MetadataRoute } from 'next';

/**
 * Sinh ra /robots.txt.
 *
 * Chặn các địa chỉ có tham số lọc: 201 sản phẩm × 6 loại cửa × 5 hãng × 4 khoảng
 * giá × 4 kiểu sắp xếp ra hàng nghìn địa chỉ chứa CÙNG một tập sản phẩm. Để
 * Google bò hết thì nó tốn công vào chỗ trùng lặp thay vì vào trang sản phẩm thật.
 * Trang /san-pham gốc vẫn cho vào bình thường.
 */

const DIA_CHI = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://khoathongminhchinhhang.vn').replace(
    /\/+$/,
    '',
);

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/san-pham?', '/khoa/*?'],
            },
        ],
        sitemap: `${DIA_CHI}/sitemap.xml`,
    };
}
