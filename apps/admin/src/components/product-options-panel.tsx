'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@ktm/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ktm/ui/components/dialog';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { errorText } from '@/lib/error-text';
import { useApiMutation } from '@/lib/hooks';
import type {
    ProductDetail,
    ProductOptionDetail,
    ProductOptionValueDetail,
} from '@/lib/product-types';

interface EditingValue {
    option: ProductOptionDetail;
    value: ProductOptionValueDetail;
}

/**
 * Danh sách thuộc tính và giá trị, để SỬA NHÃN (gõ sai) hoặc XÓA giá trị không còn dùng.
 * Thêm thuộc tính/giá trị làm ở hộp thoại "Thêm biến thể".
 */
export function ProductOptionsPanel({
    product,
    canManage,
}: {
    product: ProductDetail;
    canManage: boolean;
}) {
    const [editing, setEditing] = useState<EditingValue | null>(null);

    // Số biến thể đang dùng mỗi giá trị: dùng để quyết định có cho xóa không
    const usage = useMemo(() => {
        const counts = new Map<string, number>();
        for (const variant of product.variants) {
            for (const link of variant.optionValues) {
                counts.set(link.optionValue.id, (counts.get(link.optionValue.id) ?? 0) + 1);
            }
        }
        return counts;
    }, [product.variants]);

    if (product.options.length === 0) return null;

    return (
        <div className="space-y-2">
            {product.options.map((option) => (
                <div key={option.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-24 text-sm font-medium">{option.name}</span>
                    {option.values.map((value) => {
                        const used = usage.get(value.id) ?? 0;
                        return canManage ? (
                            <button
                                key={value.id}
                                type="button"
                                onClick={() => setEditing({ option, value })}
                                className="rounded-full border px-2.5 py-0.5 text-sm hover:bg-muted"
                                title="Bấm để sửa nhãn hoặc xóa"
                            >
                                {value.value}
                                {used === 0 && <span className="ml-1 text-xs text-muted-foreground">(chưa dùng)</span>}
                            </button>
                        ) : (
                            <span key={value.id} className="rounded-full border px-2.5 py-0.5 text-sm">
                                {value.value}
                            </span>
                        );
                    })}
                </div>
            ))}

            <ValueDialog
                productId={product.id}
                editing={editing}
                usedBy={editing ? (usage.get(editing.value.id) ?? 0) : 0}
                isLastValue={editing ? editing.option.values.length <= 1 : false}
                onClose={() => setEditing(null)}
            />
        </div>
    );
}

function ValueDialog({
    productId,
    editing,
    usedBy,
    isLastValue,
    onClose,
}: {
    productId: string;
    editing: EditingValue | null;
    usedBy: number;
    isLastValue: boolean;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [label, setLabel] = useState('');
    const [error, setError] = useState('');
    const [openedFor, setOpenedFor] = useState<string | null>(null);

    // Mở cho giá trị khác thì nạp lại nhãn (không dùng useEffect để tránh nháy nội dung cũ)
    if (editing && openedFor !== editing.value.id) {
        setOpenedFor(editing.value.id);
        setLabel(editing.value.value);
        setError('');
    }

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['product', productId] });

    const rename = useApiMutation<ProductOptionValueDetail, string>(
        (value) => ({
            path: `/catalog/products/options/values/${editing?.value.id}`,
            method: 'PATCH',
            body: { value },
        }),
        {
            onSuccess: () => {
                void refresh();
                toast.success('Đã đổi nhãn');
                close();
            },
            onError: (err) => setError(errorText(err)),
        },
    );

    const remove = useApiMutation<void, void>(
        () => ({ path: `/catalog/products/options/values/${editing?.value.id}`, method: 'DELETE' }),
        {
            onSuccess: () => {
                void refresh();
                toast.success('Đã xóa giá trị');
                close();
            },
            onError: (err) => setError(errorText(err)),
        },
    );

    function close() {
        setOpenedFor(null);
        onClose();
    }

    const busy = rename.isPending || remove.isPending;
    const unchanged = label.trim() === editing?.value.value;

    return (
        <Dialog open={editing !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Sửa giá trị {editing?.option.name.toLowerCase()}</DialogTitle>
                    <DialogDescription>
                        Chỉ đổi nhãn hiển thị. Tên các biến thể đã tạo giữ nguyên, sửa trong thẻ biến thể nếu cần.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <Label>Nhãn</Label>
                    <Input
                        value={label}
                        onChange={(event) => {
                            setLabel(event.target.value);
                            setError('');
                        }}
                        maxLength={60}
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        Mã: <code>{editing?.value.code}</code> (không đổi)
                    </p>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                {usedBy > 0 ? (
                    <p className="text-xs text-muted-foreground">
                        Có {usedBy} biến thể đang dùng giá trị này nên không xóa được.
                    </p>
                ) : isLastValue ? (
                    <p className="text-xs text-muted-foreground">Thuộc tính phải còn ít nhất một giá trị.</p>
                ) : null}

                <DialogFooter className="sm:justify-between">
                    <Button
                        variant="destructive"
                        onClick={() => remove.mutate()}
                        disabled={busy || usedBy > 0 || isLastValue}
                    >
                        Xóa giá trị
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={close} disabled={busy}>
                            Hủy
                        </Button>
                        <Button
                            onClick={() => rename.mutate(label.trim())}
                            disabled={busy || !label.trim() || unchanged}
                        >
                            {rename.isPending ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}