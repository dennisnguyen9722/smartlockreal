'use client';

import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Paginated } from '@ktm/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { HighlightEditor } from '@/components/highlight-editor';
import { SlugField } from '@/components/slug-field';
import { SpecInputs, type SpecShape } from '@/components/spec-inputs';
import { useApiQuery } from '@/lib/hooks';
import { PRODUCT_TYPE_LABEL } from '@/lib/format';
import type { ProductInfoDraft } from '@/lib/product-form';

interface BrandOption {
    id: string;
    name: string;
}
interface CategoryNode {
    id: string;
    name: string;
    children: CategoryNode[];
}

const SELECT_CLASS =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50';
const TEXTAREA_CLASS = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

function isEmptySpec(value: unknown): boolean {
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Phần "thông tin chung + thông số + điểm nổi bật + SEO" của sản phẩm.
 * Dùng chung cho trang tạo mới và trang chi tiết, để quy tắc chỉ nằm một chỗ.
 */
export function ProductInfoForm({
    mode,
    value,
    onChange,
    errors,
    currentBrand,
    currentCategory,
}: {
    mode: 'create' | 'edit';
    value: ProductInfoDraft;
    onChange: (update: SetStateAction<ProductInfoDraft>) => void;
    errors: Record<string, string>;
    /** Hãng đang gắn (có thể đã bị tắt nên không có trong danh sách chọn) */
    currentBrand?: { id: string; name: string; isActive: boolean } | null;
    currentCategory?: { id: string; name: string; isActive: boolean } | null;
}) {
    const set = <K extends keyof ProductInfoDraft>(key: K, next: ProductInfoDraft[K]) =>
        onChange((current) => ({ ...current, [key]: next }));

    const brands = useApiQuery<Paginated<BrandOption>>(['brands', 'options'], '/catalog/brands?pageSize=100');
    const categories = useApiQuery<CategoryNode[]>(['categories', 'tree'], '/catalog/categories/tree');

    // Khuôn thông số tải lại mỗi khi đổi danh mục
    const shapes = useApiQuery<SpecShape[]>(
        ['specs', value.categoryId, 'shapes'],
        `/catalog/categories/${value.categoryId}/specs/shapes`,
        { enabled: Boolean(value.categoryId) },
    );

    // Đổi danh mục thì bỏ thông số không còn thuộc danh mục mới, và báo cho người dùng biết
    const [dropped, setDropped] = useState<string[]>([]);
    const lastShapesRef = useRef<SpecShape[]>([]);
    useEffect(() => {
        if (!shapes.data) return;
        const allowed = new Set(shapes.data.map((shape) => shape.code));
        const previousNames = new Map(lastShapesRef.current.map((shape) => [shape.code, shape.name]));
        lastShapesRef.current = shapes.data;

        const removed = Object.entries(value.specs)
            .filter(([code, item]) => !allowed.has(code) && !isEmptySpec(item))
            .map(([code]) => previousNames.get(code) ?? code);
        setDropped(removed);

        onChange((current) => {
            const next: Record<string, unknown> = {};
            for (const [code, item] of Object.entries(current.specs)) {
                if (allowed.has(code)) next[code] = item;
            }
            // Không có gì bị bỏ thì giữ nguyên object, tránh báo "có thay đổi" giả
            return Object.keys(next).length === Object.keys(current.specs).length
                ? current
                : { ...current, specs: next };
        });
        // Chỉ chạy khi khuôn thông số đổi
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapes.data]);

    const flatCategories: { id: string; name: string; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
        for (const node of nodes) {
            flatCategories.push({ id: node.id, name: node.name, depth });
            walk(node.children, depth + 1);
        }
    };
    walk(categories.data ?? [], 0);

    const brandList = brands.data?.items ?? [];
    const missingBrand =
        currentBrand && !brandList.some((brand) => brand.id === currentBrand.id) ? currentBrand : null;
    const missingCategory =
        currentCategory && categories.data && !flatCategories.some((item) => item.id === currentCategory.id)
            ? currentCategory
            : null;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Thông tin chung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Loại sản phẩm *</Label>
                            <select
                                value={value.type}
                                onChange={(event) => set('type', event.target.value)}
                                disabled={mode === 'edit'}
                                className={SELECT_CLASS}
                            >
                                {Object.entries(PRODUCT_TYPE_LABEL).map(([code, label]) => (
                                    <option key={code} value={code}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            {mode === 'edit' && (
                                <p className="text-xs text-muted-foreground">Loại sản phẩm không đổi được sau khi tạo.</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Hãng {value.type === 'LOCK' && <span className="text-destructive">*</span>}</Label>
                            <select
                                value={value.brandId}
                                onChange={(event) => set('brandId', event.target.value)}
                                className={SELECT_CLASS}
                            >
                                <option value="">— Chưa chọn —</option>
                                {missingBrand && (
                                    <option value={missingBrand.id}>
                                        {missingBrand.name}
                                        {missingBrand.isActive ? '' : ' (đang tắt)'}
                                    </option>
                                )}
                                {brandList.map((brand) => (
                                    <option key={brand.id} value={brand.id}>
                                        {brand.name}
                                    </option>
                                ))}
                            </select>
                            {errors.brandId && <p className="text-xs text-destructive">{errors.brandId}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Tên sản phẩm *</Label>
                        <Input
                            value={value.name}
                            onChange={(event) => set('name', event.target.value)}
                            placeholder="Khóa vân tay Samsung SHP-DP609"
                            autoFocus={mode === 'create'}
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <SlugField
                        name={value.name}
                        value={value.slug}
                        onChange={(slug) => set('slug', slug)}
                        isEditing={mode === 'edit'}
                        error={errors.slug}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Danh mục *</Label>
                            <select
                                value={value.categoryId}
                                onChange={(event) => set('categoryId', event.target.value)}
                                className={SELECT_CLASS}
                            >
                                <option value="">— Chưa chọn —</option>
                                {missingCategory && (
                                    <option value={missingCategory.id}>
                                        {missingCategory.name}
                                        {missingCategory.isActive ? '' : ' (đang tắt)'}
                                    </option>
                                )}
                                {flatCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {'\u00A0\u00A0'.repeat(category.depth)}
                                        {category.depth > 0 ? '└ ' : ''}
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Mã model của hãng</Label>
                            <Input
                                value={value.manufacturerCode}
                                onChange={(event) => set('manufacturerCode', event.target.value)}
                                placeholder="SHP-DP609"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Bảo hành (tháng)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={240}
                                value={value.warrantyMonths}
                                onChange={(event) => set('warrantyMonths', event.target.value)}
                            />
                            {errors.warrantyMonths && (
                                <p className="text-xs text-destructive">{errors.warrantyMonths}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Mô tả ngắn</Label>
                        <textarea
                            value={value.shortDescription}
                            onChange={(event) => set('shortDescription', event.target.value)}
                            rows={2}
                            placeholder="Hiển thị ở danh sách sản phẩm trên website"
                            className={TEXTAREA_CLASS}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Mô tả chi tiết</Label>
                        <textarea
                            value={value.description}
                            onChange={(event) => set('description', event.target.value)}
                            rows={8}
                            placeholder="Giới thiệu đầy đủ, hiển thị ở trang sản phẩm"
                            className={TEXTAREA_CLASS}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Thông số kỹ thuật</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {dropped.length > 0 && (
                        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            <span>
                                Các thông số không thuộc danh mục mới đã bị bỏ: <strong>{dropped.join(', ')}</strong>.
                                {mode === 'edit' && ' Bấm "Hủy thay đổi" nếu muốn khôi phục.'}
                            </span>
                        </p>
                    )}

                    {!value.categoryId ? (
                        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                            Chọn danh mục ở phần trên để hiện các thông số tương ứng.
                        </p>
                    ) : shapes.isPending ? (
                        <p className="text-sm text-muted-foreground">Đang tải thông số...</p>
                    ) : (
                        <SpecInputs
                            shapes={shapes.data ?? []}
                            values={value.specs}
                            onChange={(specs) => set('specs', specs)}
                            errors={errors}
                        />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Điểm nổi bật</CardTitle>
                </CardHeader>
                <CardContent>
                    <HighlightEditor
                        value={value.highlights}
                        onChange={(highlights) => set('highlights', highlights)}
                        error={errors.highlights}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tối ưu tìm kiếm (SEO)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>
                            Tiêu đề SEO
                            <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {value.seoTitle.length}/200
                            </span>
                        </Label>
                        <Input
                            value={value.seoTitle}
                            onChange={(event) => set('seoTitle', event.target.value)}
                            placeholder={value.name || 'Bỏ trống thì dùng tên sản phẩm'}
                            maxLength={200}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>
                            Mô tả SEO
                            <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {value.seoDescription.length}/320
                            </span>
                        </Label>
                        <textarea
                            value={value.seoDescription}
                            onChange={(event) => set('seoDescription', event.target.value)}
                            rows={3}
                            maxLength={320}
                            placeholder="Bỏ trống thì dùng mô tả ngắn. Nên dài 120–160 ký tự."
                            className={TEXTAREA_CLASS}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}