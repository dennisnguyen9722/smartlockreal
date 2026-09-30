'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, FolderTree, ImageOff, Newspaper, Package, Plus, Tag, TrendingDown, TrendingUp } from 'lucide-react';
import { formatVnd, percentChange, type DashboardResponse } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { RevenueChart } from '@/components/report/revenue-chart';
import { useApiQuery } from '@/lib/hooks';

export default function DashboardPage() {
    const { staff, can } = useAuth();
    // Trang chủ luôn lấy số mới: nhân viên mở lên là thấy việc cần làm ngay
    const query = useApiQuery<DashboardResponse>(['dashboard'], '/reports/dashboard', { refetchOnMount: 'always' });

    return (
        <>
            <PageHeader title="Tổng quan" description={`Xin chào ${staff?.fullName ?? ''}`} />

            {query.isPending ? (
                <LoadingRows rows={6} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : (
                <div className="space-y-6">
                    {/* Việc cần làm: phần quan trọng nhất, đứng trên cùng */}
                    <section className="space-y-2">
                        <h2 className="text-sm font-medium text-muted-foreground">Việc cần làm</h2>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {query.data.tasks.map((task) => (
                                <Link key={task.key} href={task.href}>
                                    <Card
                                        className={cn(
                                            'h-full transition-colors hover:border-primary',
                                            task.count > 0 && task.urgent && 'border-destructive/40 bg-destructive/5',
                                        )}
                                    >
                                        <CardContent className="space-y-1 p-4">
                                            <p className="text-sm">{task.label}</p>
                                            <p className={cn('text-3xl font-semibold', task.count > 0 && task.urgent && 'text-destructive')}>
                                                {task.count}
                                            </p>
                                            {task.hint && <p className="text-xs text-muted-foreground">{task.hint}</p>}
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                        {query.data.tasks.every((task) => task.count === 0) && (
                            <p className="text-sm text-muted-foreground">Không có việc nào đang chờ. 🎉</p>
                        )}
                    </section>

                    {/* Doanh thu: chỉ người có quyền xem báo cáo */}
                    {query.data.money && (
                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-medium text-muted-foreground">Doanh thu</h2>
                                {can('report.view') && (
                                    <Link href="/bao-cao">
                                        <Button variant="ghost" size="sm">
                                            Xem báo cáo đầy đủ
                                            <ArrowRight className="size-4" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Card>
                                    <CardContent className="space-y-1 p-4">
                                        <p className="text-xs text-muted-foreground">Hôm nay</p>
                                        <p className="text-2xl font-semibold">{formatVnd(query.data.money.todayRevenue)}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="space-y-1 p-4">
                                        <p className="text-xs text-muted-foreground">Tháng này</p>
                                        <p className="text-2xl font-semibold">{formatVnd(query.data.money.monthRevenue)}</p>
                                        <MonthChange current={query.data.money.monthRevenue} previous={query.data.money.previousMonthRevenue} />
                                    </CardContent>
                                </Card>
                            </div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>30 ngày gần nhất</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <RevenueChart points={query.data.money.series} granularity="DAY" />
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {/* Hàng hóa: số liệu ai cũng xem được, kèm nút thêm nhanh */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-medium text-muted-foreground">Hàng hóa và nội dung</h2>
                            {can('catalog.manage') && (
                                <Link href="/san-pham/moi">
                                    <Button size="sm">
                                        <Plus className="size-4" />
                                        Thêm sản phẩm
                                    </Button>
                                </Link>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <CatalogCard
                                href="/san-pham?status=ACTIVE"
                                icon={<Package className="size-4" />}
                                label="Sản phẩm đang bán"
                                value={query.data.catalog.activeProducts}
                                hint={`${query.data.catalog.draftProducts} nháp · ${query.data.catalog.archivedProducts} lưu trữ`}
                            />
                            <CatalogCard
                                href="/san-pham?status=ACTIVE"
                                icon={<ImageOff className="size-4" />}
                                label="Đang bán nhưng thiếu ảnh"
                                value={query.data.catalog.productsWithoutImage}
                                hint={query.data.catalog.productsWithoutImage > 0 ? 'Website đang hiện ô trống, nên bổ sung' : 'Sản phẩm nào cũng có ảnh'}
                                urgent={query.data.catalog.productsWithoutImage > 0}
                            />
                            <CatalogCard
                                href="/danh-muc"
                                icon={<FolderTree className="size-4" />}
                                label="Danh mục"
                                value={query.data.catalog.categories}
                                hint={`${query.data.catalog.brands} hãng`}
                            />
                            <CatalogCard
                                href="/bai-viet?status=PUBLISHED"
                                icon={<Newspaper className="size-4" />}
                                label="Bài viết đã đăng"
                                value={query.data.catalog.publishedPosts}
                                hint="Bài viết kéo khách từ Google"
                            />
                        </div>

                        {can('catalog.manage') && (
                            <div className="flex flex-wrap gap-2">
                                <Link href="/danh-muc">
                                    <Button variant="outline" size="sm">
                                        <FolderTree className="size-4" />
                                        Thêm danh mục
                                    </Button>
                                </Link>
                                <Link href="/hang">
                                    <Button variant="outline" size="sm">
                                        <Tag className="size-4" />
                                        Thêm hãng
                                    </Button>
                                </Link>
                                <Link href="/san-pham/nhap-excel">
                                    <Button variant="outline" size="sm">
                                        <Package className="size-4" />
                                        Nhập sản phẩm từ Excel
                                    </Button>
                                </Link>
                                {can('content.manage') && (
                                    <Link href="/bai-viet/moi">
                                        <Button variant="outline" size="sm">
                                            <Newspaper className="size-4" />
                                            Viết bài
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </>
    );
}

/** Ô số của khối hàng hóa; bấm vào mở đúng danh sách */
function CatalogCard({
    href,
    icon,
    label,
    value,
    hint,
    urgent,
}: {
    href: string;
    icon: ReactNode;
    label: string;
    value: number;
    hint?: string;
    urgent?: boolean;
}) {
    return (
        <Link href={href}>
            <Card className={cn('h-full transition-colors hover:border-primary', urgent && 'border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20')}>
                <CardContent className="space-y-1 p-4">
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {icon}
                        {label}
                    </p>
                    <p className={cn('text-3xl font-semibold', urgent && 'text-amber-700 dark:text-amber-400')}>{value}</p>
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </CardContent>
            </Card>
        </Link>
    );
}

function MonthChange({ current, previous }: { current: number; previous: number }) {
    const change = percentChange(current, previous);
    if (change === null) return <p className="text-xs text-muted-foreground">Tháng trước chưa có doanh thu</p>;
    return (
        <p className={cn('flex items-center gap-1 text-xs', change >= 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
            {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {change >= 0 ? '+' : ''}
            {change}% so với tháng trước
        </p>
    );
}
