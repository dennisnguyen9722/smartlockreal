'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
    REPORT_PRESETS,
    REPORT_PRESET_LABEL,
    formatVnd,
    percentChange,
    presetRange,
    vnDateString,
    type ReportPreset,
    type ReportResponse,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { BreakdownTable } from '@/components/report/breakdown-table';
import { RevenueChart } from '@/components/report/revenue-chart';
import { useApiQuery } from '@/lib/hooks';

function Stat({
    label,
    value,
    hint,
    change,
}: {
    label: string;
    value: string;
    hint?: string;
    /** % so với kỳ trước; null = kỳ trước bằng 0 */
    change?: number | null;
}) {
    return (
        <Card>
            <CardContent className="space-y-1 p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
                {change !== undefined && change !== null ? (
                    <p className={cn('flex items-center gap-1 text-xs', change >= 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
                        {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        {change >= 0 ? '+' : ''}
                        {change}% so với kỳ trước
                    </p>
                ) : (
                    hint && <p className="text-xs text-muted-foreground">{hint}</p>
                )}
            </CardContent>
        </Card>
    );
}

export default function ReportPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={6} />}>
            <ReportContent />
        </Suspense>
    );
}

function ReportContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { can } = useAuth();
    const allowed = can('report.view');

    const preset = (REPORT_PRESETS.find((item) => item === searchParams.get('ky')) ?? 'THIS_MONTH') as ReportPreset;
    const custom = preset === 'CUSTOM';
    const defaults = presetRange(custom ? 'THIS_MONTH' : preset);
    const from = (custom ? searchParams.get('tu') : null) ?? defaults.from;
    const to = (custom ? searchParams.get('den') : null) ?? defaults.to;

    function update(next: Record<string, string | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(next)) {
            if (value === null || value === '') params.delete(key);
            else params.set(key, value);
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    const query = useApiQuery<ReportResponse>(['reports', from, to], `/reports/overview?from=${from}&to=${to}`, {
        enabled: allowed && from <= to,
        placeholderData: (previous) => previous,
        refetchOnMount: 'always',
    });

    if (!allowed) {
        return (
            <>
                <PageHeader title="Báo cáo" />
                <EmptyState message="Bạn không có quyền xem báo cáo" />
            </>
        );
    }

    const summary = query.data?.summary;
    const today = vnDateString(new Date());

    return (
        <>
            <PageHeader
                title="Báo cáo"
                description="Doanh thu tính theo đơn đã Hoàn tất (đã giao lắp và thu tiền), theo giờ Việt Nam."
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                {REPORT_PRESETS.map((item) => (
                    <Button
                        key={item}
                        variant={preset === item ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => update(item === 'CUSTOM' ? { ky: item, tu: from, den: to } : { ky: item === 'THIS_MONTH' ? null : item, tu: null, den: null })}
                    >
                        {REPORT_PRESET_LABEL[item]}
                    </Button>
                ))}
                {custom && (
                    <>
                        <Input type="date" value={from} max={to} onChange={(event) => update({ tu: event.target.value })} className="w-40" />
                        <span className="text-sm text-muted-foreground">đến</span>
                        <Input type="date" value={to} min={from} max={today} onChange={(event) => update({ den: event.target.value })} className="w-40" />
                    </>
                )}
            </div>

            {query.isPending ? (
                <LoadingRows rows={6} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : !summary || !query.data ? null : (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat label="Doanh thu" value={formatVnd(summary.revenue)} change={percentChange(summary.revenue, summary.previous.revenue)} hint="Kỳ trước chưa có doanh thu" />
                        <Stat
                            label="Đơn hoàn tất"
                            value={String(summary.completedOrders)}
                            change={percentChange(summary.completedOrders, summary.previous.completedOrders)}
                            hint="Kỳ trước chưa có đơn hoàn tất"
                        />
                        <Stat label="Giá trị đơn trung bình" value={formatVnd(summary.averageOrder)} hint="Doanh thu chia số đơn hoàn tất" />
                        <Stat
                            label="Còn phải thu"
                            value={formatVnd(summary.unpaid)}
                            hint={summary.unpaid > 0 ? 'Của các đơn đã hoàn tất trong kỳ' : 'Đã thu đủ'}
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <Stat label="Đơn mới đặt trong kỳ" value={String(summary.newOrders)} hint="Không tính đơn đã hủy" />
                        <Stat label="Đang xử lý" value={String(summary.processingOrders)} hint="Đơn đặt trong kỳ chưa hoàn tất" />
                        <Stat
                            label="Đơn hủy"
                            value={String(summary.cancelledOrders)}
                            hint={summary.newOrders + summary.cancelledOrders > 0 ? `${Math.round((summary.cancelledOrders / (summary.newOrders + summary.cancelledOrders)) * 100)}% số đơn đặt trong kỳ` : undefined}
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Doanh thu theo {query.data.granularity === 'DAY' ? 'ngày' : query.data.granularity === 'WEEK' ? 'tuần' : 'tháng'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RevenueChart points={query.data.series} granularity={query.data.granularity} />
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Theo kênh bán</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <BreakdownTable items={query.data.byChannel} emptyMessage="Chưa có đơn hoàn tất trong kỳ." />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Theo nhân viên phụ trách</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <BreakdownTable items={query.data.byStaff} emptyMessage="Chưa có đơn hoàn tất trong kỳ." />
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Bán chạy trong kỳ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {query.data.topProducts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Chưa có sản phẩm nào bán được trong kỳ.</p>
                            ) : (
                                <ul className="divide-y">
                                    {query.data.topProducts.map((product, index) => (
                                        <li key={`${product.productId ?? product.name}-${index}`} className="flex items-center gap-3 py-2 text-sm">
                                            <span className="w-5 text-muted-foreground">{index + 1}</span>
                                            <span className="min-w-0 flex-1">
                                                {product.productId ? (
                                                    <Link href={`/san-pham/${product.productId}`} className="hover:underline">
                                                        {product.name}
                                                    </Link>
                                                ) : (
                                                    product.name
                                                )}
                                                {product.sku && <span className="block text-xs text-muted-foreground">SKU {product.sku}</span>}
                                            </span>
                                            <span className="whitespace-nowrap text-muted-foreground">{product.quantity} máy</span>
                                            <span className="w-32 text-right font-medium">{formatVnd(product.revenue)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <p className="text-xs text-muted-foreground">
                        Đơn chưa hoàn tất không tính vào doanh thu, để số liệu không bị lố khi đơn bị hủy giữa chừng. Báo cáo lấy số trực
                        tiếp từ đơn hàng nên luôn khớp với trang Đơn hàng.
                    </p>
                </div>
            )}
        </>
    );
}
