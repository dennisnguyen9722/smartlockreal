'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { imageUrl } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { checkImageFile, useProductImages } from '@/lib/product-images';
import type { ProductDetail } from '@/lib/product-types';

/**
 * Ảnh đại diện = ảnh đầu tiên của sản phẩm. Đổi ảnh: tải lên, gắn vào sản phẩm,
 * rồi đưa lên vị trí đầu. Ảnh cũ vẫn giữ trong tab Ảnh (xếp thứ hai).
 */
export function ProductCoverCard({ product, onOpenMediaTab }: { product: ProductDetail; onOpenMediaTab: () => void }) {
    const queryClient = useQueryClient();
    const { can, authFetch } = useAuth();
    const canManage = can('catalog.manage');
    const { upload, attach } = useProductImages(product.id);
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    const cover = product.media[0];

    async function replaceCover(file: File) {
        const problem = checkImageFile(file);
        if (problem) {
            toast.error(problem);
            return;
        }
        setBusy(true);
        try {
            const asset = await upload(file);

            let mediaId: string;
            try {
                mediaId = (await attach(asset.id, null)).id;
            } catch (error) {
                // Ảnh này đã gắn làm ảnh chung từ trước: chỉ cần đưa lên đầu
                const existing = product.media.find((item) => item.url === asset.url && !item.variantId);
                if (!(error instanceof ApiError && error.code === 'ALREADY_EXISTS') || !existing) throw error;
                mediaId = existing.id;
            }

            const others = product.media.map((item) => item.id).filter((id) => id !== mediaId);
            await authFetch(`/catalog/products/${product.id}/media/order`, {
                method: 'PATCH',
                body: JSON.stringify({ mediaIds: [mediaId, ...others] }),
            });
            toast.success('Đã đổi ảnh đại diện');
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['product', product.id] }),
                queryClient.invalidateQueries({ queryKey: ['products'] }),
            ]);
            setBusy(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ảnh đại diện</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                    <img
                        src={imageUrl(cover.url, 'md')}
                        alt={cover.altText ?? product.name}
                        className="aspect-square w-full rounded-lg border bg-muted object-contain"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={!canManage || busy}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="size-7 animate-spin" /> : <ImageIcon className="size-7" />}
                        {busy ? 'Đang tải lên...' : canManage ? 'Chọn ảnh đại diện' : 'Chưa có ảnh'}
                    </button>
                )}

                {canManage && (
                    <div className="flex gap-2">
                        {cover && (
                            <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={busy}>
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                Đổi ảnh
                            </Button>
                        )}
                        <Button variant="ghost" className="flex-1" onClick={onOpenMediaTab}>
                            Mọi ảnh ({product.media.length})
                        </Button>
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void replaceCover(file);
                    }}
                />
            </CardContent>
        </Card>
    );
}