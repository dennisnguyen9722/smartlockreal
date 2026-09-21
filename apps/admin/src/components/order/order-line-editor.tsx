'use client';

import { useState } from 'react';
import { ImageIcon, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { imageUrl, type OrderLineInput, type Paginated } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { cn } from '@ktm/ui/lib/utils';
import { PriceInput } from '@/components/price-input';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { useDebounced } from '@/lib/use-debounced';

/** Một dòng đang soạn */
export interface LineDraft {
    key: string;
    variantId: string;
    name: string;
    sku: string;
    /** Giá niêm yết (chưa VAT) lúc thêm vào */
    listPrice: number;
    quantity: number;
    /** Chuỗi chữ số, cho PriceInput */
    unitPrice: string;
    image?: string | null;
    /**
     * Dòng có sẵn trong đơn: luôn gửi kèm giá đã chốt với khách, để nếu giá niêm yết
     * đã đổi kể từ lúc đặt thì đơn cũng không tự đổi giá.
     */
    keepPrice?: boolean;
}

/** Dữ liệu gửi API. Dòng mới chỉ gửi unitPrice khi nhân viên sửa giá. */
export function toLineInputs(lines: LineDraft[]): OrderLineInput[] {
    return lines.map((line) => {
        const unitPrice = Number(line.unitPrice || 0);
        return {
            variantId: line.variantId,
            quantity: line.quantity,
            ...(line.keepPrice || unitPrice !== line.listPrice ? { unitPrice } : {}),
        };
    });
}

const PERCENT = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
function formatPercent(ratio: number): string {
    return PERCENT.format(ratio);
}

/** % giảm lớn nhất so với giá hệ thống (0..1), để cảnh báo báo giá cần duyệt */
export function maxDiscountRatio(lines: LineDraft[]): number {
    return lines.reduce((max, line) => {
        if (line.listPrice <= 0) return max;
        return Math.max(max, (line.listPrice - Number(line.unitPrice || 0)) / line.listPrice);
    }, 0);
}

export function linesSubtotal(lines: LineDraft[]): number {
    return lines.reduce((sum, line) => sum + Number(line.unitPrice || 0) * line.quantity, 0);
}

interface ProductOption {
    id: string;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    variants: { id: string; sku: string; name: string; price: number; isActive: boolean }[];
    media: { url: string }[];
}

const DEFAULT_VARIANT_NAME = 'Mặc định';

export function OrderLineEditor({
    lines,
    onChange,
    disabled,
    error,
    showDiscount,
    priceLabel = 'Niêm yết',
}: {
    lines: LineDraft[];
    onChange: (lines: LineDraft[]) => void;
    disabled?: boolean;
    error?: string;
    /** Báo giá: hiện % giảm so với giá hệ thống ở từng dòng */
    showDiscount?: boolean;
    priceLabel?: string;
}) {
    function add(product: ProductOption, variant: ProductOption['variants'][number]) {
        const existing = lines.find((line) => line.variantId === variant.id);
        if (existing) {
            // Chọn lại sản phẩm đã có: tăng số lượng thay vì thêm dòng trùng
            onChange(lines.map((line) => (line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line)));
            return;
        }
        onChange([
            ...lines,
            {
                key: `${variant.id}-${Date.now()}`,
                variantId: variant.id,
                name: variant.name === DEFAULT_VARIANT_NAME ? product.name : `${product.name} - ${variant.name}`,
                sku: variant.sku,
                listPrice: variant.price,
                quantity: 1,
                unitPrice: String(variant.price),
                image: product.media[0]?.url ?? null,
            },
        ]);
    }

    function update(key: string, patch: Partial<LineDraft>) {
        onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    }

    return (
        <div className="space-y-3">
            {!disabled && <ProductPicker onPick={add} />}

            {lines.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Chưa có sản phẩm. Gõ tên, mã model hoặc SKU vào ô tìm kiếm ở trên.
                </p>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {lines.map((line) => {
                        const price = Number(line.unitPrice || 0);
                        const changed = price !== line.listPrice;
                        return (
                            <li key={line.key} className="flex flex-wrap items-center gap-3 p-3">
                                {line.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                                    <img src={imageUrl(line.image, 'sm')} alt="" className="size-12 shrink-0 rounded border object-contain" />
                                ) : (
                                    <span className="flex size-12 shrink-0 items-center justify-center rounded border border-dashed">
                                        <ImageIcon className="size-4 text-muted-foreground" />
                                    </span>
                                )}
                                <div className="min-w-40 flex-1">
                                    <p className="text-sm font-medium">{line.name}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                                </div>

                                <div className="flex items-center">
                                    <Button
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => update(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                                        disabled={disabled || line.quantity <= 1}
                                        aria-label="Giảm số lượng"
                                    >
                                        <Minus className="size-3.5" />
                                    </Button>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={999}
                                        value={line.quantity}
                                        onChange={(event) =>
                                            update(line.key, { quantity: Math.min(999, Math.max(1, Number(event.target.value) || 1)) })
                                        }
                                        disabled={disabled}
                                        className="h-8 w-14 text-center tabular-nums"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => update(line.key, { quantity: Math.min(999, line.quantity + 1) })}
                                        disabled={disabled}
                                        aria-label="Tăng số lượng"
                                    >
                                        <Plus className="size-3.5" />
                                    </Button>
                                </div>

                                <div className="w-36">
                                    <PriceInput
                                        value={line.unitPrice}
                                        onChange={(unitPrice) => update(line.key, { unitPrice })}
                                        disabled={disabled}
                                        className="h-8"
                                    />
                                    {changed && (
                                        <button
                                            type="button"
                                            className="mt-0.5 text-xs text-muted-foreground hover:underline"
                                            onClick={() => update(line.key, { unitPrice: String(line.listPrice) })}
                                            disabled={disabled}
                                        >
                                            {priceLabel} {formatVnd(line.listPrice)}
                                        </button>
                                    )}
                                    {showDiscount && changed && line.listPrice > 0 && (
                                        <p className={cn('text-xs font-medium', price < line.listPrice ? 'text-green-600' : 'text-amber-600')}>
                                            {price < line.listPrice
                                                ? `Giảm ${formatPercent((line.listPrice - price) / line.listPrice)}`
                                                : `Cao hơn ${formatPercent((price - line.listPrice) / line.listPrice)}`}
                                        </p>
                                    )}
                                </div>

                                <span className="w-28 text-right text-sm font-semibold tabular-nums">{formatVnd(price * line.quantity)}</span>

                                {!disabled && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                                        aria-label={`Bỏ ${line.name}`}
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {lines.length > 0 && (
                <p className="text-right text-sm">
                    Tạm tính (chưa VAT): <strong className="tabular-nums">{formatVnd(linesSubtotal(lines))}</strong>
                </p>
            )}
        </div>
    );
}

/** Ô tìm sản phẩm: gõ tên, mã model hoặc SKU; mỗi biến thể là một dòng để chọn */
function ProductPicker({ onPick }: { onPick: (product: ProductOption, variant: ProductOption['variants'][number]) => void }) {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const search = useDebounced(input.trim());

    // Không truyền status: API tự bỏ sản phẩm lưu trữ
    const query = useApiQuery<Paginated<ProductOption>>(
        ['products', 'picker', search],
        `/catalog/products?pageSize=8&search=${encodeURIComponent(search)}`,
        { enabled: search.length >= 2 },
    );

    const options = (query.data?.items ?? []).flatMap((product) =>
        product.variants.filter((variant) => variant.isActive).map((variant) => ({ product, variant })),
    );

    return (
        <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={input}
                onChange={(event) => {
                    setInput(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                // Trễ một chút để kịp nhận cú bấm chọn sản phẩm
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Tìm sản phẩm theo tên, mã model hoặc SKU..."
                className="pl-9"
            />
            {open && search.length >= 2 && (
                <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {query.isFetching && options.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">Đang tìm...</p>
                    ) : options.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">Không tìm thấy sản phẩm nào</p>
                    ) : (
                        options.map(({ product, variant }) => (
                            <button
                                key={variant.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onPick(product, variant);
                                    setInput('');
                                    setOpen(false);
                                }}
                                className={cn('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted')}
                            >
                                {product.media[0] ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                                    <img src={imageUrl(product.media[0].url, 'sm')} alt="" className="size-10 shrink-0 rounded border object-contain" />
                                ) : (
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded border border-dashed">
                                        <ImageIcon className="size-4 text-muted-foreground" />
                                    </span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {product.name}
                                        {variant.name !== DEFAULT_VARIANT_NAME && ` - ${variant.name}`}
                                    </span>
                                    <span className="block font-mono text-xs text-muted-foreground">{variant.sku}</span>
                                </span>
                                {product.status === 'DRAFT' && <Badge variant="outline">Nháp</Badge>}
                                <span className="text-sm tabular-nums">
                                    {variant.price > 0 ? formatVnd(variant.price) : <span className="text-destructive">Chưa có giá</span>}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}