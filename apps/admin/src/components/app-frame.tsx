'use client';

import type { ReactNode } from 'react';
import { AppShell } from './app-shell';
import { useAuth } from './auth-provider';
import { LoginForm } from './login-form';

/**
 * Nằm trong layout nên CHỈ vẽ một lần: đổi trang không làm menu nhấp nháy.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }
  if (status === 'unauthenticated') return <LoginForm />;

  return <AppShell>{children}</AppShell>;
}
