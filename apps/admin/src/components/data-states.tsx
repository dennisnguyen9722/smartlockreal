'use client';

import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@ktm/ui/components/button';
import { Skeleton } from '@ktm/ui/components/skeleton';

export function LoadingRows({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
            ))}
            <span className="sr-only">Đang tải dữ liệu</span>
        </div>
    );
}

/**
 * Lỗi: nói rõ chuyện gì xảy ra và cho cách làm tiếp, thay vì chỉ hiện chữ đỏ.
 * onRetry có thì hiện nút Thử lại; không có thì nhắc tải lại trang.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <TriangleAlert className="size-7 text-destructive" />
            <div className="space-y-1">
                <p className="font-medium text-destructive">{message}</p>
                <p className="text-sm text-muted-foreground">
                    {onRetry ? 'Mạng chập chờn thì thử lại giúp mình.' : 'Thử tải lại trang; còn lỗi thì báo kỹ thuật kèm ảnh màn hình.'}
                </p>
            </div>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw className="size-4" />
                    Thử lại
                </Button>
            )}
        </div>
    );
}

/** Màn hình trống là lời mời làm việc tiếp: có chỗ đặt nút hành động chính */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <Inbox className="size-7 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">{message}</p>
            {action}
        </div>
    );
}
