'use client';

import { useState } from 'react';
import { Archive, CheckCircle2, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProductBulkDeleteResult } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ktm/ui/components/dialog';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { errorText } from '@/lib/error-text';
import { useApiMutation } from '@/lib/hooks';

/**
 * Hiện khi đang chọn sản phẩm trong danh sách.
 * Xóa hẳn những sản phẩm xóa được; phần còn lại báo lý do và cho lưu trữ một lượt.
 */
export function ProductBulkActions({
    selectedIds,
    onClear,
}: {
    selectedIds: string[];
    onClear: () => void;
}) {
    const queryClient = useQueryClient();
    const { authFetch } = useAuth();
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState<ProductBulkDeleteResult | null>(null);
    const [archiving, setArchiving] = useState(false);

    const remove = useApiMutation<ProductBulkDeleteResult, string[]>(
        (ids) => ({ path: '/catalog/products/bulk-delete', body: { ids } }),
        {
            invalidate: [['products']],
            onSuccess: (data) => {
                setConfirming(false);
                onClear();
                if (data.skipped.length === 0) {
                    toast.success(`Đã xóa ${data.deleted.length} sản phẩm`);
                } else {
                    setResult(data);
                }
            },
            onError: (error) => {
                setConfirming(false);
                toast.error(errorText(error));
            },
        },
    );

    // Sản phẩm không xóa được nhưng lưu trữ được (bỏ qua cái không tìm thấy)
    const archivable = result?.skipped.filter((item) => item.code !== 'NOT_FOUND') ?? [];

    async function archiveSkipped() {
        setArchiving(true);
        let done = 0;
        const failed: string[] = [];
        for (const item of archivable) {
            try {
                await authFetch(`/catalog/products/${item.id}/status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'ARCHIVED' }),
                });
                done += 1;
            } catch (error) {
                failed.push(`${item.name}: ${errorText(error)}`);
            }
        }
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        setArchiving(false);
        setResult(null);
        if (failed.length === 0) {
            toast.success(`Đã lưu trữ ${done} sản phẩm`);
        } else {
            toast.error(`Đã lưu trữ ${done}, còn ${failed.length} sản phẩm lỗi`, { description: failed.join('\n') });
        }
    }

    return (
        <>
            {selectedIds.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                    <span className="font-medium">Đã chọn {selectedIds.length} sản phẩm</span>
                    <Button variant="ghost" size="sm" onClick={onClear}>
                        <X className="size-3.5" />
                        Bỏ chọn
                    </Button>
                    <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirming(true)}>
                        <Trash2 className="size-3.5" />
                        Xóa đã chọn
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={`Xóa ${selectedIds.length} sản phẩm?`}
                description={
                    <>
                        Chỉ xóa hẳn những sản phẩm <strong>chưa từng có giao dịch</strong> và không đang bán. Sản phẩm không xóa
                        được sẽ được liệt kê kèm lý do để bạn lưu trữ. <strong>Xóa rồi không hoàn tác được.</strong>
                    </>
                }
                confirmLabel="Xóa"
                destructive
                loading={remove.isPending}
                onConfirm={() => remove.mutate(selectedIds)}
            />

            <Dialog open={result !== null} onOpenChange={(open) => !open && !archiving && setResult(null)}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Kết quả xóa</DialogTitle>
                        <DialogDescription>
                            {result && result.deleted.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="size-4 text-green-600" />
                                    Đã xóa {result.deleted.length} sản phẩm.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {result && result.skipped.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{result.skipped.length} sản phẩm không xóa được:</p>
                            <ul className="space-y-2 text-sm">
                                {result.skipped.map((item) => (
                                    <li key={item.id} className="rounded-lg border p-2">
                                        <p className="font-medium">{item.name || '(không rõ tên)'}</p>
                                        <p className="text-xs text-muted-foreground">{item.message}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResult(null)} disabled={archiving}>
                            Đóng
                        </Button>
                        {archivable.length > 0 && (
                            <Button onClick={() => void archiveSkipped()} disabled={archiving}>
                                <Archive className="size-4" />
                                {archiving ? 'Đang lưu trữ...' : `Lưu trữ ${archivable.length} sản phẩm này`}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}