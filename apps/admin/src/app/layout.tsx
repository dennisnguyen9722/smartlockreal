import '@ktm/ui/globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Quản trị | Khóa Thông Minh Chính Hãng',
  // Trang quản trị không được xuất hiện trên công cụ tìm kiếm
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
