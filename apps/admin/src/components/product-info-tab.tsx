'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ProductUpdateSchema } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { ProductInfoForm } from '@/components/product-info-form';
import { ApiError } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import {
    apiFieldErrors,
    buildUpdatePayload,
    collectFieldErrors,
    draftFromProduct,
    type ProductInfoDraft,
} from '@/lib/product-form';
import type { ProductDetail } from '@/lib/product-types';

export function ProductInfoTab({
    product,
    canManage,
    onDirtyChange,
    onReload,
}: {
    product: ProductDetail;
    canManage: boolean;
    onDirtyChange: (dirty: boolean) => void;
    /** Tải lại sản phẩm từ máy chủ, trả về bản mới nhất */
    onReload: () => Promise<ProductDetail | undefined>;
}) {
    const queryClient = useQueryClient();

    // snapshot: bản gốc mà draft được tạo ra từ đó; base: updatedAt tương ứng, gửi kèm khi lưu
    const [snapshot, setSnapshot] = useState<ProductInfoDraft>(() => draftFromProduct(product));
    const [base, setBase] = useState(product.updatedAt);
    const [draft, setDraft] = useState<ProductInfoDraft>(snapshot);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [conflict, setConflict] = useState(false);

    const changes = useMemo(() => buildUpdatePayload(draft, snapshot), [draft, snapshot]);
    const dirty = Object.keys(changes).length > 0;

    function resetFrom(next: ProductDetail) {
        const fresh = draftFromProduct(next);
        setSnapshot(fresh);
        setDraft(fresh);
        setBase(next.updatedAt);
        setErrors({});
        setConflict(false);
    }

    // Máy chủ có bản mới (vd: vừa đổi trạng thái): chưa sửa gì thì cập nhật theo
    useEffect(() => {
        if (product.updatedAt !== base && !dirty) resetFrom(product);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product.updatedAt]);

    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    // Cảnh báo khi đóng tab hoặc tải lại trình duyệt lúc còn thay đổi chưa lưu
    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const save = useApiMutation<ProductDetail, Record<string, unknown>>(
        (body) => ({ path: `/catalog/products/${product.id}`, method: 'PATCH', body }),
        {
            invalidate: [['products']],
            onSuccess: (data) => {
                resetFrom(data);
                queryClient.setQueryData(['product', product.id], data);
                toast.success('Đã lưu thay đổi');
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    setConflict(true);
                    return;
                }
                const fieldErrors = apiFieldErrors(error);
                if (fieldErrors) {
                    setErrors(fieldErrors);
                    toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
                    return;
                }
                toast.error(error.message);
            },
        },
    );

    function submit() {
        const payload = { ...changes, expectedUpdatedAt: base };

        const parsed = ProductUpdateSchema.safeParse(payload);
        const issues: { path: PropertyKey[] | string; message: string }[] = parsed.success
            ? []
            : [...parsed.error.issues];

        // Quy tắc theo loại mà schema cập nhật không tự biết
        if (product.type === 'LOCK' && !draft.brandId) {
            issues.push({ path: 'brandId', message: 'Khóa bắt buộc có hãng' });
        }
        if (!draft.slug.trim()) {
            issues.push({ path: 'slug', message: 'Đường dẫn không được để trống' });
        }

        if (issues.length > 0) {
            setErrors(collectFieldErrors(issues));
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }

        setErrors({});
        save.mutate(payload);
    }

    async function reloadLatest() {
        const latest = await onReload();
        if (latest) {
            resetFrom(latest);
            toast.info('Đã tải bản mới nhất');
        }
    }

    return (
        <div className="space-y-4">
            {conflict && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" />
                    <span className="flex-1">
                        Có người vừa sửa sản phẩm này. Tải bản mới nhất sẽ <strong>bỏ thay đổi của bạn</strong>; nên
                        ghi lại những gì cần sửa trước.
                    </span>
                    <Button variant="outline" onClick={reloadLatest}>
                        <RefreshCw className="size-4" />
                        Tải bản mới nhất
                    </Button>
                </div>
            )}

            {/* fieldset disabled khóa mọi ô nhập khi không có quyền sửa */}
            <fieldset disabled={!canManage || save.isPending} className="min-w-0">
                <ProductInfoForm
                    mode="edit"
                    value={draft}
                    onChange={setDraft}
                    errors={errors}
                    currentBrand={product.brand}
                    currentCategory={product.category}
                />
            </fieldset>

            {canManage && dirty && (
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background py-3">
                    <span className="mr-auto text-sm text-muted-foreground">Có thay đổi chưa lưu</span>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setDraft(snapshot);
                            setErrors({});
                        }}
                        disabled={save.isPending}
                    >
                        Hủy thay đổi
                    </Button>
                    <Button onClick={submit} disabled={save.isPending || conflict}>
                        {save.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                </div>
            )}
        </div>
    );
}