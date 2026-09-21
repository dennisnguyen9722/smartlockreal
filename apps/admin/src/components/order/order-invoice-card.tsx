'use client';

import { useEffect, useState } from 'react';
import { OrderUpdateSchema } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { formatVnd } from '@/lib/format';
import type { OrderDetail } from '@/lib/order-types';
import { collectFieldErrors } from '@/lib/product-form';
import { useOrderAction } from '@/lib/use-order-action';

interface Values {
    vatInvoiceRequested: boolean;
    invoiceBuyerName: string;
    invoiceCompanyName: string;
    invoiceTaxCode: string;
    invoiceAddress: string;
    invoiceEmail: string;
}

const TEXT_KEYS = ['invoiceBuyerName', 'invoiceCompanyName', 'invoiceTaxCode', 'invoiceAddress', 'invoiceEmail'] as const;

function valuesFrom(order: OrderDetail): Values {
    return {
        vatInvoiceRequested: order.vatInvoiceRequested,
        invoiceBuyerName: order.invoiceBuyerName ?? '',
        invoiceCompanyName: order.invoiceCompanyName ?? '',
        invoiceTaxCode: order.invoiceTaxCode ?? '',
        invoiceAddress: order.invoiceAddress ?? '',
        invoiceEmail: order.invoiceEmail ?? '',
    };
}

/** VAT ước tính trên giao diện; API tính lại chính xác theo từng dòng khi lưu */
function estimateVat(order: OrderDetail): number {
    return order.lines.reduce((sum, line) => sum + Math.round((line.lineTotal * line.vatRateBps) / 10000), 0);
}

/**
 * Giá bán chưa gồm VAT. Khách lấy hóa đơn thì cộng VAT theo thuế suất từng dòng vào tổng đơn.
 */
export function OrderInvoiceCard({ order }: { order: OrderDetail }) {
    const { can } = useAuth();
    const closed = order.status === 'COMPLETED' || order.status === 'CANCELLED';
    const editable = can('order.manage') && !closed;
    const { run, pending } = useOrderAction(order);

    const [values, setValues] = useState<Values>(() => valuesFrom(order));
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Có bản mới từ máy chủ thì nạp lại form
    useEffect(() => setValues(valuesFrom(order)), [order.version]); // eslint-disable-line react-hooks/exhaustive-deps

    const initial = valuesFrom(order);
    const changed = (Object.keys(values) as (keyof Values)[]).filter((key) => values[key] !== initial[key]);

    function set(patch: Partial<Values>) {
        setValues((current) => ({ ...current, ...patch }));
        setErrors({});
    }

    function toggle(on: boolean) {
        // Bật lần đầu: gợi ý tên người mua là tên khách
        set({
            vatInvoiceRequested: on,
            ...(on && !values.invoiceBuyerName ? { invoiceBuyerName: order.customerName ?? '' } : {}),
        });
    }

    async function save() {
        const body: Record<string, unknown> = {};
        for (const key of changed) {
            if (key === 'vatInvoiceRequested') body.vatInvoiceRequested = values.vatInvoiceRequested;
            else body[key] = values[key].trim() || null;
        }
        const parsed = OrderUpdateSchema.safeParse({ expectedVersion: order.version, ...body });
        if (!parsed.success) {
            setErrors(collectFieldErrors(parsed.error.issues));
            return;
        }
        if (values.vatInvoiceRequested && !values.invoiceBuyerName.trim()) {
            setErrors({ invoiceBuyerName: 'Lấy hóa đơn thì phải có tên người mua' });
            return;
        }
        await run(`/orders/${order.id}`, 'PATCH', body, values.vatInvoiceRequested ? 'Đã lưu hóa đơn, VAT đã cộng vào tổng' : 'Đã lưu');
    }

    const vatPreview = estimateVat(order);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Hóa đơn VAT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={values.vatInvoiceRequested}
                        onChange={(event) => toggle(event.target.checked)}
                        disabled={!editable || pending}
                        className="size-4"
                    />
                    Khách lấy hóa đơn VAT
                </label>

                <p className="text-xs text-muted-foreground">
                    {values.vatInvoiceRequested
                        ? `VAT ước tính ${formatVnd(vatPreview)} (theo thuế suất từng sản phẩm) sẽ được cộng vào tổng đơn khi lưu.`
                        : 'Giá bán chưa gồm VAT. Không lấy hóa đơn thì không cộng VAT.'}
                </p>

                {values.vatInvoiceRequested && (
                    <fieldset disabled={!editable || pending} className="min-w-0 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Tên người mua *" error={errors.invoiceBuyerName}>
                                <Input value={values.invoiceBuyerName} onChange={(event) => set({ invoiceBuyerName: event.target.value })} />
                            </Field>
                            <Field label="Tên công ty" error={errors.invoiceCompanyName}>
                                <Input
                                    value={values.invoiceCompanyName}
                                    onChange={(event) => set({ invoiceCompanyName: event.target.value })}
                                    placeholder="Bỏ trống nếu khách là cá nhân"
                                />
                            </Field>
                            <Field label="Mã số thuế" error={errors.invoiceTaxCode}>
                                <Input
                                    value={values.invoiceTaxCode}
                                    onChange={(event) => set({ invoiceTaxCode: event.target.value.replace(/[^0-9-]/g, '') })}
                                    placeholder="0312345678"
                                    inputMode="numeric"
                                    className="tabular-nums"
                                />
                            </Field>
                            <Field label="Email nhận hóa đơn" error={errors.invoiceEmail}>
                                <Input
                                    value={values.invoiceEmail}
                                    onChange={(event) => set({ invoiceEmail: event.target.value })}
                                    inputMode="email"
                                />
                            </Field>
                        </div>
                        <Field label="Địa chỉ trên hóa đơn" error={errors.invoiceAddress}>
                            <Input value={values.invoiceAddress} onChange={(event) => set({ invoiceAddress: event.target.value })} />
                        </Field>
                    </fieldset>
                )}

                {editable && changed.length > 0 && (
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            {children}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}