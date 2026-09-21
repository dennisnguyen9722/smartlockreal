'use client';

import { useState } from 'react';
import { Check, CircleAlert, Undo2, X } from 'lucide-react';
import {
    nextOrderStatus,
    ORDER_NEXT_ACTION_LABEL,
    ORDER_STATUS_FLOW,
    ORDER_STATUS_LABEL,
    previousOrderStatus,
    type OrderStatusValue,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent } from '@ktm/ui/components/card';
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
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import type { OrderDetail } from '@/lib/order-types';
import { useOrderAction } from '@/lib/use-order-action';

type DialogKind = 'next' | 'back' | 'cancel' | null;

export function OrderStatusBar({ order }: { order: OrderDetail }) {
    const { can } = useAuth();
    const canManage = can('order.manage');
    const canCancel = can('order.cancel');
    const { run, pending } = useOrderAction(order);

    const [dialog, setDialog] = useState<DialogKind>(null);
    const [note, setNote] = useState('');
    const [brandOrderRef, setBrandOrderRef] = useState('');
    const [cancelReason, setCancelReason] = useState('');

    const next = nextOrderStatus(order.status);
    const previous = previousOrderStatus(order.status);
    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const cancelled = order.status === 'CANCELLED';
    const closed = cancelled || order.status === 'COMPLETED';

    function open(kind: DialogKind) {
        setNote('');
        setBrandOrderRef(order.brandOrderRef ?? '');
        setCancelReason('');
        setDialog(kind);
    }

    async function submit(to: OrderStatusValue, extra: Record<string, unknown>, success: string) {
        const result = await run(`/orders/${order.id}/status`, 'POST', { to, ...extra }, success);
        if (result) setDialog(null);
    }

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {/* Các bước của quy trình */}
                <ol className="flex flex-wrap items-center gap-y-2">
                    {ORDER_STATUS_FLOW.map((status, index) => {
                        const done = !cancelled && index < currentIndex;
                        const current = !cancelled && index === currentIndex;
                        return (
                            <li key={status} className="flex items-center">
                                <span
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                                        current && 'bg-primary text-primary-foreground',
                                        done && 'text-foreground',
                                        !current && !done && 'text-muted-foreground',
                                    )}
                                >
                                    {done ? (
                                        <Check className="size-3.5" />
                                    ) : (
                                        <span className="flex size-4 items-center justify-center rounded-full border text-[10px]">
                                            {index + 1}
                                        </span>
                                    )}
                                    {ORDER_STATUS_LABEL[status]}
                                </span>
                                {index < ORDER_STATUS_FLOW.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
                            </li>
                        );
                    })}
                </ol>

                {cancelled && (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                        <strong>Đơn đã hủy.</strong> {order.cancelReason}
                    </p>
                )}

                {/* Việc còn thiếu để sang bước tiếp theo */}
                {!closed && order.nextStepBlockers.length > 0 && (
                    <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        {order.nextStepBlockers.map((blocker) => (
                            <li key={blocker.field + blocker.message} className="flex items-start gap-2">
                                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                {blocker.message}
                            </li>
                        ))}
                    </ul>
                )}

                {canManage && !closed && (
                    <div className="flex flex-wrap gap-2">
                        {next && (
                            <Button onClick={() => open('next')} disabled={pending || order.nextStepBlockers.length > 0}>
                                <Check className="size-4" />
                                {ORDER_NEXT_ACTION_LABEL[next] ?? ORDER_STATUS_LABEL[next]}
                            </Button>
                        )}
                        {previous && (
                            <Button variant="outline" onClick={() => open('back')} disabled={pending}>
                                <Undo2 className="size-4" />
                                Lùi về "{ORDER_STATUS_LABEL[previous]}"
                            </Button>
                        )}
                        {canCancel && (
                            <Button variant="ghost" className="ml-auto text-destructive" onClick={() => open('cancel')} disabled={pending}>
                                <X className="size-4" />
                                Hủy đơn
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Bước tiếp theo */}
            <Dialog open={dialog === 'next'} onOpenChange={(value) => !value && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{next ? (ORDER_NEXT_ACTION_LABEL[next] ?? ORDER_STATUS_LABEL[next]) : ''}</DialogTitle>
                        <DialogDescription>
                            Đơn {order.code} chuyển sang <strong>{next ? ORDER_STATUS_LABEL[next] : ''}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <fieldset disabled={pending} className="space-y-3">
                        {next === 'ORDERED_FROM_BRAND' && (
                            <div className="space-y-1.5">
                                <Label>Mã đơn bên hãng (nếu có)</Label>
                                <Input value={brandOrderRef} onChange={(event) => setBrandOrderRef(event.target.value)} maxLength={100} />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label>Ghi chú (không bắt buộc)</Label>
                            <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
                        </div>
                    </fieldset>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                            Hủy
                        </Button>
                        <Button
                            disabled={pending}
                            onClick={() =>
                                next &&
                                void submit(
                                    next,
                                    {
                                        ...(note.trim() ? { note: note.trim() } : {}),
                                        ...(next === 'ORDERED_FROM_BRAND' && brandOrderRef.trim() ? { brandOrderRef: brandOrderRef.trim() } : {}),
                                    },
                                    `Đã chuyển sang "${ORDER_STATUS_LABEL[next]}"`,
                                )
                            }
                        >
                            {pending ? 'Đang lưu...' : 'Xác nhận'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Lùi bước */}
            <Dialog open={dialog === 'back'} onOpenChange={(value) => !value && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Lùi về "{previous ? ORDER_STATUS_LABEL[previous] : ''}"?</DialogTitle>
                        <DialogDescription>Dùng khi bấm nhầm bước. Mốc thời gian của bước hiện tại sẽ bị xóa.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Lý do (không bắt buộc)</Label>
                        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                            Hủy
                        </Button>
                        <Button
                            disabled={pending}
                            onClick={() =>
                                previous && void submit(previous, note.trim() ? { note: note.trim() } : {}, 'Đã lùi bước')
                            }
                        >
                            Lùi bước
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hủy đơn */}
            <Dialog open={dialog === 'cancel'} onOpenChange={(value) => !value && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Hủy đơn {order.code}?</DialogTitle>
                        <DialogDescription>
                            {order.paidTotal > 0
                                ? 'Đơn đã thu tiền: hãy ghi hoàn tiền ở mục Thanh toán trước khi hủy.'
                                : 'Đơn hủy không mở lại được.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Lý do hủy *</Label>
                        <Input
                            value={cancelReason}
                            onChange={(event) => setCancelReason(event.target.value)}
                            placeholder="Khách đổi ý, hãng hết hàng..."
                            maxLength={1000}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                            Không hủy
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={pending || !cancelReason.trim() || order.paidTotal > 0}
                            onClick={() => void submit('CANCELLED', { cancelReason: cancelReason.trim() }, 'Đã hủy đơn')}
                        >
                            Hủy đơn
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}