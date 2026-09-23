'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { imageUrl } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { errorText } from '@/lib/error-text';

/**
 * Logo hãng: tải lên Thư viện ảnh, hãng giữ đường dẫn ảnh.
 * Ảnh đang làm logo không xóa được ở Thư viện ảnh (ImageService.remove có kiểm tra).
 * Nền ô để trong suốt và ảnh dùng object-contain vì logo thường có nền trắng hoặc trong suốt.
 */
export function BrandLogoField({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (url: string) => void;
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
            const asset = await authFetch<{ url: string }>('/media/upload', { method: 'POST', body: form });
            onChange(asset.url);
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                    <img src={value.endsWith('.webp') ? imageUrl(value, 'sm') : value} alt="" className="size-full object-contain p-1.5" />
                ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                )}
            </div>
            <div className="space-y-1.5">
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled || uploading || !can('content.manage')}
                    >
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {uploading ? 'Đang tải...' : value ? 'Đổi logo' : 'Tải logo lên'}
                    </Button>
                    {value && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={disabled || uploading}>
                            <X className="size-4" />
                            Gỡ
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">Nền trong suốt (PNG) hoặc nền trắng, cạnh dài khoảng 400px.</p>
            </div>
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
