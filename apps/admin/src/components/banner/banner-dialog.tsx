'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
    BANNER_PLACEMENTS,
    BANNER_PLACEMENT_INFO,
    BannerCreateSchema,
    BannerUpdateSchema,
    type BannerItem,
    type BannerPlacementValue,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ktm/ui/components/dialog';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { BannerImageField, type BannerMedia } from '@/components/banner/banner-image-field';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { fromLocalInput, toLocalInput } from '@/lib/order-types';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

interface CategoryNode {
    id: string;
    name: string;
    children: CategoryNode[];
}

const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

interface Draft {
    title: string;
    placement: BannerPlacementValue;
    desktop: BannerMedia | null;
    mobile: BannerMedia | null;
    linkUrl: string;
    altText: string;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
    categoryId: string;
}

function draftFrom(banner: BannerItem | null, placement: BannerPlacementValue): Draft {
    return {
        title: banner?.title ?? '',
        placement: banner?.placement ?? placement,
        desktop: banner?.desktop ?? null,
        mobile: banner?.mobile ?? null,
        linkUrl: banner?.linkUrl ?? '',
        altText: banner?.altText ?? '',
        startsAt: toLocalInput(banner?.startsAt ?? null),
        endsAt: toLocalInput(banner?.endsAt ?? null),
        isActive: banner?.isActive ?? true,
        categoryId: banner?.category?.id ?? '',
    };
}

function toBody(draft: Draft) {
    return {
        title: draft.title.trim(),
        placement: draft.placement,
        desktopMediaId: draft.desktop?.id ?? '',
        mobileMediaId: draft.mobile?.id ?? null,
        linkUrl: draft.linkUrl.trim(),
        altText: draft.altText.trim() || null,
        startsAt: fromLocalInput(draft.startsAt),
        endsAt: fromLocalInput(draft.endsAt),
        isActive: draft.isActive,
        categoryId: draft.placement === 'CATEGORY_TOP' ? draft.categoryId || null : null,
    };
}

/** Thêm/sửa banner. Mở với banner = null để thêm mới vào vị trí đang xem */
export function BannerDialog({
    open,
    onOpenChange,
    banner,
    defaultPlacement,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    banner: BannerItem | null;
    defaultPlacement: BannerPlacementValue;
}) {
    // key ở nơi gọi đảm bảo mỗi lần mở là một form mới
    const [draft, setDraft] = useState<Draft>(() => draftFrom(banner, defaultPlacement));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const info = BANNER_PLACEMENT_INFO[draft.placement];

    const categories = useApiQuery<CategoryNode[]>(['categories', 'tree'], '/catalog/categories/tree', {
        enabled: draft.placement === 'CATEGORY_TOP',
    });
    const flatCategories: { id: string; name: string; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
        for (const node of nodes) {
            flatCategories.push({ id: node.id, name: node.name, depth });
            walk(node.children, depth + 1);
        }
    };
    walk(categories.data ?? [], 0);

    const save = useApiMutation<BannerItem, Record<string, unknown>>(
        (body) => (banner ? { path: `/banners/${banner.id}`, method: 'PATCH', body } : { path: '/banners', method: 'POST', body }),
        {
            invalidate: [['banners']],
            onSuccess: () => {
                toast.success(banner ? 'Đã lưu banner' : 'Đã thêm banner');
                onOpenChange(false);
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    toast.error('Có người vừa sửa banner này. Đóng hộp thoại rồi mở lại để xem bản mới nhất.');
                    return;
                }
                const fields = apiFieldErrors(error);
                if (fields) {
                    setErrors(fields);
                    return;
                }
                toast.error(errorText(error));
            },
        },
    );

    function set<K extends keyof Draft>(key: K, value: Draft[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
        setErrors((current) => {
            const next = { ...current };
            delete next[key === 'desktop' ? 'desktopMediaId' : key === 'mobile' ? 'mobileMediaId' : key];
            return next;
        });
    }

    function submit() {
        const body = toBody(draft);
        const parsed = banner
            ? BannerUpdateSchema.safeParse({ ...body, expectedUpdatedAt: banner.updatedAt })
            : BannerCreateSchema.safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors([...parsed.error.issues]));
            return;
        }
        setErrors({});
        save.mutate(banner ? { ...body, expectedUpdatedAt: banner.updatedAt } : body);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{banner ? 'Sửa banner' : 'Thêm banner'}</DialogTitle>
                    <DialogDescription>{info.description}</DialogDescription>
                </DialogHeader>

                <fieldset disabled={save.isPending} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Tên banner *</Label>
                            <Input value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Khuyến mãi Tết 2027" autoFocus />
                            {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : <p className="text-xs text-muted-foreground">Chỉ để nhận biết trong CMS</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Vị trí *</Label>
                            <select value={draft.placement} onChange={(event) => set('placement', event.target.value as BannerPlacementValue)} className={SELECT}>
                                {BANNER_PLACEMENTS.map((placement) => (
                                    <option key={placement} value={placement}>
                                        {BANNER_PLACEMENT_INFO[placement].label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {draft.placement === 'CATEGORY_TOP' && (
                        <div className="space-y-1.5">
                            <Label>Danh mục</Label>
                            <select value={draft.categoryId} onChange={(event) => set('categoryId', event.target.value)} className={SELECT}>
                                <option value="">Mọi danh mục</option>
                                {flatCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {'\u00A0\u00A0'.repeat(category.depth)}
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
                        <div className="space-y-1.5">
                            <Label>Ảnh máy tính *</Label>
                            <BannerImageField value={draft.desktop} onChange={(media) => set('desktop', media)} size={info.desktopSize} error={errors.desktopMediaId} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Ảnh điện thoại</Label>
                            <BannerImageField value={draft.mobile} onChange={(media) => set('mobile', media)} size={info.mobileSize} optional error={errors.mobileMediaId} />
                            {!draft.mobile && <p className="text-xs text-muted-foreground">Bỏ trống thì dùng ảnh máy tính (chữ trên ảnh có thể bị nhỏ)</p>}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Link khi bấm vào</Label>
                            <Input value={draft.linkUrl} onChange={(event) => set('linkUrl', event.target.value)} placeholder="/khuyen-mai hoặc https://..." />
                            {errors.linkUrl ? <p className="text-xs text-destructive">{errors.linkUrl}</p> : <p className="text-xs text-muted-foreground">Bỏ trống: banner không bấm được</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mô tả ảnh</Label>
                            <Input value={draft.altText} onChange={(event) => set('altText', event.target.value)} placeholder="Bỏ trống thì dùng tên banner" />
                            <p className="text-xs text-muted-foreground">Cho Google và người dùng trình đọc màn hình</p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Bắt đầu hiện</Label>
                            <Input type="datetime-local" value={draft.startsAt} onChange={(event) => set('startsAt', event.target.value)} />
                            <p className="text-xs text-muted-foreground">Bỏ trống: hiện ngay khi lưu</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Kết thúc</Label>
                            <Input type="datetime-local" value={draft.endsAt} onChange={(event) => set('endsAt', event.target.value)} />
                            {errors.endsAt ? <p className="text-xs text-destructive">{errors.endsAt}</p> : <p className="text-xs text-muted-foreground">Bỏ trống: hiện đến khi tắt</p>}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={draft.isActive} onChange={(event) => set('isActive', event.target.checked)} className="size-4" />
                        Bật banner
                    </label>
                </fieldset>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                        Hủy
                    </Button>
                    <Button onClick={submit} disabled={save.isPending}>
                        {save.isPending ? 'Đang lưu...' : banner ? 'Lưu' : 'Thêm banner'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}