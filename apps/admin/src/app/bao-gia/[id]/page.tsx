'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, CircleAlert, CopyPlus, Pencil, Printer, Send, ShoppingCart, ThumbsDown, ThumbsUp, Undo2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    formatDiscountBps,
    formatVnPhone,
    QUOTE_SEND_CHANNEL_LABEL,
    QUOTE_STATUS_LABEL,
    type QuoteActionValue,
    type QuoteSendChannelValue,
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ktm/ui/components/table';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { OrderLineEditor, toLineInputs, type LineDraft } from '@/components/order/order-line-editor';
import { PageHeader } from '@/components/page-header';
import { PriceInput } from '@/components/price-input';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';
import type { QuoteDetail } from '@/lib/quote-types';
import { useQuoteAction } from '@/lib/use-quote-action';

function formatDate(value: string): string {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN');
}

export default function QuoteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const query = useApiQuery<QuoteDetail>(['quote', id], `/quotes/${id}`, { refetchOnMount: 'always' });

    const back = (
        <Link href="/bao-gia">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách báo giá
            </Button>
        </Link>
    );

    if (query.isPending) {
        return (
            <>
                <PageHeader title="Báo giá" actions={back} />
                <LoadingRows rows={6} />
            </>
        );
    }
    if (query.isError) {
        const notFound =
            query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Báo giá" actions={back} />
                {notFound ? <EmptyState message="Không tìm thấy báo giá" action={back} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }

    const quote = query.data;
    return (
        <>
            <PageHeader
                title={`Báo giá ${quote.code}${quote.revision > 1 ? ` (bản ${quote.revision})` : ''}`}
                description={`${quote.customer.companyName ?? quote.customer.fullName}${quote.projectName ? ` · ${quote.projectName}` : ''} · Hiệu lực đến ${formatDate(quote.validUntil)}`}
                actions={back}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-6">
                    <ApprovalCard quote={quote} />
                    <LinesCard quote={quote} />
                    <InfoCard quote={quote} />
                </div>
                <aside className="space-y-6 lg:self-start">
                    <TotalsCard quote={quote} />
                    <CustomerCard quote={quote} />
                    {quote.revisions.length > 1 && <RevisionsCard quote={quote} />}
                </aside>
            </div>
        </>
    );
}

// ---------- Trạng thái, duyệt, gửi, chuyển thành đơn ----------

function ApprovalCard({ quote }: { quote: QuoteDetail }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { can, authFetch } = useAuth();
    const canManage = can('quote.manage');
    const canApprove = can('quote.approve');
    const canCreateOrder = can('order.manage');
    const { run, pending } = useQuoteAction(quote);
    const [dialog, setDialog] = useState<QuoteActionValue | 'CONVERT' | 'REVISE' | null>(null);
    const [note, setNote] = useState('');
    const [via, setVia] = useState<QuoteSendChannelValue>('ZALO');
    const [address, setAddress] = useState('');
    const [busy, setBusy] = useState(false);

    const status = quote.status;
    const threshold = formatDiscountBps(quote.approvalThresholdBps);
    const working = pending || busy;

    const DIALOG_TEXT: Record<QuoteActionValue, { title: string; confirm: string; noteLabel: string; noteRequired?: boolean }> = {
        SUBMIT: { title: 'Gửi quản trị duyệt?', confirm: 'Gửi duyệt', noteLabel: 'Lý do giảm giá (giúp duyệt nhanh hơn)' },
        WITHDRAW: { title: 'Rút lại để sửa?', confirm: 'Rút lại', noteLabel: 'Ghi chú' },
        APPROVE: { title: 'Duyệt báo giá này?', confirm: 'Duyệt', noteLabel: 'Ghi chú duyệt' },
        RETURN: { title: 'Trả lại cho nhân viên sửa?', confirm: 'Trả lại', noteLabel: 'Lý do trả lại *', noteRequired: true },
        REOPEN: { title: 'Đưa về Nháp để sửa?', confirm: 'Về Nháp', noteLabel: 'Ghi chú' },
        CANCEL: { title: 'Hủy báo giá?', confirm: 'Hủy báo giá', noteLabel: 'Lý do hủy' },
        MARK_SENT: { title: 'Ghi nhận đã gửi báo giá cho khách', confirm: 'Đã gửi', noteLabel: 'Ghi chú' },
        ACCEPT: { title: 'Khách đồng ý báo giá?', confirm: 'Khách đồng ý', noteLabel: 'Ghi chú' },
        REJECT: { title: 'Khách từ chối báo giá?', confirm: 'Khách từ chối', noteLabel: 'Lý do khách từ chối *', noteRequired: true },
    };

    function open(action: QuoteActionValue | 'CONVERT' | 'REVISE') {
        setNote('');
        setAddress(quote.siteAddress ?? '');
        setDialog(action);
    }

    async function submitAction() {
        if (!dialog || dialog === 'CONVERT' || dialog === 'REVISE') return;
        const result = await run(
            `/quotes/${quote.id}/actions`,
            'POST',
            { action: dialog, ...(note.trim() ? { note: note.trim() } : {}), ...(dialog === 'MARK_SENT' ? { via } : {}) },
            'Đã cập nhật báo giá',
        );
        if (result) setDialog(null);
    }

    /** Tạo phiên bản mới rồi mở luôn bản mới để sửa */
    async function revise() {
        setBusy(true);
        try {
            const created = await authFetch<QuoteDetail>(`/quotes/${quote.id}/revise`, {
                method: 'POST',
                body: JSON.stringify({ expectedVersion: quote.version }),
            });
            void queryClient.invalidateQueries({ queryKey: ['quotes'] });
            void queryClient.invalidateQueries({ queryKey: ['quote', quote.id] });
            toast.success(`Đã tạo bản ${created.revision}, sửa xong gửi lại cho khách`);
            router.push(`/bao-gia/${created.id}`);
        } catch (error) {
            toast.error(errorText(error));
            setBusy(false);
        }
    }

    /** Khách đồng ý -> tạo đơn Công trình rồi mở đơn */
    async function convert() {
        setBusy(true);
        try {
            const result = await authFetch<{ orderId: string; orderCode: string }>(`/quotes/${quote.id}/convert`, {
                method: 'POST',
                body: JSON.stringify({
                    expectedVersion: quote.version,
                    fulfillmentType: 'DELIVERY',
                    ...(address.trim() ? { shipAddressRaw: address.trim() } : {}),
                }),
            });
            void queryClient.invalidateQueries({ queryKey: ['quotes'] });
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            toast.success(`Đã tạo đơn ${result.orderCode}`);
            router.push(`/don-hang/${result.orderId}`);
        } catch (error) {
            toast.error(errorText(error));
            setBusy(false);
        }
    }

    const canSend = canManage && (quote.requiresApproval ? ['APPROVED', 'SENT'] : ['DRAFT', 'APPROVED', 'SENT']).includes(status);
    const cancellable = !['CONVERTED', 'CANCELLED', 'SUPERSEDED'].includes(status);
    const revisable = ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(status);
    const text = dialog && dialog !== 'CONVERT' && dialog !== 'REVISE' ? DIALOG_TEXT[dialog] : null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Trạng thái</CardTitle>
                <Badge variant={status === 'PENDING_APPROVAL' ? 'destructive' : 'secondary'}>{QUOTE_STATUS_LABEL[status]}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
                {status === 'SUPERSEDED' && (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm">Bản này đã được thay bằng phiên bản mới hơn (xem mục Các phiên bản).</p>
                )}
                {quote.requiresApproval && ['DRAFT', 'PENDING_APPROVAL'].includes(status) && (
                    <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        Giảm nhiều nhất {formatDiscountBps(quote.maxDiscountBps)}, vượt ngưỡng {threshold}: cần quản trị duyệt trước khi gửi khách.
                    </p>
                )}
                {!quote.requiresApproval && status === 'DRAFT' && (
                    <p className="text-sm text-muted-foreground">Không dòng nào giảm quá {threshold}: không cần duyệt, gửi khách được ngay.</p>
                )}

                {quote.approvedAt && (
                    <p className="text-sm">
                        <Check className="mr-1 inline size-4 text-green-600" />
                        Đã duyệt bởi {quote.approvedBy?.fullName} lúc {formatDateTimeVn(quote.approvedAt)}
                    </p>
                )}
                {quote.sentAt && (
                    <p className="text-sm">
                        <Send className="mr-1 inline size-4 text-muted-foreground" />
                        Đã gửi khách lúc {formatDateTimeVn(quote.sentAt)}
                        {quote.sentBy && ` bởi ${quote.sentBy.fullName}`}
                    </p>
                )}
                {quote.approvalNote && (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm">
                        <span className="text-xs text-muted-foreground">Ghi chú duyệt: </span>
                        {quote.approvalNote}
                    </p>
                )}
                {quote.rejectedReason && status === 'REJECTED' && (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                        <span className="text-xs text-muted-foreground">Khách từ chối: </span>
                        {quote.rejectedReason}
                    </p>
                )}
                {quote.order && (
                    <p className="text-sm">
                        Đã chuyển thành đơn{' '}
                        <Link href={`/don-hang/${quote.order.id}`} className="font-mono font-medium hover:underline">
                            {quote.order.code}
                        </Link>
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <Link href={`/bao-gia/${quote.id}/in`} target="_blank">
                        <Button variant="outline">
                            <Printer className="size-4" />
                            In / Lưu PDF
                        </Button>
                    </Link>

                    {canManage && status === 'DRAFT' && quote.requiresApproval && (
                        <Button onClick={() => open('SUBMIT')} disabled={working}>
                            <Send className="size-4" />
                            Gửi duyệt
                        </Button>
                    )}
                    {canApprove && status === 'PENDING_APPROVAL' && (
                        <>
                            <Button onClick={() => open('APPROVE')} disabled={working}>
                                <Check className="size-4" />
                                Duyệt
                            </Button>
                            <Button variant="outline" onClick={() => open('RETURN')} disabled={working}>
                                <Undo2 className="size-4" />
                                Trả lại
                            </Button>
                        </>
                    )}
                    {canManage && status === 'PENDING_APPROVAL' && (
                        <Button variant="outline" onClick={() => open('WITHDRAW')} disabled={working}>
                            Rút lại để sửa
                        </Button>
                    )}
                    {canSend && (
                        <Button onClick={() => open('MARK_SENT')} disabled={working} variant={status === 'SENT' ? 'outline' : 'default'}>
                            <Send className="size-4" />
                            {status === 'SENT' ? 'Ghi gửi lại' : 'Đã gửi khách'}
                        </Button>
                    )}
                    {canManage && status === 'SENT' && (
                        <>
                            <Button onClick={() => open('ACCEPT')} disabled={working}>
                                <ThumbsUp className="size-4" />
                                Khách đồng ý
                            </Button>
                            <Button variant="outline" onClick={() => open('REJECT')} disabled={working}>
                                <ThumbsDown className="size-4" />
                                Khách từ chối
                            </Button>
                        </>
                    )}
                    {canManage && canCreateOrder && status === 'ACCEPTED' && (
                        <Button onClick={() => open('CONVERT')} disabled={working}>
                            <ShoppingCart className="size-4" />
                            Tạo đơn hàng
                        </Button>
                    )}
                    {canManage && revisable && (
                        <Button variant="outline" onClick={() => open('REVISE')} disabled={working}>
                            <CopyPlus className="size-4" />
                            Tạo phiên bản mới
                        </Button>
                    )}
                    {canManage && status === 'APPROVED' && (
                        <Button variant="outline" onClick={() => open('REOPEN')} disabled={working}>
                            <Pencil className="size-4" />
                            Sửa lại (về Nháp, phải duyệt lại)
                        </Button>
                    )}
                    {canManage && cancellable && (
                        <Button variant="ghost" className="ml-auto text-destructive" onClick={() => open('CANCEL')} disabled={working}>
                            <X className="size-4" />
                            Hủy báo giá
                        </Button>
                    )}
                </div>
            </CardContent>

            {/* Các thao tác đơn giản: một ô ghi chú (và kênh gửi) */}
            <Dialog open={text !== null} onOpenChange={(value) => !value && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{text?.title}</DialogTitle>
                        <DialogDescription>
                            Báo giá {quote.code}
                            {dialog === 'MARK_SENT' && '. Nhớ gửi file PDF (bấm "In / Lưu PDF") cho khách trước khi ghi nhận.'}
                        </DialogDescription>
                    </DialogHeader>
                    {dialog === 'MARK_SENT' && (
                        <div className="space-y-1.5">
                            <Label>Gửi qua</Label>
                            <div className="flex gap-2">
                                {(Object.keys(QUOTE_SEND_CHANNEL_LABEL) as QuoteSendChannelValue[]).map((channel) => (
                                    <Button key={channel} type="button" variant={via === channel ? 'default' : 'outline'} onClick={() => setVia(channel)}>
                                        {QUOTE_SEND_CHANNEL_LABEL[channel]}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>{text?.noteLabel}</Label>
                        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} autoFocus />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={working}>
                            Không
                        </Button>
                        <Button
                            variant={dialog === 'CANCEL' || dialog === 'REJECT' ? 'destructive' : 'default'}
                            onClick={() => void submitAction()}
                            disabled={working || Boolean(text?.noteRequired && !note.trim())}
                        >
                            {text?.confirm}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Phiên bản mới */}
            <Dialog open={dialog === 'REVISE'} onOpenChange={(value) => !value && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tạo phiên bản {quote.revision + 1}?</DialogTitle>
                        <DialogDescription>
                            Bản hiện tại chuyển sang "Đã thay thế" (vẫn xem lại được). Bản mới là Nháp, giữ nguyên sản phẩm và giá đã báo,
                            ngày hiệu lực tính lại từ hôm nay. Sửa xong thì gửi lại cho khách.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={working}>
                            Không
                        </Button>
                        <Button onClick={() => void revise()} disabled={working}>
                            {busy ? 'Đang tạo...' : 'Tạo phiên bản mới'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chuyển thành đơn */}
            <Dialog open={dialog === 'CONVERT'} onOpenChange={(value) => !value && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tạo đơn hàng từ báo giá?</DialogTitle>
                        <DialogDescription>
                            Đơn kênh Công trình, giữ nguyên {quote.lines.length} sản phẩm và giá đã báo, tổng {formatVnd(quote.grandTotal)}
                            {quote.depositRequired > 0 && `, cọc ${formatVnd(quote.depositRequired)}`}. Đơn bắt đầu ở Chờ xác nhận và đi
                            theo quy trình đơn hàng (chuẩn hóa địa chỉ, đặt hãng, thu tiền).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Địa chỉ giao lắp</Label>
                        <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Địa chỉ công trình" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={working}>
                            Không
                        </Button>
                        <Button onClick={() => void convert()} disabled={working || !address.trim()}>
                            {busy ? 'Đang tạo...' : 'Tạo đơn hàng'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ---------- Sản phẩm ----------

function LinesCard({ quote }: { quote: QuoteDetail }) {
    const { can } = useAuth();
    const { run, pending } = useQuoteAction(quote);
    const [editing, setEditing] = useState(false);
    const [drafts, setDrafts] = useState<LineDraft[]>([]);
    const editable = can('quote.manage') && quote.status === 'DRAFT';

    function start() {
        setDrafts(
            quote.lines
                .filter((line) => line.variantId)
                .map((line) => ({
                    key: line.id,
                    variantId: line.variantId as string,
                    name: line.name,
                    sku: line.sku ?? '',
                    listPrice: line.referencePrice,
                    quantity: line.quantity,
                    unitPrice: String(line.unitPrice),
                    // Giữ giá đã báo; giá hệ thống được tính lại theo giá niêm yết hiện tại
                    keepPrice: true,
                })),
        );
        setEditing(true);
    }

    async function save() {
        const result = await run(`/quotes/${quote.id}/lines`, 'PUT', { lines: toLineInputs(drafts) }, 'Đã cập nhật sản phẩm');
        if (result) setEditing(false);
    }

    if (editing) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sửa sản phẩm và giá báo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <OrderLineEditor lines={drafts} onChange={setDrafts} disabled={pending} showDiscount priceLabel="Giá lẻ" />
                    <div className="flex justify-end gap-2 border-t pt-3">
                        <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>
                            Hủy
                        </Button>
                        <Button onClick={() => void save()} disabled={pending || drafts.length === 0}>
                            {pending ? 'Đang lưu...' : 'Lưu sản phẩm'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Sản phẩm và giá báo</CardTitle>
                {editable && (
                    <Button variant="outline" size="sm" onClick={start}>
                        <Pencil className="size-3.5" />
                        Sửa sản phẩm
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sản phẩm</TableHead>
                                <TableHead className="text-center">SL</TableHead>
                                <TableHead className="text-right">Giá lẻ</TableHead>
                                <TableHead className="text-right">Giá báo</TableHead>
                                <TableHead className="text-right">Giảm</TableHead>
                                <TableHead className="text-right">Thành tiền</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quote.lines.map((line) => {
                                const overThreshold = line.discountBps > quote.approvalThresholdBps;
                                return (
                                    <TableRow key={line.id}>
                                        <TableCell>
                                            <p className="font-medium">{line.name}</p>
                                            <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">{line.quantity}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                            {formatVnd(line.referencePrice)}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap tabular-nums">{formatVnd(line.unitPrice)}</TableCell>
                                        <TableCell className={cn('text-right whitespace-nowrap tabular-nums', overThreshold && 'font-medium text-destructive')}>
                                            {line.discountBps !== 0 ? formatDiscountBps(line.discountBps) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatVnd(line.lineTotal)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// ---------- Thông tin chung ----------

function InfoCard({ quote }: { quote: QuoteDetail }) {
    const { can } = useAuth();
    const canManage = can('quote.manage');
    const draft = quote.status === 'DRAFT';
    const { run, pending } = useQuoteAction(quote);

    const initial = {
        contactId: quote.contactId ?? '',
        projectName: quote.projectName ?? '',
        siteAddress: quote.siteAddress ?? '',
        validUntil: quote.validUntil.slice(0, 10),
        vatInvoiceRequested: quote.vatInvoiceRequested,
        shippingFee: String(quote.shippingFee),
        depositRequired: String(quote.depositRequired),
        terms: quote.terms ?? '',
        internalNote: quote.internalNote ?? '',
    };
    const [values, setValues] = useState(initial);
    useEffect(() => setValues(initial), [quote.version]); // eslint-disable-line react-hooks/exhaustive-deps

    const changed = (Object.keys(values) as (keyof typeof values)[]).filter((key) => values[key] !== initial[key]);

    async function save() {
        const body: Record<string, unknown> = {};
        for (const key of changed) {
            if (key === 'vatInvoiceRequested') body[key] = values[key];
            else if (key === 'shippingFee' || key === 'depositRequired') body[key] = Number(values[key] || 0);
            else if (key === 'validUntil') body[key] = values[key];
            else if (key === 'internalNote') body[key] = values[key].trim() || null;
            else body[key] = (values[key] as string).trim() || null;
        }
        await run(`/quotes/${quote.id}`, 'PATCH', body, 'Đã lưu');
    }

    const set = (patch: Partial<typeof values>) => setValues((current) => ({ ...current, ...patch }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Thông tin báo giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {!draft && (
                    <p className="text-xs text-muted-foreground">
                        Báo giá không còn ở Nháp: chỉ sửa được ghi chú nội bộ.
                    </p>
                )}
                <fieldset disabled={!canManage || pending} className="min-w-0 space-y-4">
                    <fieldset disabled={!draft} className="min-w-0 space-y-4">
                        {quote.customer.contacts.length > 0 && (
                            <div className="space-y-1.5">
                                <Label>Người nhận báo giá</Label>
                                <select
                                    value={values.contactId}
                                    onChange={(event) => set({ contactId: event.target.value })}
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                >
                                    <option value="">— Không chọn —</option>
                                    {quote.customer.contacts.map((contact) => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.fullName}
                                            {contact.position ? ` · ${contact.position}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Tên công trình</Label>
                                <Input value={values.projectName} onChange={(event) => set({ projectName: event.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Hiệu lực đến</Label>
                                <Input type="date" value={values.validUntil} onChange={(event) => set({ validUntil: event.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Địa chỉ công trình</Label>
                            <Input value={values.siteAddress} onChange={(event) => set({ siteAddress: event.target.value })} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <label className="flex items-center gap-2 pt-6 text-sm">
                                <input
                                    type="checkbox"
                                    checked={values.vatInvoiceRequested}
                                    onChange={(event) => set({ vatInvoiceRequested: event.target.checked })}
                                    className="size-4"
                                />
                                Lấy hóa đơn VAT
                            </label>
                            <div className="space-y-1.5">
                                <Label>Phí vận chuyển</Label>
                                <PriceInput value={values.shippingFee} onChange={(shippingFee) => set({ shippingFee })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Cọc yêu cầu</Label>
                                <PriceInput value={values.depositRequired} onChange={(depositRequired) => set({ depositRequired })} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Điều khoản</Label>
                            <textarea
                                value={values.terms}
                                onChange={(event) => set({ terms: event.target.value })}
                                rows={5}
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            />
                        </div>
                    </fieldset>
                    <div className="space-y-1.5">
                        <Label>Ghi chú nội bộ</Label>
                        <textarea
                            value={values.internalNote}
                            onChange={(event) => set({ internalNote: event.target.value })}
                            rows={2}
                            placeholder="Khách không nhìn thấy"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                </fieldset>
                {canManage && changed.length > 0 && (
                    <div className="flex justify-end gap-2 border-t pt-3">
                        <Button variant="outline" onClick={() => setValues(initial)} disabled={pending}>
                            Hủy thay đổi
                        </Button>
                        <Button onClick={() => void save()} disabled={pending}>
                            {pending ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------- Cột phải ----------

function TotalsCard({ quote }: { quote: QuoteDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Tổng báo giá</CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="space-y-1.5 text-sm">
                    <Row label="Theo giá lẻ" value={formatVnd(quote.referenceSubtotal)} muted />
                    <Row label="Tạm tính (chưa VAT)" value={formatVnd(quote.subtotal)} />
                    {quote.savings > 0 && (
                        <div className="flex justify-between text-green-700">
                            <dt>Tiết kiệm so với giá lẻ</dt>
                            <dd className="tabular-nums">{formatVnd(quote.savings)}</dd>
                        </div>
                    )}
                    {quote.shippingFee > 0 && <Row label="Phí vận chuyển" value={formatVnd(quote.shippingFee)} />}
                    <Row label="VAT" value={quote.vatInvoiceRequested ? formatVnd(quote.vatTotal) : 'Không lấy hóa đơn'} />
                    <div className="flex justify-between border-t pt-2 text-base font-semibold">
                        <dt>Tổng cộng</dt>
                        <dd className="tabular-nums">{formatVnd(quote.grandTotal)}</dd>
                    </div>
                    {quote.depositRequired > 0 && <Row label="Cọc yêu cầu" value={formatVnd(quote.depositRequired)} />}
                </dl>
            </CardContent>
        </Card>
    );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn('tabular-nums', muted && 'text-muted-foreground line-through')}>{value}</dd>
        </div>
    );
}

function CustomerCard({ quote }: { quote: QuoteDetail }) {
    const customer = quote.customer;
    return (
        <Card>
            <CardHeader>
                <CardTitle>Khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <Link href={`/khach-hang/${customer.id}`} className="font-medium hover:underline">
                    {customer.companyName ?? customer.fullName}
                </Link>
                {customer.taxCode && <p className="text-muted-foreground">MST {customer.taxCode}</p>}
                {customer.invoiceAddress && <p className="text-muted-foreground">{customer.invoiceAddress}</p>}
                {quote.contact && (
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Người nhận báo giá</p>
                        <p className="font-medium">
                            {quote.contact.fullName}
                            {quote.contact.position && <span className="font-normal text-muted-foreground"> · {quote.contact.position}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {[formatVnPhone(quote.contact.phone), quote.contact.email].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                )}
                <p className="border-t pt-2 text-xs text-muted-foreground">
                    Lập bởi {quote.createdBy?.fullName ?? '—'} lúc {formatDateTimeVn(quote.createdAt)}
                </p>
            </CardContent>
        </Card>
    );
}

function RevisionsCard({ quote }: { quote: QuoteDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Các phiên bản</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2 text-sm">
                    {quote.revisions.map((revision) => (
                        <li key={revision.id} className="flex items-center justify-between gap-2">
                            {revision.id === quote.id ? (
                                <span className="font-medium">Bản {revision.revision} (đang xem)</span>
                            ) : (
                                <Link href={`/bao-gia/${revision.id}`} className="hover:underline">
                                    Bản {revision.revision}
                                </Link>
                            )}
                            <span className="text-xs text-muted-foreground">
                                {QUOTE_STATUS_LABEL[revision.status]} · {formatVnd(revision.grandTotal)}
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}