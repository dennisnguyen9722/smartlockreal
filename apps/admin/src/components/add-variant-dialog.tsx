'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VariantQuickCreateSchema } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ktm/ui/components/dialog';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { ImagePicker, type PickedImage } from '@/components/image-picker';
import { PriceInput } from '@/components/price-input';
import { errorText } from '@/lib/error-text';
import { checkImageFile, useProductImages } from '@/lib/product-images';
import type { ProductDetail } from '@/lib/product-types';

const MAX_ATTRIBUTES = 3;

interface ExtraRow {
    key: number;
    name: string;
    value: string;
}

function sameLabel(a: string, b: string): boolean {
    return a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi');
}

/**
 * Thêm biến thể theo cách quen thuộc:
 *   Tên biến thể: Màu sắc   Giá trị: Đen
 *   Thuộc tính kết hợp:     App: TTLock
 * API tự tạo thuộc tính/giá trị còn thiếu trong một transaction.
 * Component được gắn/gỡ theo lúc mở/đóng, nên mỗi lần mở là một form trống.
 */
export function AddVariantDialog({
    product,
    onClose,
    onCreated,
}: {
    product: ProductDetail;
    onClose: () => void;
    onCreated: (variantId: string) => void;
}) {
    const queryClient = useQueryClient();
    const { authFetch } = useAuth();
    const { upload, attach } = useProductImages(product.id);

    // Thuộc tính chính = thuộc tính đầu tiên của sản phẩm (nếu đã có)
    const primaryOption = product.options[0];
    const lockedExtras = product.options.slice(1);

    const [primaryName, setPrimaryName] = useState(primaryOption?.name ?? '');
    const [primaryValue, setPrimaryValue] = useState('');
    const [lockedValues, setLockedValues] = useState<Record<string, string>>({});
    const [extras, setExtras] = useState<ExtraRow[]>([]);
    const [nextKey, setNextKey] = useState(1);
    // Với thuộc tính MỚI: các biến thể đang có thuộc giá trị nào (khóa = 'primary' hoặc key của dòng)
    const [existingAnswers, setExistingAnswers] = useState<Record<string, string>>({});

    const [price, setPrice] = useState('');
    const [compareAtPrice, setCompareAtPrice] = useState('');
    const [sku, setSku] = useState('');

    const [images, setImages] = useState<PickedImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const hasVariants = product.variants.length > 0;
    const firstVariant = product.variants[0];
    const attributeCount = 1 + lockedExtras.length + extras.length;

    // Thuộc tính mới cần hỏi giá trị cho biến thể đang có
    const newAttributes: { key: string; name: string }[] = [
        ...(primaryOption ? [] : [{ key: 'primary', name: primaryName }]),
        ...extras.map((row) => ({ key: String(row.key), name: row.name })),
    ];

    function clearError() {
        setError('');
    }

    async function handleFiles(files: File[]) {
        const problems = files.map(checkImageFile).filter((problem): problem is string => problem !== null);
        if (problems.length > 0) {
            setError(problems.join('; '));
            return;
        }
        setUploading(true);
        try {
            for (const file of files) {
                const asset = await upload(file);
                // Ảnh trùng nội dung thì API trả lại đúng ảnh cũ: không thêm hai lần
                setImages((current) =>
                    current.some((image) => image.key === asset.id) ? current : [...current, { key: asset.id, url: asset.url }],
                );
            }
        } catch (err) {
            setError(errorText(err));
        } finally {
            setUploading(false);
        }
    }

    function buildBody() {
        const attributes = [
            { name: primaryName.trim(), value: primaryValue.trim() },
            ...lockedExtras.map((option) => ({ name: option.name, value: (lockedValues[option.id] ?? '').trim() })),
            ...extras.map((row) => ({ name: row.name.trim(), value: row.value.trim() })),
        ];
        const existingValues = Object.fromEntries(
            newAttributes
                .map((attribute) => [attribute.name.trim(), (existingAnswers[attribute.key] ?? '').trim()] as const)
                .filter(([name, value]) => name && value),
        );
        return {
            attributes,
            existingValues,
            price: Number(price),
            ...(compareAtPrice ? { compareAtPrice: Number(compareAtPrice) } : {}),
            ...(sku.trim() ? { sku: sku.trim().toUpperCase() } : {}),
        };
    }

    function check(body: ReturnType<typeof buildBody>): string | null {
        if (!primaryName.trim()) return 'Chưa nhập tên biến thể (vd: Màu sắc)';
        if (!primaryValue.trim()) return 'Chưa nhập giá trị (vd: Đen)';
        const emptyValue = body.attributes.find((attribute) => !attribute.value);
        if (emptyValue) return `Chưa nhập giá trị cho ${emptyValue.name || 'thuộc tính kết hợp'}`;
        const emptyName = body.attributes.find((attribute) => !attribute.name);
        if (emptyName) return 'Chưa nhập tên thuộc tính kết hợp';
        if (price === '') return 'Chưa nhập giá bán';

        if (hasVariants) {
            const unanswered = newAttributes.find((attribute) => !(existingAnswers[attribute.key] ?? '').trim());
            if (unanswered) return `Cho biết biến thể đang có thuộc ${unanswered.name || 'thuộc tính mới'} nào`;
        }

        // Trùng hoàn toàn với biến thể đang có (chỉ kiểm tra được khi không thêm thuộc tính mới)
        if (newAttributes.length === 0) {
            const duplicate = product.variants.find((variant) =>
                product.options.every((option) => {
                    const link = variant.optionValues.find((item) => item.optionValue.optionId === option.id);
                    const typed = body.attributes.find((attribute) => sameLabel(attribute.name, option.name))?.value ?? '';
                    return link !== undefined && sameLabel(link.optionValue.value, typed);
                }),
            );
            if (duplicate) return `Đã có biến thể "${duplicate.name}" với giá trị này`;
        }

        const parsed = VariantQuickCreateSchema.safeParse(body);
        if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ';
        return null;
    }

    async function submit() {
        const body = buildBody();
        const problem = check(body);
        if (problem) {
            setError(problem);
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const variant = await authFetch<{ id: string; name: string }>(
                `/catalog/products/${product.id}/variants/quick`,
                { method: 'POST', body: JSON.stringify(body) },
            );

            // Gắn ảnh sau khi có biến thể; lỗi gắn ảnh không làm mất biến thể vừa tạo
            let failed = 0;
            for (const image of images) {
                try {
                    await attach(image.key, variant.id);
                } catch {
                    failed += 1;
                }
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['product', product.id] }),
                queryClient.invalidateQueries({ queryKey: ['products'] }),
            ]);
            toast.success(`Đã thêm biến thể ${variant.name}`);
            if (failed > 0) toast.warning(`${failed} ảnh chưa gắn được, hãy thêm lại trong thẻ biến thể`);
            onCreated(variant.id);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setSubmitting(false);
        }
    }

    const busy = submitting || uploading;

    return (
        <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Thêm biến thể mới</DialogTitle>
                </DialogHeader>

                <fieldset disabled={submitting} className="min-w-0 space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Tên biến thể</Label>
                            <Input
                                value={primaryName}
                                onChange={(event) => {
                                    setPrimaryName(event.target.value);
                                    clearError();
                                }}
                                placeholder="VD: Màu sắc"
                                disabled={primaryOption !== undefined}
                                list="variant-name-suggestions"
                                maxLength={60}
                                autoFocus={!primaryOption}
                            />
                            <datalist id="variant-name-suggestions">
                                <option value="Màu sắc" />
                                <option value="Phiên bản" />
                            </datalist>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Giá trị</Label>
                            <Input
                                value={primaryValue}
                                onChange={(event) => {
                                    setPrimaryValue(event.target.value);
                                    clearError();
                                }}
                                placeholder={primaryOption ? primaryOption.values.map((value) => value.value).join(', ') : 'VD: Đen'}
                                list={primaryOption ? `values-${primaryOption.id}` : undefined}
                                maxLength={60}
                                autoFocus={primaryOption !== undefined}
                            />
                            {primaryOption && (
                                <datalist id={`values-${primaryOption.id}`}>
                                    {primaryOption.values.map((value) => (
                                        <option key={value.id} value={value.value} />
                                    ))}
                                </datalist>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Giá bán (chưa VAT)</Label>
                            <PriceInput value={price} onChange={(next) => { setPrice(next); clearError(); }} placeholder="4.990.000" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Giá gạch ngang</Label>
                            <PriceInput value={compareAtPrice} onChange={setCompareAtPrice} placeholder="Không bắt buộc" />
                        </div>

                        <div className="space-y-1.5">
                            <Label>SKU</Label>
                            <Input
                                value={sku}
                                onChange={(event) => setSku(event.target.value.toUpperCase())}
                                placeholder="Bỏ trống để tự sinh"
                                className="font-mono text-xs"
                                maxLength={64}
                            />
                        </div>
                    </div>

                    {/* Thuộc tính kết hợp */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Thuộc tính kết hợp</Label>
                            {attributeCount < MAX_ATTRIBUTES && (
                                <Button
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                        setExtras((current) => [...current, { key: nextKey, name: '', value: '' }]);
                                        setNextKey((key) => key + 1);
                                    }}
                                >
                                    <Plus className="size-3" />
                                    Thêm thuộc tính
                                </Button>
                            )}
                        </div>

                        {lockedExtras.length === 0 && extras.length === 0 && (
                            <p className="text-xs text-muted-foreground">Chưa có thuộc tính nào</p>
                        )}

                        {lockedExtras.map((option) => (
                            <div key={option.id} className="flex items-center gap-2">
                                <Input value={option.name} disabled className="h-8 flex-1 text-xs" />
                                <Input
                                    value={lockedValues[option.id] ?? ''}
                                    onChange={(event) => {
                                        setLockedValues((current) => ({ ...current, [option.id]: event.target.value }));
                                        clearError();
                                    }}
                                    placeholder={option.values.map((value) => value.value).join(', ')}
                                    list={`values-${option.id}`}
                                    className="h-8 flex-1 text-xs"
                                    maxLength={60}
                                />
                                <datalist id={`values-${option.id}`}>
                                    {option.values.map((value) => (
                                        <option key={value.id} value={value.value} />
                                    ))}
                                </datalist>
                                {/* Giữ chỗ cho thẳng hàng với dòng có nút xóa */}
                                <span className="size-7" />
                            </div>
                        ))}

                        {extras.map((row) => (
                            <div key={row.key} className="flex items-center gap-2">
                                <Input
                                    value={row.name}
                                    onChange={(event) => {
                                        setExtras((current) =>
                                            current.map((item) => (item.key === row.key ? { ...item, name: event.target.value } : item)),
                                        );
                                        clearError();
                                    }}
                                    placeholder="Thuộc tính (VD: App)"
                                    className="h-8 flex-1 text-xs"
                                    maxLength={60}
                                />
                                <Input
                                    value={row.value}
                                    onChange={(event) => {
                                        setExtras((current) =>
                                            current.map((item) => (item.key === row.key ? { ...item, value: event.target.value } : item)),
                                        );
                                        clearError();
                                    }}
                                    placeholder="Giá trị (VD: TTLock)"
                                    className="h-8 flex-1 text-xs"
                                    maxLength={60}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setExtras((current) => current.filter((item) => item.key !== row.key))}
                                    aria-label="Xóa thuộc tính"
                                >
                                    <Trash2 className="size-3.5 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Thuộc tính mới: hỏi một lần cho các biến thể đang có */}
                    {hasVariants && newAttributes.some((attribute) => attribute.name.trim()) && (
                        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <p className="text-sm font-medium">Biến thể đang có</p>
                            <p className="text-xs text-muted-foreground">
                                Sản phẩm đang có {product.variants.length} biến thể chưa có thuộc tính này. Chỉ cần khai báo một lần.
                            </p>
                            {newAttributes
                                .filter((attribute) => attribute.name.trim())
                                .map((attribute) => (
                                    <div key={attribute.key} className="flex flex-wrap items-center gap-2 text-sm">
                                        <span>
                                            {product.variants.length === 1 && firstVariant
                                                ? `"${firstVariant.name}" có ${attribute.name.trim()} là`
                                                : `Các biến thể đang có đều có ${attribute.name.trim()} là`}
                                        </span>
                                        <Input
                                            value={existingAnswers[attribute.key] ?? ''}
                                            onChange={(event) => {
                                                setExistingAnswers((current) => ({ ...current, [attribute.key]: event.target.value }));
                                                clearError();
                                            }}
                                            placeholder="VD: Đen"
                                            className="h-8 w-44 bg-background"
                                            maxLength={60}
                                        />
                                    </div>
                                ))}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Ảnh biến thể</Label>
                        <ImagePicker
                            images={images}
                            onFiles={(files) => void handleFiles(files)}
                            onRemove={(key) => setImages((current) => current.filter((image) => image.key !== key))}
                            uploading={uploading}
                            disabled={submitting}
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </fieldset>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Hủy
                    </Button>
                    <Button onClick={() => void submit()} disabled={busy}>
                        {submitting ? 'Đang thêm...' : 'Thêm'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}