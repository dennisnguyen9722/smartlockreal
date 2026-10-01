import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { layDuLieuChung } from '@/lib/api';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/**
 * Khung chung của website.
 *
 * Thanh điều hướng và chân trang cần danh sách loại cửa + thông tin công ty.
 * Cả hai lấy từ /public/home — Next.js gộp các lần fetch trùng nhau trong cùng
 * một lượt dựng trang, nên gọi ở đây và gọi lại trong trang chủ chỉ tốn MỘT lần.
 */

const beVietnamPro = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-be-vietnam-pro',
});

const DIA_CHI_WEB = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://khoathongminhchinhhang.vn';

export const metadata: Metadata = {
    // Có metadataBase thì mọi đường dẫn ảnh/canonical tương đối mới thành đường dẫn đầy đủ
    metadataBase: new URL(DIA_CHI_WEB),
    title: {
        default: 'Khóa Thông Minh Chính Hãng — Khóa cửa vân tay, khóa điện tử nhập khẩu',
        template: '%s | Khóa Thông Minh Chính Hãng',
    },
    description:
        'Phân phối khóa cửa thông minh chính hãng: khóa vân tay, khóa điện tử, khóa mã số cho cửa gỗ, cửa nhôm, cửa nhựa và cửa kính. Tư vấn chọn đúng loại cửa, lắp đặt tận nơi, bảo hành chính hãng.',
    applicationName: 'Khóa Thông Minh Chính Hãng',
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        locale: 'vi_VN',
        siteName: 'Khóa Thông Minh Chính Hãng',
        url: '/',
        title: 'Khóa Thông Minh Chính Hãng — Khóa cửa vân tay, khóa điện tử nhập khẩu',
        description:
            'Khóa vân tay, khóa điện tử chính hãng cho mọi loại cửa. Tư vấn miễn phí, lắp đặt tận nơi.',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    icons: {
        icon: '/logo-bieu-tuong.svg',
        apple: '/logo-bieu-tuong.svg',
    },
};

export const viewport: Viewport = {
    // Thanh trạng thái trên điện thoại ăn theo màu nền trang
    themeColor: '#001830',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
    const chung = await layDuLieuChung();

    return (
        <html lang="vi" className={beVietnamPro.variable}>
            <body className="bg-[var(--kt-navy-deep)] text-white antialiased">
                {/* Phím Tab đầu tiên nhảy thẳng vào nội dung, không phải lướt hết menu */}
                <a
                    href="#noi-dung"
                    className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-[var(--kt-gold)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[var(--kt-navy-deep)]"
                >
                    Bỏ qua, vào nội dung chính
                </a>

                <SiteHeader loaiCua={chung.loaiCua} hotline={chung.congTy.hotline} />

                <main id="noi-dung">{children}</main>

                <SiteFooter loaiCua={chung.loaiCua} congTy={chung.congTy} />
            </body>
        </html>
    );
}
