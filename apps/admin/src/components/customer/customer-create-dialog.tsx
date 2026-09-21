'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CUSTOMER_SOURCE_LABEL, CustomerCreateSchema, type CustomerTypeValue } from '@ktm/shared';
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
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import type { CustomerGroupOption } from '@/lib/customer-types';
import { errorText } from '@/lib/error-text';
import { useApiQuery } from '@/lib/hooks';
import { collectFieldErrors } from '@/lib/product-form';

const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

/** Component gắn/gỡ theo lúc mở/đóng: mỗi lần mở là form trống */
export function CustomerCreateDialog({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const { authFetch } = useAuth();
    const groups = useApiQuery<CustomerGroupOption[]>(['customers', 'groups'], '/customers/groups', { staleTime: 5 * 60_000 });

    const [type, setType] = useState<CustomerTypeValue>('BUSINESS');
    const [values, setValues] = useState({
        fullName: '',
        companyName: '',
        phone: '',
        email: '',
        taxCode: '',
        invoiceAddress: '',
        groupId: '',
        source: 'OTHER',
        note: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [existingId, setExistingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const business = type === 'BUSINESS';
    // Khách doanh nghiệp: gợi ý nhóm Khách công trình
    const groupId = values.groupId || (business ? groups.data?.find((group) => group.code === 'PROJECT')?.id : '') || '';

    function set(patch: Partial<typeof values>) {
        setValues((current) => ({ ...current, ...patch }));
        setErrors({});
        setExistingId(null);
    }

    async function submit() {
        const body: Record<string, unknown> = {
            type,
            // Doanh nghiệp để trống tên thường gọi thì dùng tên công ty
            fullName: (values.fullName.trim() || (business ? values.companyName.trim() : '')) || undefined,
            source: values.source,
        };
        for (const key of ['phone', 'email', 'note'] as const) {
            if (values[key].trim()) body[key] = values[key].trim();
        }
        if (business) {
            for (const key of ['companyName', 'taxCode', 'invoiceAddress'] as const) {
                if (values[key].trim()) body[key] = values[key].trim();
            }
        }
        if (groupId) body.groupId = groupId;

        const parsed = CustomerCreateSchema.safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors(parsed.error.issues));
            return;
        }

        setSubmitting(true);
        try {
            const customer = await authFetch<{ id: string }>('/customers', { method: 'POST', body: JSON.stringify(body) });
            toast.success('Đã thêm khách hàng');
            router.push(`/khach-hang/${customer.id}`);
        } catch (error) {
            // Trùng SĐT hoặc MST: chỉ ra khách đã có để mở xem
            if (error instanceof ApiError && Array.isArray(error.details)) {
                const detail = (error.details as { field: string; message: string; customerId?: string }[])[0];
                if (detail) {
                    setErrors({ [detail.field]: detail.message });
                    setExistingId(detail.customerId ?? null);
                    setSubmitting(false);
                    return;
                }
            }
            toast.error(errorText(error));
            setSubmitting(false);
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Thêm khách hàng</DialogTitle>
                    <DialogDescription>
                        Khách lẻ đặt hàng sẽ tự được tạo theo số điện thoại. Thêm tay chủ yếu cho khách công trình.
                    </DialogDescription>
                </DialogHeader>

                <fieldset disabled={submitting} className="min-w-0 space-y-4">
                    <div className="flex gap-2">
                        {(
                            [
                                ['BUSINESS', 'Doanh nghiệp / công trình'],
                                ['INDIVIDUAL', 'Cá nhân'],
                            ] as const
                        ).map(([value, label]) => (
                            <Button key={value} type="button" variant={type === value ? 'default' : 'outline'} onClick={() => setType(value)}>
                                {label}
                            </Button>
                        ))}
                    </div>

                    {business && (
                        <>
                            <Field label="Tên công ty *" error={errors.companyName}>
                                <Input
                                    value={values.companyName}
                                    onChange={(event) => set({ companyName: event.target.value })}
                                    placeholder="Công ty CP Xây dựng ABC"
                                    autoFocus
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Mã số thuế" error={errors.taxCode}>
                                    <Input
                                        value={values.taxCode}
                                        onChange={(event) => set({ taxCode: event.target.value.replace(/[^0-9-]/g, '') })}
                                        inputMode="numeric"
                                    />
                                </Field>
                                <Field label="Tên thường gọi" error={errors.fullName}>
                                    <Input
                                        value={values.fullName}
                                        onChange={(event) => set({ fullName: event.target.value })}
                                        placeholder="Bỏ trống = tên công ty"
                                    />
                                </Field>
                            </div>
                            <Field label="Địa chỉ trên hóa đơn" error={errors.invoiceAddress}>
                                <Input value={values.invoiceAddress} onChange={(event) => set({ invoiceAddress: event.target.value })} />
                            </Field>
                        </>
                    )}

                    {!business && (
                        <Field label="Họ tên *" error={errors.fullName}>
                            <Input value={values.fullName} onChange={(event) => set({ fullName: event.target.value })} autoFocus />
                        </Field>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Field label={business ? 'Số điện thoại' : 'Số điện thoại *'} error={errors.phone}>
                            <Input value={values.phone} onChange={(event) => set({ phone: event.target.value })} inputMode="tel" />
                        </Field>
                        <Field label="Email" error={errors.email}>
                            <Input value={values.email} onChange={(event) => set({ email: event.target.value })} inputMode="email" />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Nhóm khách">
                            <select value={groupId} onChange={(event) => set({ groupId: event.target.value })} className={SELECT}>
                                <option value="">Mặc định</option>
                                {(groups.data ?? []).map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Nguồn khách">
                            <select value={values.source} onChange={(event) => set({ source: event.target.value })} className={SELECT}>
                                {Object.entries(CUSTOMER_SOURCE_LABEL).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {existingId && (
                        <Button type="button" variant="outline" className="w-full" onClick={() => router.push(`/khach-hang/${existingId}`)}>
                            Mở khách đã có
                        </Button>
                    )}
                </fieldset>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Hủy
                    </Button>
                    <Button onClick={() => void submit()} disabled={submitting}>
                        {submitting ? 'Đang lưu...' : 'Thêm khách'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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