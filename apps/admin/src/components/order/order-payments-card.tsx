'use client';

import { useState } from 'react';
import { Plus, Undo2 } from 'lucide-react';
import {
    PAYMENT_METHOD_LABEL,
    PAYMENT_PURPOSE_LABEL,
    type PaymentPurposeValue,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
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
import { PriceInput } from '@/components/price-input';
import { formatVnd } from '@/lib/format';
import { formatDateTimeVn, type OrderDetail } from '@/lib/order-types';
import { useOrderAction } from '@/lib/use-order-action';

type Method = 'CASH' | 'BANK_TRANSFER' | 'COD';

export function OrderPaymentsCard({ order }: { order: OrderDetail }) {
    const { can } = useAuth();
    const canRecord = can('payment.record');
    const closed = order.status === 'COMPLETED' || order.status === 'CANCELLED';
    const { run, pending } = useOrderAction(order);

    const [open, setOpen] = useState(false);
    const [refund, setRefund] = useState(false);
    const [method, setMethod] = useState<Method>('CASH');
    const [purpose, setPurpose] = useState<PaymentPurposeValue>('FULL');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const depositDue = Math.max(order.depositRequired - order.paidTotal, 0);

    /** Số tiền điền sẵn theo khoản thu: nhân viên không phải tự tính */
    function defaultAmount(value: PaymentPurposeValue): number {
        if (value === 'REFUND') return order.paidTotal;
        if (value === 'DEPOSIT') return depositDue;
        return order.balanceDue;
    }

    function choosePurpose(value: PaymentPurposeValue) {
        setPurpose(value);
        setAmount(String(defaultAmount(value)));
    }

    function openRecord(asRefund: boolean) {
        setRefund(asRefund);
        setMethod(asRefund ? 'BANK_TRANSFER' : 'CASH');
        // Gợi ý: còn thiếu cọc -> thu cọc; chưa thu gì -> thu đủ; đã thu một phần -> thu tiếp
        const suggested: PaymentPurposeValue = asRefund
            ? 'REFUND'
            : depositDue > 0
                ? 'DEPOSIT'
                : order.paidTotal === 0
                    ? 'FULL'
                    : 'BALANCE';
        choosePurpose(suggested);
        setNote('');
        setOpen(true);
    }

    // "Thu đủ" luôn bằng đúng số còn phải thu: khóa ô, tránh gõ nhầm
    const amountLocked = !refund && purpose === 'FULL';
    const limit = refund ? order.paidTotal : order.balanceDue;
    const overLimit = Number(amount || 0) > limit;

    async function submit() {
        const result = await run(
            `/orders/${order.id}/payments`,
            'POST',
            { method, purpose, amount: Number(amount), ...(note.trim() ? { note: note.trim() } : {}) },
            refund ? 'Đã ghi hoàn tiền' : 'Đã ghi nhận thanh toán',
        );
        if (result) setOpen(false);
    }

    async function cancelPayment() {
        if (!cancelling) return;
        const result = await run(
            `/orders/payments/${cancelling}/cancel`,
            'POST',
            { reason: cancelReason.trim() },
            'Đã hủy khoản thu',
        );
        if (result) setCancelling(null);
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Thanh toán</CardTitle>
                {canRecord && (
                    <div className="flex gap-1">
                        {!closed && order.balanceDue > 0 && (
                            <Button size="sm" onClick={() => openRecord(false)}>
                                <Plus className="size-3.5" />
                                Ghi nhận thu tiền
                            </Button>
                        )}
                        {order.paidTotal > 0 && (
                            <Button size="sm" variant="ghost" onClick={() => openRecord(true)}>
                                <Undo2 className="size-3.5" />
                                Hoàn tiền
                            </Button>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border p-2">
                        <dt className="text-xs text-muted-foreground">Cọc yêu cầu</dt>
                        <dd className="font-semibold tabular-nums">{formatVnd(order.depositRequired)}</dd>
                    </div>
                    <div className="rounded-lg border p-2">
                        <dt className="text-xs text-muted-foreground">Đã thu</dt>
                        <dd className="font-semibold tabular-nums">{formatVnd(order.paidTotal)}</dd>
                    </div>
                    <div className={cn('rounded-lg border p-2', order.balanceDue > 0 && 'border-amber-500/50 bg-amber-500/5')}>
                        <dt className="text-xs text-muted-foreground">Còn phải thu</dt>
                        <dd className="font-semibold tabular-nums">{formatVnd(order.balanceDue)}</dd>
                    </div>
                </dl>

                {order.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có khoản thu nào.</p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {order.payments.map((payment) => {
                            const cancelledPayment = payment.status === 'CANCELLED';
                            const isRefund = payment.purpose === 'REFUND';
                            return (
                                <li key={payment.id} className={cn('flex items-start gap-3 p-3 text-sm', cancelledPayment && 'opacity-50')}>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">
                                            {PAYMENT_PURPOSE_LABEL[payment.purpose]} · {PAYMENT_METHOD_LABEL[payment.method]}
                                            {cancelledPayment && <Badge variant="outline" className="ml-2">Đã hủy</Badge>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDateTimeVn(payment.paidAt ?? payment.createdAt)}
                                            {payment.receivedBy && ` · ${payment.receivedBy.fullName}`}
                                            {payment.transferContent && ` · Nội dung CK: ${payment.transferContent}`}
                                        </p>
                                        {payment.note && <p className="text-xs text-muted-foreground">{payment.note}</p>}
                                    </div>
                                    <span className={cn('font-semibold tabular-nums whitespace-nowrap', isRefund && 'text-destructive')}>
                                        {isRefund ? '−' : '+'}
                                        {formatVnd(payment.amount)}
                                    </span>
                                    {canRecord && !cancelledPayment && (
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => {
                                                setCancelReason('');
                                                setCancelling(payment.id);
                                            }}
                                        >
                                            Hủy
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{refund ? 'Ghi hoàn tiền' : 'Ghi nhận thu tiền'}</DialogTitle>
                        <DialogDescription>
                            {refund
                                ? `Đã thu ${formatVnd(order.paidTotal)}.`
                                : `Còn phải thu ${formatVnd(order.balanceDue)}. Chỉ ghi khi đã thực nhận tiền.`}
                        </DialogDescription>
                    </DialogHeader>
                    <fieldset disabled={pending} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Hình thức</Label>
                                <select
                                    value={method}
                                    onChange={(event) => setMethod(event.target.value as Method)}
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                >
                                    <option value="CASH">{PAYMENT_METHOD_LABEL.CASH}</option>
                                    <option value="BANK_TRANSFER">{PAYMENT_METHOD_LABEL.BANK_TRANSFER}</option>
                                    {!refund && <option value="COD">{PAYMENT_METHOD_LABEL.COD}</option>}
                                </select>
                            </div>
                            {!refund && (
                                <div className="space-y-1.5">
                                    <Label>Khoản thu</Label>
                                    <select
                                        value={purpose}
                                        onChange={(event) => choosePurpose(event.target.value as PaymentPurposeValue)}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                    >
                                        {/* Chỉ cho chọn cọc khi đơn có yêu cầu cọc mà chưa cọc đủ */}
                                        {depositDue > 0 && <option value="DEPOSIT">{PAYMENT_PURPOSE_LABEL.DEPOSIT}</option>}
                                        <option value="FULL">{PAYMENT_PURPOSE_LABEL.FULL}</option>
                                        <option value="BALANCE">{PAYMENT_PURPOSE_LABEL.BALANCE}</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Số tiền</Label>
                            <PriceInput value={amount} onChange={setAmount} disabled={amountLocked} invalid={overLimit} />
                            {overLimit ? (
                                <p className="text-xs text-destructive">
                                    {refund ? 'Không hoàn quá số đã thu' : 'Vượt số còn phải thu'} ({formatVnd(limit)})
                                </p>
                            ) : amountLocked ? (
                                <p className="text-xs text-muted-foreground">Thu đủ = toàn bộ số còn phải thu. Thu một phần thì chọn "Thu tiếp".</p>
                            ) : (
                                <p className="flex flex-wrap gap-x-3 text-xs">
                                    {/* Bấm để điền nhanh */}
                                    {refund ? (
                                        <button type="button" className="text-primary hover:underline" onClick={() => setAmount(String(order.paidTotal))}>
                                            Hoàn toàn bộ {formatVnd(order.paidTotal)}
                                        </button>
                                    ) : (
                                        <>
                                            <button type="button" className="text-primary hover:underline" onClick={() => setAmount(String(order.balanceDue))}>
                                                Còn phải thu {formatVnd(order.balanceDue)}
                                            </button>
                                            {depositDue > 0 && purpose !== 'DEPOSIT' && (
                                                <button type="button" className="text-primary hover:underline" onClick={() => setAmount(String(depositDue))}>
                                                    Cọc còn thiếu {formatVnd(depositDue)}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Ghi chú</Label>
                            <Input
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder={method === 'BANK_TRANSFER' ? 'Mã giao dịch ngân hàng...' : ''}
                                maxLength={1000}
                            />
                        </div>
                    </fieldset>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                            Hủy
                        </Button>
                        <Button onClick={() => void submit()} disabled={pending || !amount || Number(amount) <= 0 || overLimit}>
                            {pending ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cancelling !== null} onOpenChange={(value) => !value && setCancelling(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Hủy khoản thu này?</DialogTitle>
                        <DialogDescription>Dùng khi ghi nhầm. Khoản thu vẫn được giữ lại trong lịch sử với nhãn "Đã hủy".</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Lý do *</Label>
                        <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} autoFocus maxLength={500} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelling(null)} disabled={pending}>
                            Không
                        </Button>
                        <Button variant="destructive" onClick={() => void cancelPayment()} disabled={pending || !cancelReason.trim()}>
                            Hủy khoản thu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}