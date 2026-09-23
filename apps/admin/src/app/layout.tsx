import '@ktm/ui/globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';
import { Toaster } from '@ktm/ui/components/sonner';
import { AppFrame } from '@/components/app-frame';
import { AuthProvider } from '@/components/auth-provider';
import { QueryProvider } from '@/components/query-provider';

/**
 * Be Vietnam Pro: phông thiết kế cho tiếng Việt, dấu không bị đè lên chữ như nhiều phông ngoại.
 * Nạp qua next/font nên phông được tải cùng trang, không nháy chữ khi mở.
 */
const beVietnamPro = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
    title: 'Quản trị | Khóa Thông Minh Chính Hãng',
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    // Màu thanh trình duyệt trên điện thoại khớp nền trang
    themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="vi" className={beVietnamPro.variable}>
            <body>
                <QueryProvider>
                    <AuthProvider>
                        <AppFrame>{children}</AppFrame>
                    </AuthProvider>
                </QueryProvider>
                <Toaster position="top-right" richColors />
            </body>
        </html>
    );
}
