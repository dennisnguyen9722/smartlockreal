'use client';

import { Dashboard } from '@/components/dashboard';
import { useAuth } from '@/components/auth-provider';
import { LoginForm } from '@/components/login-form';

export default function AdminHomePage() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }
  return status === 'authenticated' ? <Dashboard /> : <LoginForm />;
}
