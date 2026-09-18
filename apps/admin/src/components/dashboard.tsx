'use client';

import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { useAuth } from './auth-provider';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Quản trị hệ thống',
  SALE_STAFF: 'Nhân viên kinh doanh',
};

export function Dashboard() {
  const { staff, logout } = useAuth();
  if (!staff) return null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trang quản trị</h1>
          <p className="text-muted-foreground">
            {staff.fullName} · {ROLE_LABEL[staff.role] ?? staff.role}
          </p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>
          Đăng xuất
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quyền của bạn ({staff.permissions?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-1.5">
            {staff.permissions?.map((permission) => (
              <li key={permission} className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                {permission}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
