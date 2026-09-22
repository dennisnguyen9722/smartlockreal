'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { imageUrl } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { errorText } from '@/lib/error-text';

/**
 * Ô ảnh của trang Cấu hình (logo, ảnh chia sẻ).
 * Tải lên thì ảnh vào Thư viện ảnh như mọi ảnh khác; ô chỉ giữ đường dẫn.
 * Ảnh chỉ thật sự được dùng khi bấm "Lưu thay đổi".
 */
export function SettingImageField({
    value,
    onChange,
    disabled,
    invalid,
}: {
    value: string;
    onChange: (url: string) => void;
    disabled?: boolean;
    invalid?: boolean;
}) {
    const { authFetch, can } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const canUpload = can('content.manage');

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
            <div
                className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted ${invalid ? 'border-destructive' : ''}`}
            >
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                    <img src={value.endsWith('.webp') ? imageUrl(value, 'sm') : value} alt="" className="size-full object-contain" />
                ) : (
                    <ImageIcon className="size-7 text-muted-foreground" />
                )}
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled || uploading || !canUpload}
                    >
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {uploading ? 'Đang tải lên...' : value ? 'Đổi ảnh' : 'Tải ảnh lên'}
                    </Button>
                    {value && (
                        <Button type="button" variant="ghost" onClick={() => onChange('')} disabled={disabled || uploading}>
                            <X className="size-4" />
                            Gỡ ảnh
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    {canUpload ? 'JPEG, PNG hoặc WebP. Ảnh cũng được lưu vào Thư viện ảnh.' : 'Bạn không có quyền tải ảnh lên.'}
                </p>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Cho phép chọn lại đúng file vừa chọn
                    event.target.value = '';
                    if (file) void upload(file);
                }}
            />
        </div>
    );
}