'use client';

import { Plus, X } from 'lucide-react';
import { buildOptionKey, formatVnd, slugifyVi } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ktm/ui/components/table';

export interface OptionDraft {
    code: string;
    name: string;
    values: { code: string; value: string }[];
}

export interface VariantDraft {
    /** Khóa nhận dạng trong danh sách, chính là tổ hợp tùy chọn */
    key: string;
    optionValues: Record<string, string>;
    name: string;
    sku: string;
    /** Để trống = dùng giá chung của sản phẩm */
    price: string;
    compareAtPrice: string;
}

/**
 * GIÁ BÁN CỦA SẢN PHẨM
 *
 * Trong database, giá lưu ở TỪNG PHIÊN BẢN (đơn hàng, báo giá, khuyến mãi đều gắn theo phiên bản),
 * nên chỉ có MỘT nơi giữ giá, không có chuyện website một giá mà đơn hàng một giá khác.
 *
 * Trên màn hình thì ngược lại, người nhập chỉ cần nghĩ tới "giá của sản phẩm":
 * - Sản phẩm một loại: nhập giá là xong, hệ thống tự tạo một phiên bản mặc định giữ giá đó.
 * - Sản phẩm nhiều phiên bản: giá ở đây là GIÁ CHUNG; phiên bản để trống thì theo giá chung,
 *   phiên bản nhập giá riêng thì dùng giá riêng (lúc gửi đi, ô trống được điền bằng giá chung).
 */
export function VariantBuilder({
    basePrice,
    baseCompareAtPrice,
    baseSku,
    onBaseChange,
    options,
    variants,
    onOptionsChange,
    onVariantsChange,
    errors,
}: {
    basePrice: string;
    baseCompareAtPrice: string;
    baseSku: string;
    onBaseChange: (patch: { price?: string; compareAtPrice?: string; sku?: string }) => void;
    options: OptionDraft[];
    variants: VariantDraft[];
    onOptionsChange: (options: OptionDraft[]) => void;
    onVariantsChange: (variants: VariantDraft[]) => void;
    errors?: Record<string, string>;
}) {
    const hasOptions = options.length > 0;

    /** Sau mỗi thay đổi tùy chọn, tạo lại danh sách phiên bản nhưng GIỮ giá đã nhập */
    function syncVariants(nextOptions: OptionDraft[]) {
        const combinations = buildCombinations(nextOptions.filter((option) => option.code && option.values.some((value) => value.code)));
        const byKey = new Map(variants.map((variant) => [variant.key, variant]));

        const nextVariants = combinations.map((combination) => {
            const key = buildOptionKey(combination);
            const existing = byKey.get(key);
            if (existing) return existing;

            // Tên phiên bản ghép từ nhãn các giá trị đã chọn
            const label = nextOptions
                .map((option) => option.values.find((value) => value.code === combination[option.code])?.value)
                .filter(Boolean)
                .join(' / ');

            return { key, optionValues: combination, name: label || 'Mặc định', sku: '', price: '', compareAtPrice: '' };
        });

        onOptionsChange(nextOptions);
        onVariantsChange(nextVariants);
    }

    function addOption() {
        if (options.length >= 3) return;
        syncVariants([...options, { code: '', name: '', values: [{ code: '', value: '' }] }]);
    }

    function updateOption(index: number, patch: Partial<OptionDraft>) {
        syncVariants(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
    }

    function removeOption(index: number) {
        syncVariants(options.filter((_, i) => i !== index));
    }

    function updateValue(optionIndex: number, valueIndex: number, label: string) {
        const option = options[optionIndex];
        if (!option) return;
        const values = option.values.map((value, i) => (i === valueIndex ? { code: slugifyVi(label) || `gt-${i + 1}`, value: label } : value));
        updateOption(optionIndex, { values });
    }

    function addValue(optionIndex: number) {
        const option = options[optionIndex];
        if (!option) return;
        updateOption(optionIndex, { values: [...option.values, { code: '', value: '' }] });
    }

    function removeValue(optionIndex: number, valueIndex: number) {
        const option = options[optionIndex];
        if (!option) return;
        updateOption(optionIndex, { values: option.values.filter((_, i) => i !== valueIndex) });
    }

    function updateVariant(key: string, patch: Partial<VariantDraft>) {
        onVariantsChange(variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
    }

    const baseNumber = Number(basePrice) || 0;

    return (
        <div className="space-y-6">
            {/* Giá của sản phẩm: luôn hiện, không phụ thuộc có phiên bản hay không */}
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <Label>Giá bán (VND) *</Label>
                    <Input
                        type="number"
                        value={basePrice}
                        onChange={(event) => onBaseChange({ price: event.target.value })}
                        placeholder="0"
                        aria-invalid={Boolean(errors?.['variants.0.price']) || undefined}
                    />
                    {errors?.['variants.0.price'] ? (
                        <p className="text-xs text-destructive">{errors['variants.0.price']}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground">Chưa gồm VAT</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <Label>Giá gạch ngang</Label>
                    <Input
                        type="number"
                        value={baseCompareAtPrice}
                        onChange={(event) => onBaseChange({ compareAtPrice: event.target.value })}
                        placeholder="—"
                    />
                    <p className="text-xs text-muted-foreground">Giá cũ, website hiện gạch ngang bên cạnh</p>
                </div>
                <div className="space-y-1.5">
                    <Label>Mã SKU</Label>
                    <Input
                        value={baseSku}
                        onChange={(event) => onBaseChange({ sku: event.target.value.toUpperCase() })}
                        placeholder="Bỏ trống: tự sinh"
                        className="font-mono text-xs"
                    />
                    {errors?.['variants.0.sku'] && <p className="text-xs text-destructive">{errors['variants.0.sku']}</p>}
                </div>
            </div>
            {errors?.variants && <p className="text-xs text-destructive">{errors.variants}</p>}

            {/* Phiên bản: phần thêm, bỏ qua được */}
            <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <Label>Phiên bản khác nhau</Label>
                        <p className="text-xs text-muted-foreground">
                            {hasOptions
                                ? 'Phiên bản để trống giá thì bán theo giá chung ở trên.'
                                : 'Ví dụ: Màu đen và Màu vàng đồng, hoặc bản dùng app TTLock và bản Tuya. Không có thì bỏ qua.'}
                        </p>
                    </div>
                    {options.length < 3 && (
                        <Button variant="outline" onClick={addOption}>
                            <Plus className="size-4" />
                            Thêm tùy chọn
                        </Button>
                    )}
                </div>

                {options.map((option, optionIndex) => (
                    <div key={optionIndex} className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                            <Input
                                value={option.name}
                                onChange={(event) =>
                                    updateOption(optionIndex, {
                                        name: event.target.value,
                                        code: slugifyVi(event.target.value) || `tuy-chon-${optionIndex + 1}`,
                                    })
                                }
                                placeholder="Tên tùy chọn: Màu"
                                className="max-w-56"
                            />
                            <Button variant="ghost" onClick={() => removeOption(optionIndex)} aria-label="Xóa tùy chọn">
                                <X className="size-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {option.values.map((value, valueIndex) => (
                                <div key={valueIndex} className="flex items-center gap-1">
                                    <Input
                                        value={value.value}
                                        onChange={(event) => updateValue(optionIndex, valueIndex, event.target.value)}
                                        placeholder="Đen"
                                        className="w-36"
                                    />
                                    {option.values.length > 1 && (
                                        <Button variant="ghost" onClick={() => removeValue(optionIndex, valueIndex)} aria-label="Xóa giá trị">
                                            <X className="size-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button variant="ghost" onClick={() => addValue(optionIndex)} className="h-9 px-2 text-xs">
                                <Plus className="size-3" />
                                Thêm giá trị
                            </Button>
                        </div>
                    </div>
                ))}

                {hasOptions && (
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-40">Tên phiên bản</TableHead>
                                    <TableHead className="min-w-44">SKU</TableHead>
                                    <TableHead className="min-w-36">Giá riêng (VND)</TableHead>
                                    <TableHead className="min-w-36">Giá gạch ngang</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.map((variant) => (
                                    <TableRow key={variant.key}>
                                        <TableCell>
                                            <Input value={variant.name} onChange={(event) => updateVariant(variant.key, { name: event.target.value })} />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={variant.sku}
                                                onChange={(event) => updateVariant(variant.key, { sku: event.target.value.toUpperCase() })}
                                                placeholder="Tự sinh"
                                                className="font-mono text-xs"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={variant.price}
                                                onChange={(event) => updateVariant(variant.key, { price: event.target.value })}
                                                // Bỏ trống thì bán đúng giá chung; hiện luôn số tiền cho dễ hình dung
                                                placeholder={baseNumber > 0 ? formatVnd(baseNumber) : 'Theo giá chung'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={variant.compareAtPrice}
                                                onChange={(event) => updateVariant(variant.key, { compareAtPrice: event.target.value })}
                                                placeholder={baseCompareAtPrice ? formatVnd(Number(baseCompareAtPrice) || 0) : '—'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Tạo mọi tổ hợp có thể từ danh sách tùy chọn */
function buildCombinations(options: OptionDraft[]): Record<string, string>[] {
    if (options.length === 0) return [{}];

    let result: Record<string, string>[] = [{}];
    for (const option of options) {
        const next: Record<string, string>[] = [];
        for (const current of result) {
            for (const value of option.values) {
                if (!value.code) continue;
                next.push({ ...current, [option.code]: value.code });
            }
        }
        result = next;
    }
    return result;
}
