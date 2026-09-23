'use client';

import { useState } from 'react';
import { formatBucket, formatVnd, type ReportGranularity, type ReportPoint } from '@ktm/shared';

/**
 * Biểu đồ cột doanh thu, vẽ bằng SVG thuần.
 * Không dùng thư viện biểu đồ: chỉ cần một loại biểu đồ, thêm gói ngoài sẽ làm nặng trang quản trị.
 */
export function RevenueChart({ points, granularity }: { points: ReportPoint[]; granularity: ReportGranularity }) {
    const [hover, setHover] = useState<number | null>(null);
    if (points.length === 0) return <p className="text-sm text-muted-foreground">Chưa có dữ liệu trong khoảng thời gian này.</p>;

    const max = Math.max(...points.map((point) => point.revenue), 1);
    const height = 220;
    const gap = points.length > 40 ? 1 : 4;
    const barWidth = 100 / points.length;
    // Chỉ ghi chữ dưới một số cột để không chồng nhau
    const labelStep = Math.ceil(points.length / 12);

    return (
        <div className="space-y-2">
            <div className="relative">
                <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-56 w-full" role="img" aria-label="Biểu đồ doanh thu">
                    {[0.25, 0.5, 0.75, 1].map((ratio) => (
                        <line key={ratio} x1="0" x2="100" y1={height - ratio * height} y2={height - ratio * height} className="stroke-border" strokeWidth={0.5} />
                    ))}
                    {points.map((point, index) => {
                        const barHeight = (point.revenue / max) * (height - 8);
                        return (
                            <rect
                                key={point.bucket}
                                x={index * barWidth + gap / 2}
                                y={height - barHeight}
                                width={Math.max(barWidth - gap, 0.5)}
                                height={barHeight}
                                className={hover === index ? 'fill-primary' : 'fill-primary/70'}
                                onMouseEnter={() => setHover(index)}
                                onMouseLeave={() => setHover(null)}
                            />
                        );
                    })}
                </svg>
                {hover !== null && points[hover] && (
                    <div className="pointer-events-none absolute top-0 right-0 rounded-md border bg-background px-2 py-1 text-xs shadow-sm">
                        <p className="font-medium">{formatBucket(points[hover].bucket, granularity)}</p>
                        <p>{formatVnd(points[hover].revenue)}</p>
                        <p className="text-muted-foreground">{points[hover].completedOrders} đơn hoàn tất</p>
                    </div>
                )}
            </div>
            <div className="flex text-[10px] text-muted-foreground">
                {points.map((point, index) => (
                    <span key={point.bucket} style={{ width: `${barWidth}%` }} className="truncate text-center">
                        {index % labelStep === 0 ? formatBucket(point.bucket, granularity) : ''}
                    </span>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">Cột cao nhất: {formatVnd(max)}. Di chuột lên cột để xem chi tiết.</p>
        </div>
    );
}
