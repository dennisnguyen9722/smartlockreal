'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckCircle2, CircleAlert, EyeOff, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProductStatusValue } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { formatDateVn, PRODUCT_STATUS_LABEL } from '@/lib/format';
import { useApiMutation } from '@/lib/hooks';
import type { ProductDetail } from '@/lib/product-types';

const STATUS_BADGE: Record<ProductStatusValue, 'default' | 'secondary' | 'outline'> = {
    ACTIVE: 'default',
    DRAFT: 'secondary',
    ARCHIVED: 'outline',
};

export function ProductStatusCard({
    product,
    canManage,
    hasUnsavedChanges,
}: {
    product: ProductDetail;
    canManage: boolean;
    /** Tab Thông tin còn thay đổi chưa lưu: khóa nút để tránh xung đột với chính mình */
    hasUnsavedChanges: boolean;
}) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [confirmArchive, setConfirmArchive] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const remove = useApiMutation<void, void>(
        () => ({ path: `/catalog/products/${product.id}`, method: 'DELETE' }),
        {
            onSuccess: () => {
                setConfirmDelete(false);
                // Bỏ dữ liệu của sản phẩm đã xóa khỏi bộ nhớ đệm, tránh trang chi tiết gọi lại API
                queryClient.removeQueries({ queryKey: ['product', product.id] });
                void queryClient.invalidateQueries({ queryKey: ['products'] });
                toast.success(`Đã xóa sản phẩm ${product.name}`);
                router.push('/san-pham');
            },
            onError: (error) => {
                setConfirmDelete(false);
                void queryClient.invalidateQueries({ queryKey: ['product', product.id] });
                toast.error(errorText(error));
            },
        },
    );

    const change = useApiMutation<ProductDetail, ProductStatusValue>(
        (status) => ({
            path: `/catalog/products/${product.id}/status`,
            body: { status, expectedUpdatedAt: product.updatedAt },
        }),
        {
            invalidate: [['products']],
            onSuccess: (data) => {
                queryClient.setQueryData(['product', product.id], data);
                toast.success(`Đã chuyển sang "${PRODUCT_STATUS_LABEL[data.status]}"`);
                setConfirmArchive(false);
            },
            onError: (error) => {
                setConfirmArchive(false);
                // Dữ liệu trên màn hình có thể đã cũ: tải lại để checklist đúng thực tế
                void queryClient.invalidateQueries({ queryKey: ['product', product.id] });

                if (error instanceof ApiError && error.code === 'IN_USE') {
                    const details = error.details as { bundles?: { name: string }[]; hint?: string } | undefined;
                    const names = details?.bundles?.map((bundle) => bundle.name).join(', ');
                    toast.error(names ? `Đang nằm trong combo: ${names}` : error.message, {
                        description: details?.hint,
                    });
                    return;
                }
                if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
                    toast.error('Chưa đủ điều kiện đăng bán, xem danh sách bên phải');
                    return;
                }
                toast.error(error.message);
            },
        },
    );

    const ready = product.readiness.length === 0;
    const busy = change.isPending;
    const locked = !canManage || hasUnsavedChanges || busy;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                    Trạng thái
                    <Badge variant={STATUS_BADGE[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {product.status !== 'ARCHIVED' && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">
                            {ready ? 'Đủ điều kiện đăng bán' : 'Còn thiếu để đăng bán'}
                        </p>
                        {ready ? (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="size-4 text-green-600" />
                                Biến thể, giá, ảnh và thông số đã đầy đủ.
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {product.readiness.map((issue, index) => (
                                    <li key={`${issue.field}-${index}`} className="flex items-start gap-2 text-sm">
                                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                                        <span>{issue.message}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {product.status === 'ARCHIVED' && (
                    <p className="text-sm text-muted-foreground">
                        Sản phẩm đã lưu trữ, không hiện trên website. Mọi biến thể đã bị tắt. Khôi phục về Nháp rồi
                        bật lại biến thể cần bán.
                    </p>
                )}

                {canManage && (
                    <div className="flex flex-col gap-2">
                        {product.status === 'DRAFT' && (
                            <Button onClick={() => change.mutate('ACTIVE')} disabled={locked || !ready}>
                                <Send className="size-4" />
                                Đăng bán
                            </Button>
                        )}
                        {product.status === 'ACTIVE' && (
                            <Button variant="outline" onClick={() => change.mutate('DRAFT')} disabled={locked}>
                                <EyeOff className="size-4" />
                                Tạm ẩn (về Nháp)
                            </Button>
                        )}
                        {product.status === 'ARCHIVED' && (
                            <Button variant="outline" onClick={() => change.mutate('DRAFT')} disabled={locked}>
                                <RotateCcw className="size-4" />
                                Khôi phục về Nháp
                            </Button>
                        )}
                        {product.status !== 'ARCHIVED' && (
                            <Button variant="ghost" onClick={() => setConfirmArchive(true)} disabled={locked}>
                                <Archive className="size-4" />
                                Lưu trữ
                            </Button>
                        )}

                        {product.deletionBlock === null ? (
                            <Button
                                variant="ghost"
                                onClick={() => setConfirmDelete(true)}
                                disabled={locked || remove.isPending}
                                className="text-destructive"
                            >
                                <Trash2 className="size-4" />
                                Xóa sản phẩm
                            </Button>
                        ) : (
                            product.deletionBlock.code !== 'ACTIVE' && (
                                <p className="text-xs text-muted-foreground">
                                    {product.deletionBlock.message}.
                                </p>
                            )
                        )}

                        {hasUnsavedChanges && (
                            <p className="text-xs text-muted-foreground">
                                Hãy lưu hoặc hủy thay đổi ở tab Thông tin trước khi đổi trạng thái.
                            </p>
                        )}
                    </div>
                )}

                <dl className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2">
                        <dt>Đăng bán lần đầu</dt>
                        <dd>{formatDateVn(product.publishedAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt>Tạo lúc</dt>
                        <dd>{formatDateVn(product.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt>Sửa lần cuối</dt>
                        <dd>{formatDateVn(product.updatedAt)}</dd>
                    </div>
                </dl>
            </CardContent>

            <ConfirmDialog
                open={confirmArchive}
                onOpenChange={setConfirmArchive}
                title="Lưu trữ sản phẩm?"
                description="Sản phẩm sẽ ẩn khỏi website và mọi biến thể bị tắt. Lịch sử đơn hàng vẫn giữ nguyên. Có thể khôi phục về Nháp sau."
                confirmLabel="Lưu trữ"
                destructive
                loading={busy}
                onConfirm={() => change.mutate('ARCHIVED')}
            />

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Xóa hẳn sản phẩm?"
                description={
                    <>
                        Xóa vĩnh viễn <strong>{product.name}</strong> cùng {product.variants.length} biến thể, thuộc tính và ảnh
                        gắn kèm. File ảnh vẫn còn trong Thư viện ảnh. <strong>Không hoàn tác được.</strong>
                    </>
                }
                confirmLabel="Xóa hẳn"
                destructive
                loading={remove.isPending}
                onConfirm={() => remove.mutate()}
            />
        </Card>
    );
}