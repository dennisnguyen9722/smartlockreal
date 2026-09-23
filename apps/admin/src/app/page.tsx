'use client';

import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import {
    AUDIT_ENTITY_LABEL,
    auditEntityHref,
    formatVnd,
    percentChange,
    type DashboardResponse,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { RevenueChart } from '@/components/report/revenue-chart';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

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

                    {/* Hoạt động gần đây: chỉ người xem được nhật ký */}
                    {query.data.recentActivity && query.data.recentActivity.length > 0 && (
                        <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-medium text-muted-foreground">Hoạt động gần đây</h2>
                                <Link href="/nhat-ky">
                                    <Button variant="ghost" size="sm">
                                        Xem nhật ký
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </Link>
                            </div>
                            <Card>
                                <CardContent className="divide-y p-0">
                                    {query.data.recentActivity.map((item) => {
                                        const href = auditEntityHref(item.entityType, item.entityId);
                                        return (
                                            <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                                                <span className="min-w-0 flex-1">
                                                    <span className="font-medium">{item.action}</span>{' '}
                                                    <span className="text-muted-foreground">
                                                        {AUDIT_ENTITY_LABEL[item.entityType] ?? item.entityType}
                                                    </span>
                                                    {href && (
                                                        <>
                                                            {' · '}
                                                            <Link href={href} className="text-primary hover:underline">
                                                                mở
                                                            </Link>
                                                        </>
                                                    )}
                                                </span>
                                                <span className="text-muted-foreground">{item.staffName ?? 'Không rõ người'}</span>
                                                <span className="whitespace-nowrap text-muted-foreground">{formatDateTimeVn(item.createdAt)}</span>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </section>
                    )}
                </div>
            )}
        </>
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
