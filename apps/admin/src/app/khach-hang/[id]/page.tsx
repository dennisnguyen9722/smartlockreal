'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, Pencil, Plus, Star, Trash2, User } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    CUSTOMER_SOURCE_LABEL,
    CUSTOMER_TYPE_LABEL,
    CustomerContactSchema,
    CustomerUpdateSchema,
    formatVnPhone,
    ORDER_STATUS_LABEL,
    SALES_CHANNEL_LABEL,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import {
    Dialog,
    DialogContent,
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
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ApiError } from '@/lib/api';
import type { CustomerContact, CustomerDetail, CustomerGroupOption } from '@/lib/customer-types';
import { errorText } from '@/lib/error-text';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

/** Gửi thao tác, API trả về chi tiết khách mới: cập nhật thẳng vào bộ nhớ đệm */
function useCustomerAction(customerId: string) {
    const { authFetch } = useAuth();
    const queryClient = useQueryClient();
    const [pending, setPending] = useState(false);

    async function run(
        path: string,
        method: 'POST' | 'PATCH' | 'DELETE',
        body: Record<string, unknown> | null,
        success: string,
        onFieldErrors?: (errors: Record<string, string>) => void,
    ) {
        setPending(true);
        try {
            const data = await authFetch<CustomerDetail>(path, {
                method,
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            queryClient.setQueryData(['customer', customerId], data);
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(success);
            return true;
        } catch (error) {
            const fieldErrors = apiFieldErrors(error);
            if (fieldErrors && onFieldErrors) onFieldErrors(fieldErrors);
            else toast.error(errorText(error));
            return false;
        } finally {
            setPending(false);
        }
    }
    return { run, pending };
}

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const query = useApiQuery<CustomerDetail>(['customer', id], `/customers/${id}`, { refetchOnMount: 'always' });

    const back = (
        <Link href="/khach-hang">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách khách
            </Button>
        </Link>
    );

    if (query.isPending) {
        return (
            <>
                <PageHeader title="Khách hàng" actions={back} />
                <LoadingRows rows={6} />
            </>
        );
    }
    if (query.isError) {
        const notFound =
            query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Khách hàng" actions={back} />
                {notFound ? <EmptyState message="Không tìm thấy khách hàng" action={back} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }

    const customer = query.data;
    const business = customer.type === 'BUSINESS';

    return (
        <>
            <PageHeader
                title={customer.fullName}
                description={`${CUSTOMER_TYPE_LABEL[customer.type]} · ${customer.group.name} · Nguồn: ${CUSTOMER_SOURCE_LABEL[customer.source]}`}
                actions={back}
            />

            <div className="mb-6 grid grid-cols-3 gap-3">
                <Stat label="Tổng số đơn" value={String(customer.stats.orderCount)} />
                <Stat label="Đơn đang xử lý" value={String(customer.stats.openCount)} />
                <Stat label="Đã mua (đơn hoàn tất)" value={formatVnd(customer.stats.completedTotal)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-6">
                    {business && <ContactsCard customer={customer} />}
                    <OrdersCard customer={customer} />
                </div>
                <aside className="lg:self-start">
                    <InfoCard customer={customer} />
                </aside>
            </div>
        </>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
    );
}

// ---------- Thông tin khách ----------

function InfoCard({ customer }: { customer: CustomerDetail }) {
    const { can } = useAuth();
    const canManage = can('customer.manage');
    const { run, pending } = useCustomerAction(customer.id);
    const groups = useApiQuery<CustomerGroupOption[]>(['customers', 'groups'], '/customers/groups', { staleTime: 5 * 60_000 });
    const business = customer.type === 'BUSINESS';

    const initial = {
        fullName: customer.fullName,
        phone: formatVnPhone(customer.phone),
        email: customer.email ?? '',
        companyName: customer.companyName ?? '',
        taxCode: customer.taxCode ?? '',
        invoiceAddress: customer.invoiceAddress ?? '',
        groupId: customer.group.id,
        note: customer.note ?? '',
    };
    const [values, setValues] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    useEffect(() => setValues(initial), [customer]); // eslint-disable-line react-hooks/exhaustive-deps

    const changed = (Object.keys(values) as (keyof typeof values)[]).filter((key) => values[key] !== initial[key]);

    function set(patch: Partial<typeof values>) {
        setValues((current) => ({ ...current, ...patch }));
        setErrors({});
    }

    async function save() {
        const body: Record<string, unknown> = {};
        for (const key of changed) {
            if (key === 'fullName' || key === 'groupId') body[key] = values[key].trim();
            else body[key] = values[key].trim() || null;
        }
        const parsed = CustomerUpdateSchema.safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors(parsed.error.issues));
            return;
        }
        await run(`/customers/${customer.id}`, 'PATCH', body, 'Đã lưu thông tin khách', setErrors);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {business ? <Building2 className="size-4" /> : <User className="size-4" />}
                    Thông tin
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <fieldset disabled={!canManage || pending} className="min-w-0 space-y-3">
                    {business && (
                        <>
                            <Field label="Tên công ty *" error={errors.companyName}>
                                <Input value={values.companyName} onChange={(event) => set({ companyName: event.target.value })} />
                            </Field>
                            <Field label="Mã số thuế" error={errors.taxCode}>
                                <Input
                                    value={values.taxCode}
                                    onChange={(event) => set({ taxCode: event.target.value.replace(/[^0-9-]/g, '') })}
                                    inputMode="numeric"
                                />
                            </Field>
                        </>
                    )}
                    <Field label={business ? 'Tên thường gọi *' : 'Họ tên *'} error={errors.fullName}>
                        <Input value={values.fullName} onChange={(event) => set({ fullName: event.target.value })} />
                    </Field>
                    <Field label={business ? 'Số điện thoại' : 'Số điện thoại *'} error={errors.phone}>
                        <Input value={values.phone} onChange={(event) => set({ phone: event.target.value })} inputMode="tel" />
                    </Field>
                    <Field label="Email" error={errors.email}>
                        <Input value={values.email} onChange={(event) => set({ email: event.target.value })} inputMode="email" />
                    </Field>
                    {business && (
                        <Field label="Địa chỉ trên hóa đơn" error={errors.invoiceAddress}>
                            <Input value={values.invoiceAddress} onChange={(event) => set({ invoiceAddress: event.target.value })} />
                        </Field>
                    )}
                    <Field label="Nhóm khách">
                        <select value={values.groupId} onChange={(event) => set({ groupId: event.target.value })} className={SELECT}>
                            {(groups.data ?? []).map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Ghi chú">
                        <textarea
                            value={values.note}
                            onChange={(event) => set({ note: event.target.value })}
                            rows={3}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        />
                    </Field>
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
                    Tạo lúc {formatDateTimeVn(customer.createdAt)}
                    {customer.privacyConsentAt && ` · Đồng ý chính sách dữ liệu lúc ${formatDateTimeVn(customer.privacyConsentAt)}`}
                </p>
            </CardContent>
        </Card>
    );
}

// ---------- Người liên hệ ----------

const EMPTY_CONTACT = { fullName: '', position: '', phone: '', email: '', note: '' };

function ContactsCard({ customer }: { customer: CustomerDetail }) {
    const { can } = useAuth();
    const canManage = can('customer.manage');
    const { run, pending } = useCustomerAction(customer.id);

    const [editing, setEditing] = useState<CustomerContact | 'new' | null>(null);
    const [values, setValues] = useState(EMPTY_CONTACT);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [deleting, setDeleting] = useState<CustomerContact | null>(null);

    function open(contact: CustomerContact | 'new') {
        setEditing(contact);
        setErrors({});
        setValues(
            contact === 'new'
                ? EMPTY_CONTACT
                : {
                    fullName: contact.fullName,
                    position: contact.position ?? '',
                    phone: formatVnPhone(contact.phone),
                    email: contact.email ?? '',
                    note: contact.note ?? '',
                },
        );
    }

    async function save() {
        const isNew = editing === 'new';
        const body: Record<string, unknown> = { fullName: values.fullName.trim() };
        for (const key of ['position', 'phone', 'email', 'note'] as const) {
            const value = values[key].trim();
            if (value) body[key] = value;
            else if (!isNew) body[key] = null;
        }
        if (isNew) {
            const parsed = CustomerContactSchema.safeParse(body);
            if (!parsed.success) {
                setErrors(collectFieldErrors(parsed.error.issues));
                return;
            }
        }
        const ok = await run(
            isNew ? `/customers/${customer.id}/contacts` : `/customers/contacts/${(editing as CustomerContact).id}`,
            isNew ? 'POST' : 'PATCH',
            body,
            isNew ? 'Đã thêm người liên hệ' : 'Đã lưu người liên hệ',
            setErrors,
        );
        if (ok) setEditing(null);
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Người liên hệ</CardTitle>
                {canManage && (
                    <Button size="sm" variant="outline" onClick={() => open('new')}>
                        <Plus className="size-3.5" />
                        Thêm người liên hệ
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {customer.contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có người liên hệ. Thêm người phụ trách mua hàng bên khách.</p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {customer.contacts.map((contact) => (
                            <li key={contact.id} className="flex items-start gap-3 p-3 text-sm">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                        {contact.fullName}
                                        {contact.position && <span className="font-normal text-muted-foreground"> · {contact.position}</span>}
                                        {contact.isPrimary && (
                                            <Badge variant="secondary" className="ml-2">
                                                <Star className="size-3" />
                                                Liên hệ chính
                                            </Badge>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                        {[formatVnPhone(contact.phone), contact.email].filter(Boolean).join(' · ') || 'Chưa có số điện thoại, email'}
                                    </p>
                                    {contact.note && <p className="text-xs text-muted-foreground">{contact.note}</p>}
                                </div>
                                {canManage && (
                                    <div className="flex shrink-0 gap-1">
                                        {!contact.isPrimary && (
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                disabled={pending}
                                                onClick={() =>
                                                    void run(`/customers/contacts/${contact.id}`, 'PATCH', { isPrimary: true }, 'Đã đổi liên hệ chính')
                                                }
                                            >
                                                Đặt làm chính
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon-xs" onClick={() => open(contact)} aria-label="Sửa">
                                            <Pencil />
                                        </Button>
                                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(contact)} aria-label="Xóa">
                                            <Trash2 className="text-destructive" />
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>

            <Dialog open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing === 'new' ? 'Thêm người liên hệ' : 'Sửa người liên hệ'}</DialogTitle>
                    </DialogHeader>
                    <fieldset disabled={pending} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Họ tên *" error={errors.fullName}>
                                <Input value={values.fullName} onChange={(event) => setValues({ ...values, fullName: event.target.value })} autoFocus />
                            </Field>
                            <Field label="Chức vụ" error={errors.position}>
                                <Input
                                    value={values.position}
                                    onChange={(event) => setValues({ ...values, position: event.target.value })}
                                    placeholder="Phụ trách mua hàng"
                                />
                            </Field>
                            <Field label="Số điện thoại" error={errors.phone}>
                                <Input value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} inputMode="tel" />
                            </Field>
                            <Field label="Email" error={errors.email}>
                                <Input value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} inputMode="email" />
                            </Field>
                        </div>
                        <Field label="Ghi chú">
                            <Input value={values.note} onChange={(event) => setValues({ ...values, note: event.target.value })} />
                        </Field>
                    </fieldset>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
                            Hủy
                        </Button>
                        <Button onClick={() => void save()} disabled={pending || !values.fullName.trim()}>
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(value) => !value && setDeleting(null)}
                title="Xóa người liên hệ?"
                description={
                    <>
                        Xóa <strong>{deleting?.fullName}</strong>. Báo giá đã gửi cho người này vẫn giữ nguyên.
                    </>
                }
                confirmLabel="Xóa"
                destructive
                loading={pending}
                onConfirm={() =>
                    deleting &&
                    void run(`/customers/contacts/${deleting.id}`, 'DELETE', null, 'Đã xóa người liên hệ').then(() => setDeleting(null))
                }
            />
        </Card>
    );
}

// ---------- Lịch sử đơn ----------

function OrdersCard({ customer }: { customer: CustomerDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Đơn hàng gần đây</CardTitle>
            </CardHeader>
            <CardContent>
                {customer.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Khách chưa có đơn nào.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã đơn</TableHead>
                                    <TableHead>Sản phẩm</TableHead>
                                    <TableHead className="text-right">Tổng tiền</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customer.orders.map((order) => {
                                    const first = order.lines[0];
                                    const more = order._count.lines - 1;
                                    return (
                                        <TableRow key={order.id} className={order.status === 'CANCELLED' ? 'opacity-60' : undefined}>
                                            <TableCell>
                                                <Link href={`/don-hang/${order.id}`} className="font-mono text-sm font-medium hover:underline">
                                                    {order.code}
                                                </Link>
                                                <p className="text-xs text-muted-foreground">
                                                    {SALES_CHANNEL_LABEL[order.channel]} · {formatDateTimeVn(order.placedAt)}
                                                </p>
                                            </TableCell>
                                            <TableCell className="max-w-64 text-sm">
                                                {first && (
                                                    <p className="truncate">
                                                        {first.quantity > 1 && `${first.quantity} × `}
                                                        {first.name}
                                                    </p>
                                                )}
                                                {more > 0 && <p className="text-xs text-muted-foreground">và {more} sản phẩm khác</p>}
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap tabular-nums">{formatVnd(order.grandTotal)}</TableCell>
                                            <TableCell>
                                                <Badge variant={order.status === 'COMPLETED' || order.status === 'CANCELLED' ? 'outline' : 'secondary'}>
                                                    {ORDER_STATUS_LABEL[order.status]}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            {children}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}