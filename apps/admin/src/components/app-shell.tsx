'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import * as icons from 'lucide-react';
import { ADMIN_NAV, type Permission } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
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

    // Đổi trang thì đóng menu trên điện thoại (bấm Back cũng đóng)
    useEffect(() => setMobileOpen(false), [pathname]);

    if (!staff) return null;

    const groups = ADMIN_NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => can(item.permission as Permission)),
    })).filter((group) => group.items.length > 0);

    return (
        /*
         * h-svh + overflow-hidden: khung ngoài đúng bằng màn hình, KHÔNG để cả trang cuộn.
         * Chỉ danh sách menu và vùng nội dung được cuộn riêng (print: bỏ giới hạn để in đủ trang).
         */
        <div className="flex h-svh overflow-hidden bg-muted/30 print:h-auto print:overflow-visible">
            {/* Menu bên trái */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card transition-transform md:static md:h-full md:translate-x-0 print:hidden',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <Link href="/" className="flex h-14 shrink-0 items-center gap-2 border-b px-4 hover:bg-muted">
                    <icons.KeyRound className="size-5 shrink-0" />
                    <span className="truncate font-semibold">Khóa Thông Minh</span>
                </Link>

                {/* Chỉ phần danh sách menu cuộn; logo và khối tài khoản luôn thấy */}
                <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
                    {groups.map((group) => (
                        <div key={group.label}>
                            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
                            <ul className="space-y-px">
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
                                                    <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Sắp có</span>
                                                </div>
                                            </li>
                                        );
                                    }

                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                aria-current={active ? 'page' : undefined}
                                                className={cn(
                                                    // Mục đang mở: nền nhạt + vạch trái, nhẹ hơn nền đậm cũ nên nhìn cả menu đỡ chói
                                                    'flex items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm transition-colors',
                                                    active
                                                        ? 'border-primary bg-muted font-medium text-foreground'
                                                        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
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

                {/* Tài khoản: để dưới cùng menu, thanh trên dành chỗ cho nội dung trang */}
                <div className="shrink-0 border-t p-3">
                    <Link
                        href="/tai-khoan"
                        title="Tài khoản của tôi"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {staff.fullName.trim().slice(-1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{staff.fullName}</span>
                            <span className="block truncate text-xs text-muted-foreground">{ROLE_LABEL[staff.role] ?? staff.role}</span>
                        </span>
                    </Link>
                    <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground" onClick={() => void logout()}>
                        <icons.LogOut className="size-4" />
                        Đăng xuất
                    </Button>
                </div>
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

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
                {/* Thanh trên chỉ còn nút menu (điện thoại) và trạng thái kết nối */}
                {/* Không cần sticky nữa: thanh trên nằm ngoài vùng cuộn nên luôn thấy */}
                <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4 print:hidden">
                    <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
                        <icons.Menu className="size-5" />
                    </Button>
                    <div className="ml-auto">
                        <RealtimeStatus />
                    </div>
                </header>

                <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
                    {/* Khung nội dung: giới hạn bề ngang trên màn hình rất rộng để dòng chữ không quá dài */}
                    <div className="mx-auto max-w-[1600px]">{children}</div>
                </main>
            </div>
        </div>
    );
}