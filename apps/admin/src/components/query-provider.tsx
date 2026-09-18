'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';

export function QueryProvider({ children }: { children: ReactNode }) {
  // Tạo trong state để mỗi lần tải trang có một bộ nhớ đệm riêng
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dữ liệu coi là còn mới trong 30 giây, tránh gọi lại liên tục
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Lỗi do người dùng (chưa đăng nhập, không có quyền, sai dữ liệu) thì không thử lại
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
