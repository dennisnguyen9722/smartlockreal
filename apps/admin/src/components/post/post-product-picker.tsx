'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ImageIcon, Plus, Search, X } from 'lucide-react';
import { POST_MAX_PRODUCTS, imageUrl, type Paginated } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { useApiQuery } from '@/lib/hooks';
import type { PostProductRef } from '@/lib/post-form';
import { useDebounced } from '@/lib/use-debounced';

interface ProductRow {
    id: string;
    name: string;
    status: string;
    media: { url: string }[];
    brand: { name: string } | null;
}

function Thumb({ url }: { url: string | null }) {
    return (
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
            {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                <img src={url.endsWith('.webp') ? imageUrl(url, 'sm') : url} alt="" className="size-full object-cover" />
            ) : (
                <ImageIcon className="size-4 text-muted-foreground" />
            )}
        </div>
    );
}

/** Sản phẩm nhắc tới trong bài: website hiện khối "Sản phẩm trong bài" có nút xem/mua */
export function PostProductPicker({
    value,
    onChange,
    disabled,
}: {
    value: PostProductRef[];
    onChange: (next: PostProductRef[]) => void;
    disabled?: boolean;
}) {
    const [search, setSearch] = useState('');
    const term = useDebounced(search.trim());
    const results = useApiQuery<Paginated<ProductRow>>(
        ['products', 'picker', term],
        `/catalog/products?pageSize=8&search=${encodeURIComponent(term)}`,
        { enabled: term.length >= 2 },
    );
    const full = value.length >= POST_MAX_PRODUCTS;

    function move(index: number, offset: number) {
        const target = index + offset;
        if (target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target] as PostProductRef, next[index] as PostProductRef];
        onChange(next);
    }

    return (
        <div className="space-y-3">
            {value.length > 0 && (
                <ul className="divide-y rounded-lg border">
                    {value.map((product, index) => (
                        <li key={product.id} className="flex items-center gap-2 p-2 text-sm">
                            <Thumb url={product.coverUrl} />
                            <span className="min-w-0 flex-1">
                                <span className="line-clamp-2">{product.name}</span>
                                {product.status !== 'ACTIVE' && (
                                    <span className="text-xs text-amber-600">Chưa đăng bán, website sẽ không hiện</span>
                                )}
                            </span>
                            {!disabled && (
                                <span className="flex shrink-0">
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Lên">
                                        <ArrowUp className="size-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label="Xuống">
                                        <ArrowDown className="size-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-destructive" onClick={() => onChange(value.filter((item) => item.id !== product.id))} aria-label="Bỏ">
                                        <X className="size-4" />
                                    </Button>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!disabled && !full && (
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm để gắn vào bài" className="pl-9" />
                    </div>
                    {term.length >= 2 && (
                        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                            {results.isPending ? (
                                <li className="p-3 text-sm text-muted-foreground">Đang tìm...</li>
                            ) : (results.data?.items ?? []).length === 0 ? (
                                <li className="p-3 text-sm text-muted-foreground">Không tìm thấy sản phẩm</li>
                            ) : (
                                (results.data?.items ?? []).map((product) => {
                                    const added = value.some((item) => item.id === product.id);
                                    return (
                                        <li key={product.id}>
                                            <button
                                                type="button"
                                                disabled={added}
                                                onClick={() =>
                                                    onChange([
                                                        ...value,
                                                        { id: product.id, name: product.name, status: product.status, coverUrl: product.media[0]?.url ?? null },
                                                    ])
                                                }
                                                className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                            >
                                                <Thumb url={product.media[0]?.url ?? null} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="line-clamp-1">{product.name}</span>
                                                    <span className="text-xs text-muted-foreground">{product.brand?.name}</span>
                                                </span>
                                                {added ? <span className="text-xs text-muted-foreground">Đã gắn</span> : <Plus className="size-4" />}
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    )}
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                Tối đa {POST_MAX_PRODUCTS} sản phẩm, theo thứ tự trên. {full && 'Đã đủ số lượng.'}
            </p>
        </div>
    );
}