'use client';

import { useRef, useState, type DragEvent } from 'react';
import { ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { imageUrl } from '@ktm/shared';
import { cn } from '@ktm/ui/lib/utils';

export interface PickedImage {
    key: string;
    url: string;
}

/**
 * Khung chọn ảnh: bấm hoặc kéo thả file vào. Chưa có ảnh thì hiện khung lớn,
 * có ảnh rồi thì hiện lưới ảnh kèm ô "+" để thêm tiếp.
 */
export function ImagePicker({
    images,
    onFiles,
    onRemove,
    uploading,
    disabled,
    label = 'Chọn ảnh biến thể',
}: {
    images: PickedImage[];
    onFiles: (files: File[]) => void;
    onRemove?: (key: string) => void;
    uploading?: boolean;
    disabled?: boolean;
    label?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const blocked = disabled || uploading;

    function open() {
        if (!blocked) inputRef.current?.click();
    }

    const dropHandlers = {
        onDragOver: (event: DragEvent) => {
            event.preventDefault();
            if (!blocked) setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (event: DragEvent) => {
            event.preventDefault();
            setDragging(false);
            if (blocked) return;
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0) onFiles(files);
        },
    };

    const input = (
        <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                // Cho phép chọn lại đúng file vừa chọn
                event.target.value = '';
                if (files.length > 0) onFiles(files);
            }}
        />
    );

    if (images.length === 0) {
        return (
            <button
                type="button"
                onClick={open}
                disabled={blocked}
                {...dropHandlers}
                className={cn(
                    'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60',
                    dragging && 'border-primary bg-primary/5',
                )}
            >
                {uploading ? <Loader2 className="size-7 animate-spin" /> : <ImageIcon className="size-7" />}
                {uploading ? 'Đang tải ảnh lên...' : label}
                <span className="text-xs">Bấm để chọn hoặc kéo thả ảnh vào đây</span>
                {input}
            </button>
        );
    }

    return (
        <div {...dropHandlers} className={cn('flex flex-wrap gap-2 rounded-lg', dragging && 'bg-primary/5')}>
            {images.map((image) => (
                <div key={image.key} className="group relative size-24 overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn */}
                    <img src={imageUrl(image.url, 'sm')} alt="" className="size-full object-contain" />
                    {onRemove && !blocked && (
                        <button
                            type="button"
                            onClick={() => onRemove(image.key)}
                            className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                            aria-label="Gỡ ảnh"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>
            ))}
            <button
                type="button"
                onClick={open}
                disabled={blocked}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60"
            >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                {uploading ? 'Đang tải...' : 'Thêm ảnh'}
            </button>
            {input}
        </div>
    );
}