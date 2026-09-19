'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { imageUrl } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { useAuth } from '@/components/auth-provider';
import { ImagePicker } from '@/components/image-picker';
import { errorText } from '@/lib/error-text';
import { checkImageFile, useProductImages } from '@/lib/product-images';
import type { ProductDetail } from '@/lib/product-types';

/**
 * Mọi ảnh của sản phẩm (ảnh chung + ảnh riêng từng biến thể) theo thứ tự hiển thị.
 * Ảnh đầu tiên là ảnh đại diện ở danh sách sản phẩm trên website.
 */
export function ProductMediaTab({ product }: { product: ProductDetail }) {
    const queryClient = useQueryClient();
    const { can, authFetch } = useAuth();
    const canManage = can('catalog.manage');
    const { upload, attach, detach } = useProductImages(product.id);
    const [busy, setBusy] = useState(false);

    const media = product.media;

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ['product', product.id] }),
            queryClient.invalidateQueries({ queryKey: ['products'] }),
        ]);

    async function run(task: () => Promise<void>, success?: string) {
        setBusy(true);
        try {
            await task();
            await refresh();
            if (success) toast.success(success);
        } catch (error) {
            await refresh();
            toast.error(errorText(error));
        } finally {
            setBusy(false);
        }
    }

    function addFiles(files: File[]) {
        const problems = files.map(checkImageFile).filter((problem): problem is string => problem !== null);
        if (problems.length > 0) {
            toast.error(problems.join('; '));
            return;
        }
        void run(async () => {
            for (const file of files) {
                const asset = await upload(file);
                await attach(asset.id, null);
            }
        }, files.length > 1 ? `Đã thêm ${files.length} ảnh` : 'Đã thêm ảnh');
    }

    /** API cần đúng và đủ danh sách ảnh theo thứ tự mới */
    function saveOrder(ids: string[]) {
        void run(async () => {
            await authFetch(`/catalog/products/${product.id}/media/order`, {
                method: 'PATCH',
                body: JSON.stringify({ mediaIds: ids }),
            });
        });
    }

    function move(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= media.length) return;
        const ids = media.map((item) => item.id);
        const current = ids[index];
        const swap = ids[target];
        if (!current || !swap) return;
        ids[index] = swap;
        ids[target] = current;
        saveOrder(ids);
    }

    function makeCover(mediaId: string) {
        saveOrder([mediaId, ...media.map((item) => item.id).filter((id) => id !== mediaId)]);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ảnh sản phẩm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Ảnh đầu tiên là ảnh đại diện. Ảnh gắn cho biến thể sẽ hiện khi khách chọn biến thể đó; thêm ảnh riêng
                    cho biến thể ở tab Biến thể. Tối đa 20 ảnh.
                </p>

                {media.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {media.map((item, index) => (
                            <figure key={item.id} className="overflow-hidden rounded-lg border">
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn */}
                                    <img
                                        src={imageUrl(item.url, 'sm')}
                                        alt={item.altText ?? product.name}
                                        loading="lazy"
                                        className="aspect-square w-full bg-muted object-contain"
                                    />
                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => void run(() => detach(item.id), 'Đã gỡ ảnh')}
                                            disabled={busy}
                                            className="absolute top-1.5 right-1.5 rounded-full bg-destructive p-1 text-white disabled:opacity-50"
                                            aria-label="Gỡ ảnh khỏi sản phẩm"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    )}
                                </div>

                                <figcaption className="space-y-2 p-2 text-xs">
                                    <div className="flex flex-wrap gap-1">
                                        {index === 0 && <Badge>Ảnh đại diện</Badge>}
                                        {item.variant ? (
                                            <Badge variant="outline">{item.variant.name}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">Ảnh chung</span>
                                        )}
                                    </div>

                                    {canManage && media.length > 1 && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={() => move(index, -1)}
                                                disabled={busy || index === 0}
                                                aria-label="Chuyển lên trước"
                                            >
                                                <ChevronLeft />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={() => move(index, 1)}
                                                disabled={busy || index === media.length - 1}
                                                aria-label="Chuyển ra sau"
                                            >
                                                <ChevronRight />
                                            </Button>
                                            {index !== 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => makeCover(item.id)}
                                                    disabled={busy}
                                                    className="ml-auto"
                                                >
                                                    <Star />
                                                    Đại diện
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                )}

                {canManage ? (
                    media.length < 20 && (
                        <ImagePicker
                            images={[]}
                            onFiles={addFiles}
                            uploading={busy}
                            label="Thêm ảnh chung cho sản phẩm"
                        />
                    )
                ) : (
                    media.length === 0 && <p className="text-sm text-muted-foreground">Sản phẩm chưa có ảnh.</p>
                )}
            </CardContent>
        </Card>
    );
}