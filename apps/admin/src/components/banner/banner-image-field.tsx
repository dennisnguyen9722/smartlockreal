'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, TriangleAlert, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { imageUrl } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { errorText } from '@/lib/error-text';

export interface BannerMedia {
    id: string;
    url: string;
    width: number | null;
    height: number | null;
}

/**
 * Ô ảnh banner: tải lên Thư viện ảnh, giữ id ảnh (khóa ngoại).
 * Ảnh lệch tỉ lệ khuyến nghị quá 15% thì nhắc (website sẽ cắt bớt ảnh cho vừa khung).
 */
export function BannerImageField({
    value,
    onChange,
    size,
    optional,
    error,
}: {
    value: BannerMedia | null;
    onChange: (next: BannerMedia | null) => void;
    /** Kích thước khuyến nghị [rộng, cao] */
    size: [number, number];
    optional?: boolean;
    error?: string;
}) {
    const { authFetch, can } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [width, height] = size;

    async function upload(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const asset = await authFetch<BannerMedia>('/media/upload', { method: 'POST', body: form });
            onChange({ id: asset.id, url: asset.url, width: asset.width, height: asset.height });
        } catch (uploadError) {
            toast.error(errorText(uploadError));
        } finally {
            setUploading(false);
        }
    }

    const ratioOff =
        value?.width && value.height ? Math.abs(value.width / value.height - width / height) / (width / height) > 0.15 : false;
    const tooSmall = value?.width ? value.width < width * 0.75 : false;

    return (
        <div className="space-y-2">
            <div
                className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg border bg-muted ${error ? 'border-destructive' : ''}`}
                style={{ aspectRatio: `${width} / ${height}`, maxHeight: 260 }}
            >
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                    <img src={value.url.endsWith('.webp') ? imageUrl(value.url, 'md') : value.url} alt="" className="size-full object-cover" />
                ) : (
                    <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="size-6" />
                        {width} × {height}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || !can('content.manage')}>
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {uploading ? 'Đang tải...' : value ? 'Đổi ảnh' : 'Tải ảnh lên'}
                </Button>
                {value && optional && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                        <X className="size-4" />
                        Gỡ
                    </Button>
                )}
                <span className="text-xs text-muted-foreground">
                    Nên {width} × {height}
                    {value?.width && value.height ? ` · ảnh này ${value.width} × ${value.height}` : ''}
                </span>
            </div>
            {error ? (
                <p className="text-xs text-destructive">{error}</p>
            ) : (
                (ratioOff || tooSmall) && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-600">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        {ratioOff ? 'Ảnh lệch tỉ lệ khuyến nghị, website sẽ cắt bớt mép ảnh cho vừa khung.' : 'Ảnh hơi nhỏ, có thể bị mờ trên màn hình lớn.'}
                    </p>
                )
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void upload(file);
                }}
            />
        </div>
    );
}