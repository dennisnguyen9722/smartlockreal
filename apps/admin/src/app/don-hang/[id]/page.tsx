'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, Pencil, Phone } from 'lucide-react';
import {
    formatVnPhone,
    FULFILLMENT_TYPE_LABEL,
    ORDER_LINES_EDITABLE_STATUSES,
    ORDER_STATUS_LABEL,
    SALES_CHANNEL_LABEL,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Label } from '@ktm/ui/components/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ktm/ui/components/table';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { LineSerialEditor } from '@/components/order/line-serial-editor';
import { OrderDeliveryCard } from '@/components/order/order-delivery-card';
import { OrderInvoiceCard } from '@/components/order/order-invoice-card';
import { OrderLineEditor, toLineInputs, type LineDraft } from '@/components/order/order-line-editor';
import { OrderPaymentsCard } from '@/components/order/order-payments-card';
import { OrderStatusBar } from '@/components/order/order-status-bar';
import { PageHeader } from '@/components/page-header';
import { PriceInput } from '@/components/price-input';
import { ApiError } from '@/lib/api';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn, type OrderDetail } from '@/lib/order-types';
import { useOrderAction } from '@/lib/use-order-action';

export default function OrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const query = useApiQuery<OrderDetail>(['order', id], `/orders/${id}`, { refetchOnMount: 'always' });

    const back = (
        <Link href="/don-hang">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách đơn
            </Button>
        </Link>
    );

    if (query.isPending) {
        return (
            <>
                <PageHeader title="Chi tiết đơn hàng" actions={back} />
                <LoadingRows rows={6} />
            </>
        );
    }
    if (query.isError) {
        const notFound =
            query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Chi tiết đơn hàng" actions={back} />
                {notFound ? <EmptyState message="Không tìm thấy đơn hàng" action={back} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }

    const order = query.data;

    return (
        <>
            <PageHeader
                title={`Đơn ${order.code}`}
                description={`${SALES_CHANNEL_LABEL[order.channel]} · ${FULFILLMENT_TYPE_LABEL[order.fulfillmentType]} · Đặt lúc ${formatDateTimeVn(order.placedAt)}`}
                actions={back}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-6">
                    <OrderStatusBar order={order} />
                    <OrderLinesCard order={order} />
                    <OrderDeliveryCard order={order} />
                    <OrderInvoiceCard order={order} />
                    <OrderPaymentsCard order={order} />
                    <OrderHistoryCard order={order} />
                </div>

                <aside className="space-y-6 lg:self-start">
                    <CustomerCard order={order} />
                    <InternalCard order={order} />
                </aside>
            </div>
        </>
    );
}

const SERIAL_STATUSES: readonly string[] = ['GOODS_ARRIVED', 'FULFILLING', 'COMPLETED'];

function draftsFrom(order: OrderDetail): LineDraft[] {
    return order.lines
        .filter((line) => line.variantId)
        .map((line) => ({
            key: line.id,
            variantId: line.variantId as string,
            name: line.name,
            sku: line.sku ?? '',
            listPrice: line.listPrice,
            quantity: line.quantity,
            unitPrice: String(line.unitPrice),
            // Giữ đúng giá đã chốt với khách dù giá niêm yết đã đổi
            keepPrice: true,
        }));
}

function OrderLinesCard({ order }: { order: OrderDetail }) {
    const { can } = useAuth();
    const { run, pending } = useOrderAction(order);
    const [editing, setEditing] = useState(false);
    const [drafts, setDrafts] = useState<LineDraft[]>([]);
    const canManage = can('order.manage');
    const editable = canManage && ORDER_LINES_EDITABLE_STATUSES.includes(order.status);
    // Từ lúc hàng về mới có máy để ghi serial; hoàn tất rồi vẫn ghi bổ sung được
    const serialOpen = SERIAL_STATUSES.includes(order.status);

    async function save() {
        const result = await run(`/orders/${order.id}/lines`, 'PUT', { lines: toLineInputs(drafts) }, 'Đã cập nhật sản phẩm');
        if (result) setEditing(false);
    }

    if (editing) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sửa sản phẩm</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <OrderLineEditor lines={drafts} onChange={setDrafts} disabled={pending} />
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
                <CardTitle>Sản phẩm</CardTitle>
                {editable && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDrafts(draftsFrom(order));
                            setEditing(true);
                        }}
                    >
                        <Pencil className="size-3.5" />
                        Sửa sản phẩm
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sản phẩm</TableHead>
                                <TableHead className="text-center">SL</TableHead>
                                <TableHead className="text-right">Đơn giá</TableHead>
                                <TableHead className="text-right">Thành tiền</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.lines.map((line) => (
                                <TableRow key={line.id}>
                                    <TableCell>
                                        <p className="font-medium">{line.name}</p>
                                        <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                                        {serialOpen ? (
                                            <LineSerialEditor order={order} line={line} editable={canManage} />
                                        ) : (
                                            line.serialNumbers &&
                                            line.serialNumbers.length > 0 && (
                                                <p className="text-xs text-muted-foreground">Serial: {line.serialNumbers.join(', ')}</p>
                                            )
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums">{line.quantity}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                                        {formatVnd(line.unitPrice)}
                                        {line.unitPrice !== line.listPrice && (
                                            <p className="text-xs text-muted-foreground line-through">{formatVnd(line.listPrice)}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                                        {formatVnd(line.lineTotal)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <dl className="ml-auto max-w-xs space-y-1 text-sm">
                    <Row label="Tạm tính (chưa VAT)" value={formatVnd(order.subtotal)} />
                    {order.discountTotal > 0 && <Row label="Giảm giá" value={`−${formatVnd(order.discountTotal)}`} />}
                    {order.shippingFee > 0 && <Row label="Phí giao hàng" value={formatVnd(order.shippingFee)} />}
                    <Row
                        label={order.vatInvoiceRequested ? 'VAT (khách lấy hóa đơn)' : 'VAT'}
                        value={order.vatInvoiceRequested ? formatVnd(order.vatTotal) : 'Không lấy hóa đơn'}
                    />
                    <div className="flex justify-between border-t pt-2 text-base font-semibold">
                        <dt>Tổng cộng</dt>
                        <dd className="tabular-nums">{formatVnd(order.grandTotal)}</dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
        </div>
    );
}

function CustomerCard({ order }: { order: OrderDetail }) {
    const phone = order.customerPhone;
    const localPhone = phone ? `0${phone.slice(3)}` : '';
    return (
        <Card>
            <CardHeader>
                <CardTitle>Khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="tabular-nums text-muted-foreground">{formatVnPhone(phone)}</p>
                    {order.customer && order.customer._count.orders > 1 && (
                        <p className="text-xs text-muted-foreground">Khách cũ: {order.customer._count.orders} đơn</p>
                    )}
                </div>
                {phone && (
                    <div className="flex gap-2">
                        <a href={`tel:${phone}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                                <Phone className="size-4" />
                                Gọi
                            </Button>
                        </a>
                        <a href={`https://zalo.me/${localPhone}`} target="_blank" rel="noreferrer" className="flex-1">
                            <Button variant="outline" className="w-full">
                                <MessageCircle className="size-4" />
                                Zalo
                            </Button>
                        </a>
                    </div>
                )}
                {order.customerNote && (
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Khách ghi chú</p>
                        <p>{order.customerNote}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function InternalCard({ order }: { order: OrderDetail }) {
    const { can } = useAuth();
    const closed = order.status === 'COMPLETED' || order.status === 'CANCELLED';
    const canManage = can('order.manage');
    const { run, pending } = useOrderAction(order);
    const assignees = useApiQuery<{ id: string; fullName: string }[]>(['orders', 'assignees'], '/orders/assignees', {
        staleTime: 5 * 60_000,
    });

    const initial = {
        assignedStaffId: order.assignedStaff?.id ?? '',
        depositRequired: String(order.depositRequired),
        shippingFee: String(order.shippingFee),
        internalNote: order.internalNote ?? '',
    };
    const [values, setValues] = useState(initial);
    // Có bản mới từ máy chủ thì nạp lại form
    useEffect(() => setValues(initial), [order.version]); // eslint-disable-line react-hooks/exhaustive-deps

    const changed = (Object.keys(values) as (keyof typeof values)[]).filter((key) => values[key] !== initial[key]);

    async function save() {
        const body: Record<string, unknown> = {};
        for (const key of changed) {
            if (key === 'assignedStaffId') body.assignedStaffId = values.assignedStaffId || null;
            else if (key === 'internalNote') body.internalNote = values.internalNote.trim() || null;
            else body[key] = Number(values[key] || 0);
        }
        await run(`/orders/${order.id}`, 'PATCH', body, 'Đã lưu');
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Nội bộ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <fieldset disabled={!canManage || pending} className="min-w-0 space-y-4">
                    <div className="space-y-1.5">
                        <Label>Nhân viên phụ trách</Label>
                        <select
                            value={values.assignedStaffId}
                            onChange={(event) => setValues({ ...values, assignedStaffId: event.target.value })}
                            disabled={closed}
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                            <option value="">— Chưa có —</option>
                            {(assignees.data ?? []).map((staff) => (
                                <option key={staff.id} value={staff.id}>
                                    {staff.fullName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Cọc yêu cầu</Label>
                            <PriceInput
                                value={values.depositRequired}
                                onChange={(depositRequired) => setValues({ ...values, depositRequired })}
                                disabled={closed}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phí giao hàng</Label>
                            <PriceInput
                                value={values.shippingFee}
                                onChange={(shippingFee) => setValues({ ...values, shippingFee })}
                                disabled={closed}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Ghi chú nội bộ</Label>
                        <textarea
                            value={values.internalNote}
                            onChange={(event) => setValues({ ...values, internalNote: event.target.value })}
                            rows={3}
                            placeholder="Khách không nhìn thấy ghi chú này"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                </fieldset>
                {canManage && changed.length > 0 && (
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setValues(initial)} disabled={pending}>
                            Hủy
                        </Button>
                        <Button size="sm" onClick={() => void save()} disabled={pending}>
                            Lưu
                        </Button>
                    </div>
                )}
                <p className="border-t pt-3 text-xs text-muted-foreground">
                    Tạo bởi {order.createdBy?.fullName ?? 'khách trên website'}
                </p>
            </CardContent>
        </Card>
    );
}

function OrderHistoryCard({ order }: { order: OrderDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Lịch sử</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="space-y-3 border-l pl-4">
                    {order.statusHistory.map((entry) => (
                        <li key={entry.id} className="relative text-sm">
                            <span className="absolute top-1.5 -left-5.25 size-2.5 rounded-full border-2 border-background bg-primary" />
                            <p>
                                <Badge variant="secondary">{ORDER_STATUS_LABEL[entry.toStatus]}</Badge>
                                {entry.note && <span className="ml-2">{entry.note}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formatDateTimeVn(entry.createdAt)} · {entry.staff?.fullName ?? 'Khách'}
                            </p>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}