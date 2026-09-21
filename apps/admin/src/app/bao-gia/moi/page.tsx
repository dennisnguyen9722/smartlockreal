'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { QuoteCreateSchema } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { OrderLineEditor, linesSubtotal, maxDiscountRatio, toLineInputs, type LineDraft } from '@/components/order/order-line-editor';
import { PageHeader } from '@/components/page-header';
import { PriceInput } from '@/components/price-input';
import { CustomerPicker, type PickedCustomer } from '@/components/quote/customer-picker';
import type { CustomerDetail } from '@/lib/customer-types';
import { errorText } from '@/lib/error-text';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';
import { DEFAULT_QUOTE_TERMS } from '@/lib/quote-types';

const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

export default function NewQuotePage() {
    const router = useRouter();
    const { authFetch } = useAuth();

    const [customer, setCustomer] = useState<PickedCustomer | null>(null);
    const [contactId, setContactId] = useState('');
    const [projectName, setProjectName] = useState('');
    const [siteAddress, setSiteAddress] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [vat, setVat] = useState(true);
    const [shippingFee, setShippingFee] = useState('');
    const [deposit, setDeposit] = useState('');
    const [terms, setTerms] = useState(DEFAULT_QUOTE_TERMS);
    const [internalNote, setInternalNote] = useState('');
    const [lines, setLines] = useState<LineDraft[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // Người liên hệ của khách đã chọn
    const detail = useApiQuery<CustomerDetail>(['customer', customer?.id], `/customers/${customer?.id}`, {
        enabled: Boolean(customer),
    });
    const contacts = customer ? (detail.data?.contacts ?? []) : [];

    const subtotal = linesSubtotal(lines);
    const reference = lines.reduce((sum, line) => sum + line.listPrice * line.quantity, 0);
    const maxDiscount = maxDiscountRatio(lines);

    async function submit() {
        const primary = contacts.find((contact) => contact.isPrimary);
        const body = {
            customerId: customer?.id ?? '',
            ...((contactId || primary?.id) ? { contactId: contactId || primary?.id } : {}),
            ...(projectName.trim() ? { projectName: projectName.trim() } : {}),
            ...(siteAddress.trim() ? { siteAddress: siteAddress.trim() } : {}),
            ...(validUntil ? { validUntil } : {}),
            vatInvoiceRequested: vat,
            shippingFee: Number(shippingFee || 0),
            depositRequired: Number(deposit || 0),
            ...(terms.trim() ? { terms: terms.trim() } : {}),
            ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
            lines: toLineInputs(lines),
        };
        const parsed = QuoteCreateSchema.safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors(parsed.error.issues));
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }

        setErrors({});
        setSubmitting(true);
        try {
            const quote = await authFetch<{ id: string; code: string }>('/quotes', { method: 'POST', body: JSON.stringify(body) });
            toast.success(`Đã lập báo giá ${quote.code}`);
            router.push(`/bao-gia/${quote.id}`);
        } catch (error) {
            const fieldErrors = apiFieldErrors(error);
            if (fieldErrors) setErrors(fieldErrors);
            toast.error(fieldErrors ? 'Dữ liệu chưa hợp lệ, xem các ô báo đỏ' : errorText(error));
            setSubmitting(false);
        }
    }

    return (
        <>
            <PageHeader
                title="Lập báo giá công trình"
                description="Báo giá lưu ở trạng thái Nháp, sửa thoải mái trước khi gửi khách"
                actions={
                    <Link href="/bao-gia">
                        <Button variant="outline">
                            <ArrowLeft className="size-4" />
                            Danh sách báo giá
                        </Button>
                    </Link>
                }
            />

            <fieldset disabled={submitting} className="grid max-w-6xl min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Khách hàng và công trình</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <CustomerPicker
                                value={customer}
                                onChange={(next) => {
                                    setCustomer(next);
                                    setContactId('');
                                    setErrors({});
                                }}
                                error={errors.customerId}
                            />
                            {customer && contacts.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label>Người nhận báo giá</Label>
                                    <select
                                        value={contactId || contacts.find((contact) => contact.isPrimary)?.id || ''}
                                        onChange={(event) => setContactId(event.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                    >
                                        {contacts.map((contact) => (
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
                                    <Input
                                        value={projectName}
                                        onChange={(event) => setProjectName(event.target.value)}
                                        placeholder="Chung cư ABC Tower - Block A"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Hiệu lực đến</Label>
                                    <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                                    <p className="text-xs text-muted-foreground">Bỏ trống = 15 ngày kể từ hôm nay</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Địa chỉ công trình</Label>
                                <Input value={siteAddress} onChange={(event) => setSiteAddress(event.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sản phẩm và giá báo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <OrderLineEditor
                                lines={lines}
                                onChange={setLines}
                                showDiscount
                                priceLabel="Giá lẻ"
                                error={errors.lines ?? Object.entries(errors).find(([key]) => key.startsWith('lines.'))?.[1]}
                            />
                            {maxDiscount > 0.1 && (
                                <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                    Có dòng giảm quá ngưỡng (mặc định 10%): báo giá cần quản trị duyệt trước khi gửi khách.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Điều khoản</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={6} className={TEXTAREA} />
                        </CardContent>
                    </Card>
                </div>

                <aside className="space-y-6 lg:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tổng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={vat} onChange={(event) => setVat(event.target.checked)} className="size-4" />
                                Khách lấy hóa đơn VAT
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Phí vận chuyển</Label>
                                    <PriceInput value={shippingFee} onChange={setShippingFee} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Cọc yêu cầu</Label>
                                    <PriceInput value={deposit} onChange={setDeposit} />
                                    {errors.depositRequired && <p className="text-xs text-destructive">{errors.depositRequired}</p>}
                                </div>
                            </div>
                            <dl className="space-y-1 border-t pt-3 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">Theo giá lẻ</dt>
                                    <dd className="tabular-nums line-through">{formatVnd(reference)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">Tạm tính (chưa VAT)</dt>
                                    <dd className="tabular-nums">{formatVnd(subtotal)}</dd>
                                </div>
                                {reference > subtotal && (
                                    <div className="flex justify-between text-green-700">
                                        <dt>Tiết kiệm</dt>
                                        <dd className="tabular-nums">{formatVnd(reference - subtotal)}</dd>
                                    </div>
                                )}
                                <p className="pt-1 text-xs text-muted-foreground">VAT và tổng cuối được tính chính xác khi lưu.</p>
                            </dl>
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
                                {submitting ? 'Đang lưu...' : 'Lưu báo giá (Nháp)'}
                            </Button>
                        </CardContent>
                    </Card>
                </aside>
            </fieldset>
        </>
    );
}