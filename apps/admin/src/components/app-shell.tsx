'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import * as icons from 'lucide-react';
import { ADMIN_NAV, type Permission } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Separator } from '@ktm/ui/components/separator';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from './auth-provider';
import { RealtimeStatus } from './realtime-status';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Quản trị hệ thống',
  SALE_STAFF: 'Nhân viên kinh doanh',
};

function Icon({ name, className }: { name: string; className?: string }) {
  const Component = (icons as unknown as Record<string, icons.LucideIcon | undefined>)[name];
  if (!Component) return <icons.Circle className={className} />;
  return <Component className={className} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { staff, logout, can } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!staff) return null;

  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission as Permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-svh">
      {/* Menu bên trái */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r bg-card transition-transform md:static md:translate-x-0 print:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex h-14 items-center gap-2 border-b px-4 transition-colors hover:bg-muted"
        >
          <icons.KeyRound className="size-5 shrink-0" />
          <span className="truncate font-semibold">Khóa Thông Minh</span>
        </Link>

        <nav className="space-y-4 p-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  if (!item.ready) {
                    return (
                      <li key={item.href}>
                        <div
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground/60"
                          title="Trang đang được xây dựng"
                        >
                          <Icon name={item.icon} className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                            Sắp có
                          </span>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon name={item.icon} className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Lớp phủ khi mở menu trên điện thoại */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* print:hidden: trang in (vd báo giá) chỉ in nội dung, không in menu và thanh trên */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur print:hidden">
          <Button
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Mở menu"
          >
            <icons.Menu className="size-5" />
          </Button>

          <div className="ml-auto flex items-center gap-3">
            {/* Trạng thái kết nối realtime và nút bật chuông báo đơn mới */}
            <RealtimeStatus />
            <Separator orientation="vertical" className="h-8" />
            <div className="text-right text-sm">
              <p className="font-medium leading-tight">{staff.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL[staff.role] ?? staff.role}
              </p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <Button variant="outline" onClick={() => void logout()}>
              <icons.LogOut className="size-4" />
              Đăng xuất
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}