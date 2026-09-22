'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { SHOWROOM_MAX_IMAGES, imageUrl } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { errorText } from '@/lib/error-text';

/**
 * Ảnh showroom: ảnh đầu tiên là ảnh đại diện. Tải lên thì ảnh vào Thư viện ảnh;
 * chỉ được gắn vào showroom khi bấm "Lưu thay đổi".
 */
export function ShowroomImages({
    value,
    onChange,
    disabled,
    error,
}: {
    value: string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
    error?: string;
}) {
    const { authFetch, can } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const canUpload = can('content.manage');
    const remaining = SHOWROOM_MAX_IMAGES - value.length;

    async function upload(files: File[]) {
        const picked = files.slice(0, remaining);
        if (files.length > remaining) toast.info(`Chỉ thêm được ${remaining} ảnh nữa (tối đa ${SHOWROOM_MAX_IMAGES})`);
        if (picked.length === 0) return;

        setUploading(true);
        const added: string[] = [];
        try {
            // Tải lần lượt: ảnh nào lỗi thì báo, các ảnh khác vẫn giữ
            for (const file of picked) {
                try {
                    const form = new FormData();
                    form.append('file', file);
                    const asset = await authFetch<{ url: string }>('/media/upload', { method: 'POST', body: form });
                    if (!value.includes(asset.url) && !added.includes(asset.url)) added.push(asset.url);
                } catch (uploadError) {
                    toast.error(`${file.name}: ${errorText(uploadError)}`);
                }
            }
        } finally {
            setUploading(false);
        }
        if (added.length > 0) onChange([...value, ...added]);
    }

    function move(index: number, offset: number) {
        const target = index + offset;
        if (target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target] as string, next[index] as string];
        onChange(next);
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-3">
                {value.map((url, index) => (
                    <div key={url} className="group relative w-36 overflow-hidden rounded-lg border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn */}
                        <img src={url.endsWith('.webp') ? imageUrl(url, 'sm') : url} alt="" className="aspect-[4/3] w-full object-cover" />
                        {index === 0 && (
                            <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                                <Star className="size-3" />
                                Ảnh đại diện
                            </span>
                        )}
                        {!disabled && (
                            <div className="flex items-center justify-between bg-background/90 px-1 py-0.5">
                                <div className="flex">
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Đưa lên trước">
                                        <ArrowLeft className="size-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label="Đưa ra sau">
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </div>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-destructive" onClick={() => onChange(value.filter((item) => item !== url))} aria-label="Gỡ ảnh">
                                    <X className="size-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                ))}

                {remaining > 0 && !disabled && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading || !canUpload}
                        className="flex aspect-[4/3] w-36 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60"
                    >
                        {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                        {uploading ? 'Đang tải...' : 'Thêm ảnh'}
                    </button>
                )}
            </div>
            {error ? (
                <p className="text-xs text-destructive">{error}</p>
            ) : (
                <p className="text-xs text-muted-foreground">
                    Tối đa {SHOWROOM_MAX_IMAGES} ảnh, ảnh đầu tiên làm ảnh đại diện. Nên chụp mặt tiền và khu trưng bày.
                    {!canUpload && ' Bạn không có quyền tải ảnh lên.'}
                </p>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    if (files.length > 0) void upload(files);
                }}
            />
        </div>
    );
}