'use client';

import { formatVnd, type ReportBreakdownItem } from '@ktm/shared';

/** Bảng doanh thu theo nhóm (kênh bán, nhân viên) kèm thanh tỉ lệ */
export function BreakdownTable({ items, emptyMessage }: { items: ReportBreakdownItem[]; emptyMessage: string }) {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
    const total = items.reduce((sum, item) => sum + item.revenue, 0);

    return (
        <ul className="space-y-3">
            {items.map((item) => {
                const share = total > 0 ? Math.round((item.revenue / total) * 100) : 0;
                return (
                    <li key={item.key} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{item.label}</span>
                            <span className="whitespace-nowrap font-medium">{formatVnd(item.revenue)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {share}% · {item.completedOrders} đơn
                        </p>
                    </li>
                );
            })}
        </ul>
    );
}
