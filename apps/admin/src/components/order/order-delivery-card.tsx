'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { formatVnPhone, normalizeVnPhone } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { useApiQuery } from '@/lib/hooks';
import { fromLocalInput, toLocalInput, type OrderDetail } from '@/lib/order-types';
import { useOrderAction } from '@/lib/use-order-action';

interface GeoUnit {
    code: string;
    name: string;
}

interface Values {
    shipRecipientName: string;
    shipRecipientPhone: string;
    shipProvinceCode: string;
    shipWardCode: string;
    shipStreet: string;
    scheduledAt: string;
    brandOrderRef: string;
    brandTechnicianNote: string;
}

function valuesFrom(order: OrderDetail): Values {
    return {
        shipRecipientName: order.shipRecipientName ?? '',
        shipRecipientPhone: formatVnPhone(order.shipRecipientPhone),
        shipProvinceCode: order.shipProvinceCode ?? '',
        shipWardCode: order.shipWardCode ?? '',
        shipStreet: order.shipStreet ?? '',
        scheduledAt: toLocalInput(order.scheduledAt),
        brandOrderRef: order.brandOrderRef ?? '',
        brandTechnicianNote: order.brandTechnicianNote ?? '',
    };
}

const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50';
const TEXT = (value: string) => value.trim() || null;

export function OrderDeliveryCard({ order }: { order: OrderDetail }) {
    const { can } = useAuth();
    const closed = order.status === 'COMPLETED' || order.status === 'CANCELLED';
    const editable = can('order.manage') && !closed;
    const { run, pending } = useOrderAction(order);

    const [values, setValues] = useState<Values>(() => valuesFrom(order));
    const [phoneError, setPhoneError] = useState('');
    // Có bản mới từ máy chủ (vd: vừa đổi trạng thái) thì nạp lại form
    useEffect(() => setValues(valuesFrom(order)), [order.version]); // eslint-disable-line react-hooks/exhaustive-deps

    const provinces = useApiQuery<GeoUnit[]>(['geo', 'provinces'], '/geo/provinces', { staleTime: Infinity });
    const wards = useApiQuery<GeoUnit[]>(
        ['geo', 'wards', values.shipProvinceCode],
        `/geo/provinces/${values.shipProvinceCode}/wards`,
        { enabled: Boolean(values.shipProvinceCode), staleTime: Infinity },
    );

    const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));
    const initial = valuesFrom(order);
    const changedKeys = (Object.keys(values) as (keyof Values)[]).filter((key) => values[key] !== initial[key]);
    const dirty = changedKeys.length > 0;

    async function save() {
        const body: Record<string, unknown> = {};
        for (const key of changedKeys) {
            if (key === 'shipRecipientPhone') {
                if (!values.shipRecipientPhone.trim()) body.shipRecipientPhone = null;
                else if (!normalizeVnPhone(values.shipRecipientPhone)) {
                    setPhoneError('Số điện thoại không hợp lệ');
                    return;
                } else body.shipRecipientPhone = values.shipRecipientPhone;
            } else if (key === 'scheduledAt') {
                body.scheduledAt = fromLocalInput(values.scheduledAt);
            } else {
                body[key] = TEXT(values[key]);
            }
        }
        setPhoneError('');
        await run(`/orders/${order.id}`, 'PATCH', body, 'Đã lưu thông tin giao lắp');
    }

    const delivery = order.fulfillmentType === 'DELIVERY';

    return (
        <Card>
            <CardHeader>
                <CardTitle>{delivery ? 'Giao lắp tận nơi' : 'Nhận tại showroom'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {delivery && order.shipAddressRaw && (
                    <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                            <span className="text-muted-foreground">Khách ghi: </span>
                            {order.shipAddressRaw}
                        </span>
                    </p>
                )}

                {!delivery && order.fulfillmentLocation && (
                    <p className="text-sm">
                        <strong>{order.fulfillmentLocation.name}</strong>
                        <span className="text-muted-foreground"> · {order.fulfillmentLocation.address}</span>
                    </p>
                )}

                <fieldset disabled={!editable || pending} className="min-w-0 space-y-4">
                    {delivery && (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Người nhận</Label>
                                    <Input value={values.shipRecipientName} onChange={(event) => set({ shipRecipientName: event.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Số điện thoại người nhận</Label>
                                    <Input
                                        value={values.shipRecipientPhone}
                                        onChange={(event) => {
                                            set({ shipRecipientPhone: event.target.value });
                                            setPhoneError('');
                                        }}
                                        inputMode="tel"
                                    />
                                    {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tỉnh/Thành phố</Label>
                                    <select
                                        value={values.shipProvinceCode}
                                        onChange={(event) => set({ shipProvinceCode: event.target.value, shipWardCode: '' })}
                                        className={SELECT}
                                    >
                                        <option value="">— Chọn tỉnh/thành —</option>
                                        {(provinces.data ?? []).map((province) => (
                                            <option key={province.code} value={province.code}>
                                                {province.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Phường/Xã</Label>
                                    <select
                                        value={values.shipWardCode}
                                        onChange={(event) => set({ shipWardCode: event.target.value })}
                                        disabled={!values.shipProvinceCode || wards.isPending}
                                        className={SELECT}
                                    >
                                        <option value="">{wards.isFetching ? 'Đang tải...' : '— Chọn phường/xã —'}</option>
                                        {(wards.data ?? []).map((ward) => (
                                            <option key={ward.code} value={ward.code}>
                                                {ward.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Số nhà, tên đường</Label>
                                <Input
                                    value={values.shipStreet}
                                    onChange={(event) => set({ shipStreet: event.target.value })}
                                    placeholder="12 Lê Lợi"
                                />
                            </div>
                        </>
                    )}

                    <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Hẹn giao lắp</Label>
                            <Input
                                type="datetime-local"
                                value={values.scheduledAt}
                                onChange={(event) => set({ scheduledAt: event.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mã đơn bên hãng</Label>
                            <Input value={values.brandOrderRef} onChange={(event) => set({ brandOrderRef: event.target.value })} maxLength={100} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Kỹ thuật viên của hãng</Label>
                        <textarea
                            value={values.brandTechnicianNote}
                            onChange={(event) => set({ brandTechnicianNote: event.target.value })}
                            rows={2}
                            placeholder="Tên, số điện thoại kỹ thuật viên, ghi chú lắp đặt..."
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                </fieldset>

                {editable && dirty && (
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