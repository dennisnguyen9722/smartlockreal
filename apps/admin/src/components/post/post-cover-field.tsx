'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { imageUrl } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { errorText } from '@/lib/error-text';

/** Ảnh bìa bài viết: tải lên Thư viện ảnh, bài giữ id ảnh (khóa ngoại, không xóa nhầm được) */
export function PostCoverField({
    value,
    onChange,
    disabled,
}: {
    value: { id: string; url: string } | null;
    onChange: (next: { id: string; url: string } | null) => void;
    disabled?: boolean;
}) {
    const { authFetch, can } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    async function upload(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const asset = await authFetch<{ id: string; url: string }>('/media/upload', { method: 'POST', body: form });
            onChange({ id: asset.id, url: asset.url });
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="space-y-2">
            <div className="relative flex aspect-[1200/630] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                    <img src={value.url.endsWith('.webp') ? imageUrl(value.url, 'md') : value.url} alt="" className="size-full object-cover" />
                ) : (
                    <ImageIcon className="size-8 text-muted-foreground" />
                )}
            </div>
            {!disabled && (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading || !can('content.manage')}
                    >
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {uploading ? 'Đang tải...' : value ? 'Đổi ảnh' : 'Tải ảnh bìa'}
                    </Button>
                    {value && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                            <X className="size-4" />
                            Gỡ
                        </Button>
                    )}
                </div>
            )}
            <p className="text-xs text-muted-foreground">Nên 1200 × 630. Hiện ở danh sách bài và khi chia sẻ link.</p>
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