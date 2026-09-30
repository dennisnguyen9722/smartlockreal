'use client';

import { Plus, Trash2 } from 'lucide-react';
import { formatVnd } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';

/** Một phiên bản của sản phẩm, vd "Đen" hoặc "Bản dùng app TTLock" */
export interface VersionDraft {
    /** Khóa nội bộ của dòng trên màn hình, không gửi lên máy chủ */
    id: string;
    /** Giá trị phân loại, vd "Đen" */
    value: string;
    /** Để trống = bán theo giá chung của sản phẩm */
    price: string;
    compareAtPrice: string;
    sku: string;
}

export function newVersion(): VersionDraft {
    return { id: `v${Date.now()}${Math.random().toString(36).slice(2, 6)}`, value: '', price: '', compareAtPrice: '', sku: '' };
}

/**
 * GIÁ BÁN VÀ PHIÊN BẢN
 *
 * Trong database giá lưu ở từng phiên bản (đơn hàng, báo giá đều gắn theo phiên bản),
 * nên chỉ có MỘT nơi giữ giá. Trên màn hình thì người nhập chỉ cần nghĩ đơn giản:
 * - Nhập giá của sản phẩm.
 * - Sản phẩm có nhiều loại thì bấm "Thêm phiên bản", điền tên loại; loại nào giá khác thì nhập giá riêng.
 *
 * Tất cả phiên bản thuộc CÙNG MỘT cách phân loại (vd đều theo Màu sắc), vì website nhóm theo cách đó
 * để khách chọn. Muốn phân loại chéo (màu × app) thì tách thành sản phẩm riêng cho dễ bán.
 */
export function VariantBuilder({
    basePrice,
    baseCompareAtPrice,
    baseSku,
    onBaseChange,
    groupName,
    onGroupNameChange,
    versions,
    onVersionsChange,
    errors,
}: {
    basePrice: string;
    baseCompareAtPrice: string;
    baseSku: string;
    onBaseChange: (patch: { price?: string; compareAtPrice?: string; sku?: string }) => void;
    /** Phân loại theo gì: Màu sắc, Phiên bản app... */
    groupName: string;
    onGroupNameChange: (value: string) => void;
    versions: VersionDraft[];
    onVersionsChange: (versions: VersionDraft[]) => void;
    errors?: Record<string, string>;
}) {
    const baseNumber = Number(basePrice) || 0;

    function update(id: string, patch: Partial<VersionDraft>) {
        onVersionsChange(versions.map((version) => (version.id === id ? { ...version, ...patch } : version)));
    }

    return (
        <div className="space-y-6">
            {/* Giá của sản phẩm: luôn hiện */}
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

            {/* Phiên bản: bỏ qua được */}
            <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <Label>Phiên bản</Label>
                        <p className="text-xs text-muted-foreground">
                            Sản phẩm có nhiều loại để khách chọn (màu, bản dùng app...). Không có thì bỏ qua phần này.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => onVersionsChange([...versions, newVersion()])}>
                        <Plus className="size-4" />
                        Thêm phiên bản
                    </Button>
                </div>

                {versions.length > 0 && (
                    <>
                        <div className="max-w-72 space-y-1.5">
                            <Label>Phân loại theo</Label>
                            <Input value={groupName} onChange={(event) => onGroupNameChange(event.target.value)} placeholder="Màu sắc" />
                            <p className="text-xs text-muted-foreground">Chữ này hiện trên website: &quot;{groupName || 'Màu sắc'}: ...&quot;</p>
                        </div>

                        <div className="space-y-2">
                            {versions.map((version, index) => (
                                <div key={version.id} className="space-y-3 rounded-lg border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium">Phiên bản {index + 1}</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => onVersionsChange(versions.filter((item) => item.id !== version.id))}
                                            aria-label="Xóa phiên bản"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">{groupName || 'Tên phiên bản'} *</Label>
                                            <Input
                                                value={version.value}
                                                onChange={(event) => update(version.id, { value: event.target.value })}
                                                placeholder="Đen"
                                                aria-invalid={Boolean(errors?.[`versions.${index}.value`]) || undefined}
                                            />
                                            {errors?.[`versions.${index}.value`] && (
                                                <p className="text-xs text-destructive">{errors[`versions.${index}.value`]}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Giá riêng (VND)</Label>
                                            <Input
                                                type="number"
                                                value={version.price}
                                                onChange={(event) => update(version.id, { price: event.target.value })}
                                                // Bỏ trống thì bán đúng giá chung ở trên
                                                placeholder={baseNumber > 0 ? formatVnd(baseNumber) : 'Theo giá chung'}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Giá gạch ngang</Label>
                                            <Input
                                                type="number"
                                                value={version.compareAtPrice}
                                                onChange={(event) => update(version.id, { compareAtPrice: event.target.value })}
                                                placeholder={baseCompareAtPrice ? formatVnd(Number(baseCompareAtPrice) || 0) : '—'}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">SKU</Label>
                                            <Input
                                                value={version.sku}
                                                onChange={(event) => update(version.id, { sku: event.target.value.toUpperCase() })}
                                                placeholder="Tự sinh"
                                                className="font-mono text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Ảnh riêng cho từng phiên bản thêm ở tab Ảnh sau khi lưu sản phẩm.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
