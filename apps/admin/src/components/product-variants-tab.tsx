'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ImageIcon, Lock, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { buildOptionKey, imageUrl, VariantUpdateSchema } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { cn } from '@ktm/ui/lib/utils';
import { AddVariantDialog } from '@/components/add-variant-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ImagePicker } from '@/components/image-picker';
import { PriceInput } from '@/components/price-input';
import { ProductOptionsPanel } from '@/components/product-options-panel';
import { errorText } from '@/lib/error-text';
import { formatVnd } from '@/lib/format';
import { useApiMutation } from '@/lib/hooks';
import { checkImageFile, useProductImages } from '@/lib/product-images';
import type {
    ProductDetail,
    ProductMediaDetail,
    ProductOptionDetail,
    ProductVariantDetail,
} from '@/lib/product-types';

// ---------- Giá trị trong thẻ biến thể ----------

interface CardValues {
    name: string;
    sku: string;
    price: string;
    compareAtPrice: string;
    trackSerial: boolean;
    isActive: boolean;
}

function valuesFromVariant(variant: ProductVariantDetail): CardValues {
    return {
        name: variant.name,
        sku: variant.sku,
        price: String(variant.price),
        compareAtPrice: variant.compareAtPrice == null ? '' : String(variant.compareAtPrice),
        trackSerial: variant.trackSerial,
        isActive: variant.isActive,
    };
}

/** Chỉ những trường khác máy chủ. Rỗng = thẻ không có thay đổi. */
function buildPatch(values: CardValues, variant: ProductVariantDetail): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (values.name.trim() !== variant.name) patch.name = values.name.trim();
    const sku = values.sku.trim().toUpperCase();
    if (sku !== variant.sku) patch.sku = sku;
    if (values.price !== String(variant.price)) patch.price = Number(values.price);
    const compareAt = values.compareAtPrice === '' ? null : Number(values.compareAtPrice);
    if (compareAt !== variant.compareAtPrice) patch.compareAtPrice = compareAt;
    if (values.trackSerial !== variant.trackSerial) patch.trackSerial = values.trackSerial;
    if (values.isActive !== variant.isActive) patch.isActive = values.isActive;
    return patch;
}

function validate(values: CardValues, patch: Record<string, unknown>): string | null {
    if (!values.name.trim()) return 'Chưa nhập tên hiển thị';
    if (values.price === '') return 'Chưa nhập giá bán';
    const parsed = VariantUpdateSchema.safeParse(patch);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ';
    if (values.compareAtPrice !== '' && Number(values.compareAtPrice) <= Number(values.price)) {
        return 'Giá gạch ngang phải lớn hơn giá bán';
    }
    return null;
}

/** [{ name: 'Màu', value: 'Black' }, { name: 'App', value: 'TTLock' }] theo thứ tự thuộc tính */
function attributesOf(variant: ProductVariantDetail, options: ProductOptionDetail[]) {
    return options.flatMap((option) => {
        const link = variant.optionValues.find((item) => item.optionValue.optionId === option.id);
        return link ? [{ name: option.name, value: link.optionValue.value }] : [];
    });
}

export function ProductVariantsTab({
    product,
    canManage,
    onDirtyChange,
}: {
    product: ProductDetail;
    canManage: boolean;
    onDirtyChange: (dirty: boolean) => void;
}) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, CardValues>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<ProductVariantDetail | null>(null);
    const [showMissing, setShowMissing] = useState(false);

    const changedIds = new Set(
        product.variants
            .filter((variant) => {
                const draft = drafts[variant.id];
                return draft !== undefined && Object.keys(buildPatch(draft, variant)).length > 0;
            })
            .map((variant) => variant.id),
    );
    const dirty = changedIds.size > 0;

    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const mediaByVariant = useMemo(() => {
        const map = new Map<string, ProductMediaDetail[]>();
        for (const media of product.media) {
            if (!media.variantId) continue;
            map.set(media.variantId, [...(map.get(media.variantId) ?? []), media]);
        }
        return map;
    }, [product.media]);

    const missing = useMemo(() => {
        if (product.options.length < 2) return [];
        const existing = new Set(product.variants.map((variant) => variant.optionKey));
        return allCombinations(product.options).filter((combo) => !existing.has(combo.key));
    }, [product.options, product.variants]);

    function update(variant: ProductVariantDetail, patch: Partial<CardValues>) {
        setDrafts((current) => ({
            ...current,
            [variant.id]: { ...(current[variant.id] ?? valuesFromVariant(variant)), ...patch },
        }));
        setErrors(({ [variant.id]: _removed, ...rest }) => rest);
    }

    function discard(variantId: string) {
        setDrafts(({ [variantId]: _removed, ...rest }) => rest);
        setErrors(({ [variantId]: _removed, ...rest }) => rest);
    }

    const save = useApiMutation<unknown, { id: string; patch: Record<string, unknown> }>(
        ({ id, patch }) => ({ path: `/catalog/products/variants/${id}`, method: 'PATCH', body: patch }),
        {
            // Tải lại xong mới bỏ bản nháp (hook chờ invalidate trước khi gọi onSuccess), tránh nháy giá trị cũ
            invalidate: [['product', product.id], ['products']],
            onSuccess: (_data, { id }) => {
                discard(id);
                toast.success('Đã lưu biến thể');
            },
            onError: (error, { id }) => setErrors((current) => ({ ...current, [id]: errorText(error) })),
        },
    );

    function submit(variant: ProductVariantDetail) {
        const values = drafts[variant.id];
        if (!values) return;
        const patch = buildPatch(values, variant);
        const problem = validate(values, patch);
        if (problem) {
            setErrors((current) => ({ ...current, [variant.id]: problem }));
            return;
        }
        save.mutate({ id: variant.id, patch });
    }

    const remove = useApiMutation<void, string>(
        (variantId) => ({ path: `/catalog/products/variants/${variantId}`, method: 'DELETE' }),
        {
            invalidate: [['product', product.id], ['products']],
            onSuccess: (_data, variantId) => {
                discard(variantId);
                setDeleting(null);
                toast.success('Đã xóa biến thể');
            },
            onError: (error) => {
                setDeleting(null);
                toast.error(errorText(error));
            },
        },
    );

    return (
        <div className="space-y-6">
            {product.status === 'ARCHIVED' && (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Sản phẩm đang lưu trữ: không bật lại hoặc thêm biến thể được. Khôi phục về Nháp trước.
                </p>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle>Giá và phiên bản</CardTitle>
                    {canManage && product.status !== 'ARCHIVED' && (
                        <Button variant="outline" onClick={() => setAdding(true)}>
                            <Plus className="size-4" />
                            Thêm biến thể
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-2">
                    {product.variants.map((variant) => {
                        const values = drafts[variant.id] ?? valuesFromVariant(variant);
                        const isOpen = expanded === variant.id;
                        const changed = changedIds.has(variant.id);
                        const error = errors[variant.id];
                        const locked = variant.usage.locked;
                        const images = mediaByVariant.get(variant.id) ?? [];
                        const cover = images[0];
                        const attributes = attributesOf(variant, product.options);
                        const [primary, ...combined] = attributes;
                        const busy = save.isPending && save.variables?.id === variant.id;

                        return (
                            <div key={variant.id} className={cn('overflow-hidden rounded-lg border', changed && 'border-primary')}>
                                {/* Dòng tiêu đề: bấm để mở/đóng */}
                                <div className="flex items-center gap-3 bg-muted/40 px-3 py-2">
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(isOpen ? null : variant.id)}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                        aria-expanded={isOpen}
                                    >
                                        <ChevronDown
                                            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                                        />
                                        {cover ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                                            <img
                                                src={imageUrl(cover.url, 'sm')}
                                                alt=""
                                                className="size-10 shrink-0 rounded border bg-background object-contain"
                                            />
                                        ) : (
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded border border-dashed bg-background">
                                                <ImageIcon className="size-4 text-muted-foreground" />
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {primary ? `${primary.name}: ${primary.value}` : variant.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {[...combined.map((item) => `${item.name}: ${item.value}`), variant.sku].join(' · ')}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-sm tabular-nums">
                                            {variant.price > 0 ? formatVnd(variant.price) : <span className="text-destructive">Chưa có giá</span>}
                                        </span>
                                    </button>

                                    {!variant.isActive && <Badge variant="outline">Đã tắt</Badge>}
                                    {changed && <Badge variant="secondary">Chưa lưu</Badge>}

                                    {canManage && variant.usage.deletable && (
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => setDeleting(variant)}
                                            aria-label={`Xóa biến thể ${variant.name}`}
                                        >
                                            <Trash2 className="size-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>

                                {isOpen && (
                                    <div className="space-y-4 p-4">
                                        <fieldset disabled={!canManage || busy} className="min-w-0 space-y-4">
                                            {primary && (
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-1.5">
                                                        <Label>Tên biến thể</Label>
                                                        <Input value={primary.name} disabled />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label>Giá trị</Label>
                                                        <Input value={primary.value} disabled />
                                                    </div>
                                                    {combined.map((item) => (
                                                        <p key={item.name} className="text-sm sm:col-span-2">
                                                            <span className="text-muted-foreground">{item.name}:</span> {item.value}
                                                        </p>
                                                    ))}
                                                    <p className="text-xs text-muted-foreground sm:col-span-2">
                                                        Gõ sai giá trị thì sửa ở khung Thuộc tính bên dưới.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label>Giá bán (chưa VAT)</Label>
                                                    <PriceInput value={values.price} onChange={(price) => update(variant, { price })} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label>Giá gạch ngang</Label>
                                                    <PriceInput
                                                        value={values.compareAtPrice}
                                                        onChange={(compareAtPrice) => update(variant, { compareAtPrice })}
                                                        placeholder="Không bắt buộc"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label>
                                                        SKU
                                                        {locked && (
                                                            <span
                                                                className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"
                                                                title={`Đã có ${variant.usage.documents} chứng từ/dòng tồn kho`}
                                                            >
                                                                <Lock className="size-3" />
                                                                đã khóa
                                                            </span>
                                                        )}
                                                    </Label>
                                                    <Input
                                                        value={values.sku}
                                                        onChange={(event) => update(variant, { sku: event.target.value.toUpperCase() })}
                                                        disabled={locked}
                                                        className="font-mono text-xs"
                                                        maxLength={64}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label>Tên hiển thị</Label>
                                                    <Input
                                                        value={values.name}
                                                        onChange={(event) => update(variant, { name: event.target.value })}
                                                        maxLength={200}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-6 text-sm">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={values.isActive}
                                                        onChange={(event) => update(variant, { isActive: event.target.checked })}
                                                        className="size-4"
                                                    />
                                                    Đang bán
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={values.trackSerial}
                                                        onChange={(event) => update(variant, { trackSerial: event.target.checked })}
                                                        disabled={locked}
                                                        className="size-4"
                                                    />
                                                    Quản lý serial từng chiếc
                                                </label>
                                            </div>

                                            {error && <p className="text-sm text-destructive">{error}</p>}

                                            {changed && (
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={() => discard(variant.id)}>
                                                        Hủy thay đổi
                                                    </Button>
                                                    <Button onClick={() => submit(variant)}>{busy ? 'Đang lưu...' : 'Lưu biến thể'}</Button>
                                                </div>
                                            )}
                                        </fieldset>

                                        {/* Ảnh lưu ngay khi chọn, không cần bấm Lưu */}
                                        <div className="space-y-1.5 border-t pt-4">
                                            <Label>Ảnh biến thể</Label>
                                            <VariantImages
                                                productId={product.id}
                                                variantId={variant.id}
                                                images={images}
                                                canManage={canManage}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <p className="pt-1 text-xs text-muted-foreground">
                        Giá chưa gồm VAT. Phiên bản đã có đơn hàng, báo giá, tồn kho hoặc nằm trong khuyến mãi/combo thì
                        không xóa được, chỉ tắt. Tồn kho theo showroom quản lý ở mục Kho.
                    </p>
                </CardContent>
            </Card>

            {product.options.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Thuộc tính</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Bấm vào giá trị để sửa nhãn (khi gõ sai) hoặc xóa giá trị không còn dùng.
                        </p>
                        <ProductOptionsPanel product={product} canManage={canManage} />

                        {canManage && missing.length > 0 && product.status !== 'ARCHIVED' && (
                            <div className="border-t pt-3">
                                <Button variant="ghost" onClick={() => setShowMissing((open) => !open)} className="h-7 px-2 text-xs">
                                    <ChevronDown className={cn('size-3 transition-transform', showMissing && 'rotate-180')} />
                                    Tạo nhanh các tổ hợp chưa có ({missing.length})
                                </Button>
                                {showMissing && <MissingVariants productId={product.id} missing={missing} />}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {adding && (
                <AddVariantDialog
                    product={product}
                    onClose={() => setAdding(false)}
                    onCreated={(variantId) => {
                        setAdding(false);
                        setExpanded(variantId);
                    }}
                />
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Xóa biến thể?"
                description={
                    <>
                        Xóa hẳn <strong>{deleting?.name}</strong> ({deleting?.sku}). Phiên bản này chưa có giao dịch nào
                        nên xóa an toàn.
                    </>
                }
                confirmLabel="Xóa"
                destructive
                loading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id)}
            />
        </div>
    );
}

// ---------- Ảnh của một biến thể: thêm/gỡ lưu ngay ----------

function VariantImages({
    productId,
    variantId,
    images,
    canManage,
}: {
    productId: string;
    variantId: string;
    images: ProductMediaDetail[];
    canManage: boolean;
}) {
    const queryClient = useQueryClient();
    const { upload, attach, detach } = useProductImages(productId);
    const [busy, setBusy] = useState(false);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ['product', productId] }),
            queryClient.invalidateQueries({ queryKey: ['products'] }),
        ]);

    async function addFiles(files: File[]) {
        const problems = files.map(checkImageFile).filter((problem): problem is string => problem !== null);
        if (problems.length > 0) {
            toast.error(problems.join('; '));
            return;
        }
        setBusy(true);
        try {
            for (const file of files) {
                const asset = await upload(file);
                await attach(asset.id, variantId);
            }
            await refresh();
            toast.success(files.length > 1 ? `Đã thêm ${files.length} ảnh` : 'Đã thêm ảnh');
        } catch (error) {
            await refresh();
            toast.error(errorText(error));
        } finally {
            setBusy(false);
        }
    }

    async function removeImage(mediaId: string) {
        setBusy(true);
        try {
            await detach(mediaId);
            await refresh();
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setBusy(false);
        }
    }

    if (!canManage && images.length === 0) {
        return <p className="text-sm text-muted-foreground">Chưa có ảnh riêng.</p>;
    }

    return (
        <ImagePicker
            images={images.map((media) => ({ key: media.id, url: media.url }))}
            onFiles={(files) => void addFiles(files)}
            onRemove={canManage ? (key) => void removeImage(key) : undefined}
            uploading={busy}
            disabled={!canManage}
        />
    );
}

// ---------- Tạo nhanh tổ hợp còn thiếu (chỉ khi có từ 2 thuộc tính) ----------

interface Combination {
    key: string;
    chosen: Record<string, string>;
    label: string;
}

interface NewRow {
    include: boolean;
    price: string;
}

function allCombinations(options: ProductOptionDetail[]): Combination[] {
    let combos: { chosen: Record<string, string>; labels: string[] }[] = [{ chosen: {}, labels: [] }];
    for (const option of options) {
        combos = combos.flatMap((combo) =>
            option.values.map((value) => ({
                chosen: { ...combo.chosen, [option.code]: value.code },
                labels: [...combo.labels, value.value],
            })),
        );
    }
    return combos.map((combo) => ({
        key: buildOptionKey(combo.chosen),
        chosen: combo.chosen,
        label: combo.labels.join(' / '),
    }));
}

function MissingVariants({ productId, missing }: { productId: string; missing: Combination[] }) {
    // Mặc định KHÔNG chọn: không phải tổ hợp nào cũng được bán
    const [rows, setRows] = useState<Record<string, NewRow>>({});
    const [error, setError] = useState('');

    const rowFor = (combo: Combination): NewRow => rows[combo.key] ?? { include: false, price: '' };
    const chosen = missing.filter((combo) => rowFor(combo).include);

    const create = useApiMutation<unknown, Combination[]>(
        (combos) => ({
            path: `/catalog/products/${productId}/variants/batch`,
            body: {
                variants: combos.map((combo) => ({
                    name: combo.label,
                    price: Number(rowFor(combo).price),
                    optionValues: combo.chosen,
                })),
            },
        }),
        {
            invalidate: [['product', productId], ['products']],
            onSuccess: (_data, combos) => {
                setRows({});
                setError('');
                toast.success(`Đã tạo ${combos.length} biến thể`);
            },
            onError: (err) => setError(errorText(err)),
        },
    );

    function submit() {
        if (chosen.length === 0) {
            setError('Chưa chọn tổ hợp nào');
            return;
        }
        if (chosen.some((combo) => rowFor(combo).price === '')) {
            setError('Nhập giá cho mọi tổ hợp đã chọn');
            return;
        }
        setError('');
        create.mutate(chosen);
    }

    return (
        <fieldset disabled={create.isPending} className="mt-2 min-w-0 space-y-2">
            <p className="text-xs text-muted-foreground">
                Các tổ hợp thuộc tính chưa có biến thể. Chỉ chọn những tổ hợp thực sự bán.
            </p>
            {missing.map((combo) => {
                const row = rowFor(combo);
                return (
                    <div key={combo.key} className="flex items-center gap-3">
                        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={row.include}
                                onChange={(event) =>
                                    setRows((current) => ({ ...current, [combo.key]: { ...row, include: event.target.checked } }))
                                }
                                className="size-4"
                            />
                            <span className="truncate">{combo.label}</span>
                        </label>
                        <div className="w-40">
                            <PriceInput
                                value={row.price}
                                onChange={(price) => setRows((current) => ({ ...current, [combo.key]: { include: true, price } }))}
                                placeholder="Giá bán"
                            />
                        </div>
                    </div>
                );
            })}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
                <Button onClick={submit} disabled={create.isPending}>
                    {create.isPending ? 'Đang tạo...' : `Tạo ${chosen.length} biến thể`}
                </Button>
            </div>
        </fieldset>
    );
}
