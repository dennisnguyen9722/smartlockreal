import '@ktm/ui/globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from '@ktm/ui/components/sonner';
import { AppFrame } from '@/components/app-frame';
import { AuthProvider } from '@/components/auth-provider';
import { QueryProvider } from '@/components/query-provider';

export const metadata: Metadata = {
  title: 'Quản trị | Khóa Thông Minh Chính Hãng',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
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
