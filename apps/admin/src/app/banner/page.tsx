'use client';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    BANNER_PLACEMENTS,
    BANNER_PLACEMENT_INFO,
    BANNER_STATE_LABEL,
    imageUrl,
    type BannerItem,
    type BannerPlacementValue,
    type BannerState,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { BannerDialog } from '@/components/banner/banner-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

const STATE_BADGE: Record<BannerState, 'default' | 'secondary' | 'outline'> = {
    RUNNING: 'default',
    SCHEDULED: 'secondary',
    EXPIRED: 'outline',
    OFF: 'outline',
};

function isPlacement(value: string | null): value is BannerPlacementValue {
    return BANNER_PLACEMENTS.some((item) => item === value);
}

export default function BannerPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={4} />}>
            <BannerContent />
        </Suspense>
    );
}

function BannerContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { can } = useAuth();
    const canManage = can('content.manage');

    const tabParam = searchParams.get('vi-tri');
    const placement: BannerPlacementValue = isPlacement(tabParam) ? tabParam : 'HOME_HERO';
    const query = useApiQuery<BannerItem[]>(['banners'], '/banners', { refetchOnMount: 'always' });

    // editing: null = đóng; 'new' = thêm mới; còn lại = banner đang sửa
    const [editing, setEditing] = useState<BannerItem | 'new' | null>(null);
    const [dialogKey, setDialogKey] = useState(0);
    const [deleting, setDeleting] = useState<BannerItem | null>(null);

    const all = query.data ?? [];
    const banners = all.filter((banner) => banner.placement === placement);
    const runningPopups = all.filter((banner) => banner.placement === 'POPUP' && banner.state === 'RUNNING').length;

    function openDialog(target: BannerItem | 'new') {
        setDialogKey((key) => key + 1);
        setEditing(target);
    }

    const onConflict = (error: Error) => {
        if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
            toast.error('Danh sách vừa được người khác thay đổi, đã tải lại');
            void queryClient.invalidateQueries({ queryKey: ['banners'] });
            return;
        }
        toast.error(errorText(error));
    };

    const reorder = useApiMutation<BannerItem[], { placement: BannerPlacementValue; ids: string[] }>(
        (body) => ({ path: '/banners/reorder', method: 'POST', body }),
        {
            onSuccess: (data) => queryClient.setQueryData(['banners'], data),
            onError: onConflict,
        },
    );

    const toggle = useApiMutation<BannerItem, BannerItem>(
        (banner) => ({ path: `/banners/${banner.id}`, method: 'PATCH', body: { isActive: !banner.isActive, expectedUpdatedAt: banner.updatedAt } }),
        {
            invalidate: [['banners']],
            onSuccess: (banner) => toast.success(banner.isActive ? 'Đã bật banner' : 'Đã tắt banner'),
            onError: onConflict,
        },
    );

    const remove = useApiMutation<void, string>((id) => ({ path: `/banners/${id}`, method: 'DELETE' }), {
        invalidate: [['banners']],
        onSuccess: () => {
            setDeleting(null);
            toast.success('Đã xóa banner');
        },
        onError: (error) => {
            setDeleting(null);
            toast.error(errorText(error));
        },
    });

    function move(index: number, offset: number) {
        const target = index + offset;
        if (target < 0 || target >= banners.length) return;
        const ids = banners.map((banner) => banner.id);
        [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
        reorder.mutate({ placement, ids });
    }

    const busy = reorder.isPending || toggle.isPending;
    const addButton = canManage ? (
        <Button onClick={() => openDialog('new')}>
            <Plus className="size-4" />
            Thêm banner
        </Button>
    ) : null;

    return (
        <>
            <PageHeader title="Banner" description="Ảnh quảng cáo trên trang chủ, trang danh mục và cửa sổ nổi" actions={addButton} />

            <div className="mb-4 flex gap-1 overflow-x-auto border-b">
                {BANNER_PLACEMENTS.map((item) => {
                    const count = all.filter((banner) => banner.placement === item).length;
                    return (
                        <button
                            key={item}
                            type="button"
                            onClick={() => router.replace(item === 'HOME_HERO' ? pathname : `${pathname}?vi-tri=${item}`, { scroll: false })}
                            className={cn(
                                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                                placement === item ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {BANNER_PLACEMENT_INFO[item].label}
                            <span className="ml-1.5 text-xs text-muted-foreground">{count || ''}</span>
                        </button>
                    );
                })}
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
                {BANNER_PLACEMENT_INFO[placement].description} Thứ tự trên website theo thứ tự dưới đây.
            </p>

            {placement === 'POPUP' && runningPopups > 1 && (
                <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <TriangleAlert className="size-4 shrink-0" />
                    Đang có {runningPopups} popup cùng chạy. Website chỉ hiện popup đầu tiên, nên tắt bớt.
                </p>
            )}

            {query.isPending ? (
                <LoadingRows rows={4} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : banners.length === 0 ? (
                <EmptyState message="Vị trí này chưa có banner nào" action={addButton} />
            ) : (
                <div className="divide-y rounded-lg border">
                    {banners.map((banner, index) => (
                        <div key={banner.id} className={cn('flex flex-wrap items-center gap-4 p-3', banner.state !== 'RUNNING' && 'opacity-70')}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn */}
                            <img
                                src={banner.desktop.url.endsWith('.webp') ? imageUrl(banner.desktop.url, 'sm') : banner.desktop.url}
                                alt=""
                                className="h-20 w-48 shrink-0 rounded-md border bg-muted object-cover"
                            />
                            <div className="min-w-56 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{banner.title}</span>
                                    <Badge variant={STATE_BADGE[banner.state]}>{BANNER_STATE_LABEL[banner.state]}</Badge>
                                    {!banner.mobile && <span className="text-xs text-muted-foreground">Chưa có ảnh điện thoại</span>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {banner.startsAt || banner.endsAt
                                        ? `${banner.startsAt ? formatDateTimeVn(banner.startsAt) : 'Ngay khi bật'} → ${banner.endsAt ? formatDateTimeVn(banner.endsAt) : 'đến khi tắt'}`
                                        : 'Không giới hạn thời gian'}
                                    {placement === 'CATEGORY_TOP' && ` · ${banner.category?.name ?? 'Mọi danh mục'}`}
                                </p>
                                {banner.linkUrl && (
                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <ExternalLink className="size-3" />
                                        {banner.linkUrl}
                                    </p>
                                )}
                            </div>
                            {canManage && (
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="px-2" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label="Lên">
                                        <ArrowUp className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="px-2" onClick={() => move(index, 1)} disabled={busy || index === banners.length - 1} aria-label="Xuống">
                                        <ArrowDown className="size-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => toggle.mutate(banner)} disabled={busy}>
                                        {banner.isActive ? 'Tắt' : 'Bật'}
                                    </Button>
                                    <Button variant="ghost" size="sm" className="px-2" onClick={() => openDialog(banner)} aria-label="Sửa">
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="px-2 text-destructive" onClick={() => setDeleting(banner)} aria-label="Xóa">
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {editing !== null && (
                <BannerDialog
                    key={dialogKey}
                    open
                    onOpenChange={(open) => !open && setEditing(null)}
                    banner={editing === 'new' ? null : editing}
                    defaultPlacement={placement}
                />
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Xóa banner"
                description={
                    <>
                        Xóa banner <strong>{deleting?.title}</strong>? Ảnh vẫn còn trong Thư viện ảnh. Muốn dùng lại sau thì bấm
                        &quot;Tắt&quot; thay vì xóa.
                    </>
                }
                confirmLabel="Xóa"
                destructive
                loading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id)}
            />
        </>
    );
}