'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    formatVnPhone,
    normalizeVnPhone,
    OrderCreateSchema,
    type CustomerLookupResult,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { OrderLineEditor, toLineInputs, type LineDraft } from '@/components/order/order-line-editor';
import { PageHeader } from '@/components/page-header';
import { PriceInput } from '@/components/price-input';
import { errorText } from '@/lib/error-text';
import { useApiQuery } from '@/lib/hooks';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';
import { useDebounced } from '@/lib/use-debounced';

type Channel = 'ZALO' | 'STORE';
type Fulfillment = 'DELIVERY' | 'STORE_PICKUP';

const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

export default function NewOrderPage() {
    const router = useRouter();
    const { authFetch } = useAuth();

    const [channel, setChannel] = useState<Channel>('ZALO');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [fulfillment, setFulfillment] = useState<Fulfillment>('DELIVERY');
    const [address, setAddress] = useState('');
    const [locationId, setLocationId] = useState('');
    const [customerNote, setCustomerNote] = useState('');
    const [internalNote, setInternalNote] = useState('');
    const [deposit, setDeposit] = useState('');
    const [lines, setLines] = useState<LineDraft[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // Nhận ra khách cũ khi gõ xong số điện thoại hợp lệ
    const normalizedPhone = normalizeVnPhone(useDebounced(phone)) ?? '';
    const lookup = useApiQuery<CustomerLookupResult | null>(
        ['orders', 'customer-lookup', normalizedPhone],
        `/orders/customer-lookup?phone=${encodeURIComponent(normalizedPhone)}`,
        { enabled: Boolean(normalizedPhone) },
    );
    const customer = normalizedPhone ? lookup.data : null;

    const locations = useApiQuery<{ id: string; name: string; address: string }[]>(
        ['orders', 'pickup-locations'],
        '/orders/pickup-locations',
        { staleTime: 5 * 60_000 },
    );

    function clearError(key: string) {
        setErrors(({ [key]: _removed, ...rest }) => rest);
    }

    async function submit() {
        const body = {
            channel,
            fulfillmentType: fulfillment,
            customerName: name.trim(),
            customerPhone: phone,
            ...(fulfillment === 'DELIVERY' && address.trim() ? { shipAddressRaw: address.trim() } : {}),
            ...(fulfillment === 'STORE_PICKUP' && locationId ? { fulfillmentLocationId: locationId } : {}),
            ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
            ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
            ...(deposit ? { depositRequired: Number(deposit) } : {}),
            lines: toLineInputs(lines),
        };

        const parsed = OrderCreateSchema.safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors(parsed.error.issues));
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }

        setErrors({});
        setSubmitting(true);
        try {
            const order = await authFetch<{ id: string; code: string }>('/orders', { method: 'POST', body: JSON.stringify(body) });
            toast.success(`Đã tạo đơn ${order.code}`);
            router.push(`/don-hang/${order.id}`);
        } catch (error) {
            const fieldErrors = apiFieldErrors(error);
            if (fieldErrors) {
                setErrors(fieldErrors);
                toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
            } else {
                toast.error(errorText(error));
            }
            setSubmitting(false);
        }
    }

    return (
        <>
            <PageHeader
                title="Tạo đơn hàng"
                description="Khách nhắn Zalo hoặc mua tại showroom. Đơn tạo xong ở trạng thái Chờ xác nhận."
                actions={
                    <Link href="/don-hang">
                        <Button variant="outline">
                            <ArrowLeft className="size-4" />
                            Danh sách đơn
                        </Button>
                    </Link>
                }
            />

            <fieldset disabled={submitting} className="grid max-w-5xl min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Khách hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                {(
                                    [
                                        ['ZALO', 'Khách nhắn Zalo'],
                                        ['STORE', 'Khách tại showroom'],
                                    ] as const
                                ).map(([value, label]) => (
                                    <Button
                                        key={value}
                                        type="button"
                                        variant={channel === value ? 'default' : 'outline'}
                                        onClick={() => setChannel(value)}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Số điện thoại *</Label>
                                    <Input
                                        value={phone}
                                        onChange={(event) => {
                                            setPhone(event.target.value);
                                            clearError('customerPhone');
                                        }}
                                        placeholder="0901 234 567"
                                        inputMode="tel"
                                        autoFocus
                                    />
                                    {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Họ tên *</Label>
                                    <Input
                                        value={name}
                                        onChange={(event) => {
                                            setName(event.target.value);
                                            clearError('customerName');
                                        }}
                                        placeholder={customer?.fullName ?? 'Nguyễn Văn A'}
                                    />
                                    {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
                                </div>
                            </div>

                            {customer && (
                                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-600/40 bg-green-600/5 p-3 text-sm">
                                    <UserCheck className="size-4 text-green-600" />
                                    <span className="flex-1">
                                        <strong>Khách cũ:</strong> {customer.fullName} · {formatVnPhone(customer.phone)} · {customer._count.orders} đơn
                                        {customer.lastOrder && ` · gần nhất ${customer.lastOrder.code}`}
                                    </span>
                                    {!name && (
                                        <Button type="button" size="sm" variant="outline" onClick={() => setName(customer.fullName)}>
                                            Dùng tên này
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sản phẩm</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <OrderLineEditor
                                lines={lines}
                                onChange={(next) => {
                                    setLines(next);
                                    clearError('lines');
                                }}
                                error={errors.lines ?? Object.entries(errors).find(([key]) => key.startsWith('lines.'))?.[1]}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Nhận hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                {(
                                    [
                                        ['DELIVERY', 'Giao lắp tận nơi'],
                                        ['STORE_PICKUP', 'Nhận tại showroom'],
                                    ] as const
                                ).map(([value, label]) => (
                                    <Button
                                        key={value}
                                        type="button"
                                        variant={fulfillment === value ? 'default' : 'outline'}
                                        onClick={() => setFulfillment(value)}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>

                            {fulfillment === 'DELIVERY' ? (
                                <div className="space-y-1.5">
                                    <Label>Địa chỉ giao lắp *</Label>
                                    <textarea
                                        value={address}
                                        onChange={(event) => {
                                            setAddress(event.target.value);
                                            clearError('shipAddressRaw');
                                        }}
                                        rows={2}
                                        placeholder="Số nhà, đường, phường/xã, tỉnh/thành. Chuẩn hóa ở bước xác nhận."
                                        className={TEXTAREA}
                                    />
                                    {customer?.lastAddress && address !== customer.lastAddress && (
                                        <button
                                            type="button"
                                            className="text-xs text-primary hover:underline"
                                            onClick={() => setAddress(customer.lastAddress ?? '')}
                                        >
                                            Dùng địa chỉ lần trước: {customer.lastAddress}
                                        </button>
                                    )}
                                    {errors.shipAddressRaw && <p className="text-xs text-destructive">{errors.shipAddressRaw}</p>}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label>Showroom nhận hàng *</Label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {(locations.data ?? []).map((location) => (
                                            <button
                                                key={location.id}
                                                type="button"
                                                onClick={() => {
                                                    setLocationId(location.id);
                                                    clearError('fulfillmentLocationId');
                                                }}
                                                className={cn(
                                                    'rounded-lg border p-3 text-left text-sm',
                                                    locationId === location.id ? 'border-primary bg-primary/5' : 'hover:bg-muted',
                                                )}
                                            >
                                                <p className="font-medium">{location.name}</p>
                                                <p className="text-xs text-muted-foreground">{location.address}</p>
                                            </button>
                                        ))}
                                    </div>
                                    {errors.fulfillmentLocationId && (
                                        <p className="text-xs text-destructive">{errors.fulfillmentLocationId}</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <aside className="space-y-6 lg:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Thêm</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Cọc yêu cầu</Label>
                                <PriceInput value={deposit} onChange={setDeposit} placeholder="Không bắt buộc" />
                                {errors.depositRequired && <p className="text-xs text-destructive">{errors.depositRequired}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label>Khách dặn</Label>
                                <textarea
                                    value={customerNote}
                                    onChange={(event) => setCustomerNote(event.target.value)}
                                    rows={2}
                                    placeholder="Giao giờ hành chính, gọi trước khi đến..."
                                    className={TEXTAREA}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Ghi chú nội bộ</Label>
                                <textarea
                                    value={internalNote}
                                    onChange={(event) => setInternalNote(event.target.value)}
                                    rows={2}
                                    placeholder="Khách không nhìn thấy"
                                    className={TEXTAREA}
                                />
                            </div>
                            <Button className="w-full" onClick={() => void submit()} disabled={submitting}>
                                {submitting ? 'Đang tạo...' : 'Tạo đơn'}
                            </Button>
                        </CardContent>
                    </Card>
                </aside>
            </fieldset>
        </>
    );
}