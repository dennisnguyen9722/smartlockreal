'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { formatVnPhone, type CompanyInfo } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { ErrorState, LoadingRows } from '@/components/data-states';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import type { QuoteDetail } from '@/lib/quote-types';
import { vndToWords } from '@/lib/vn-number-words';

function formatDate(value: string): string {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN');
}

/**
 * Báo giá khổ A4 để in hoặc lưu PDF (In → "Lưu thành PDF" của trình duyệt).
 * Luôn dùng thông tin công ty mới nhất trong Cấu hình.
 */
export default function QuotePrintPage() {
    const { id } = useParams<{ id: string }>();
    const query = useApiQuery<{ quote: QuoteDetail; company: CompanyInfo }>(['quote', id, 'print'], `/quotes/${id}/print`, {
        refetchOnMount: 'always',
    });

    if (query.isPending) return <LoadingRows rows={8} />;
    if (query.isError) return <ErrorState message={query.error.message} />;

    const { quote, company } = query.data;
    const customer = quote.customer;
    const draft = quote.status === 'DRAFT' || quote.status === 'PENDING_APPROVAL';

    return (
        <>
            {/* Khổ giấy A4, lề in; ẩn nền xám của trang khi in */}
            <style>{`@page { size: A4; margin: 14mm 12mm; } @media print { body { background: white !important; } }`}</style>

            <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
                <Link href={`/bao-gia/${quote.id}`}>
                    <Button variant="outline">
                        <ArrowLeft className="size-4" />
                        Về báo giá
                    </Button>
                </Link>
                <Button onClick={() => window.print()}>
                    <Printer className="size-4" />
                    In / Lưu PDF
                </Button>
                <p className="text-sm text-muted-foreground">
                    Lưu PDF: bấm In, chọn máy in <strong>"Lưu thành PDF"</strong>, tắt "Đầu trang và chân trang".
                </p>
            </div>

            <article className="mx-auto max-w-[210mm] bg-white p-8 text-[13px] leading-relaxed text-black shadow print:max-w-none print:p-0 print:shadow-none">
                {draft && (
                    <p className="mb-4 rounded border border-dashed border-black/40 p-2 text-center text-xs font-semibold uppercase">
                        Bản nháp: chưa phải báo giá chính thức
                    </p>
                )}

                {/* Công ty */}
                <header className="flex items-start gap-4 border-b-2 border-black pb-3">
                    {company.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- ảnh do quản trị tải lên
                        <img src={company.logoUrl} alt="" className="h-16 w-auto object-contain" />
                    )}
                    <div className="flex-1">
                        <p className="text-base font-bold uppercase">{company.name}</p>
                        {company.address && <p>Địa chỉ: {company.address}</p>}
                        <p>
                            {[company.taxCode && `MST: ${company.taxCode}`, company.hotline && `Hotline: ${company.hotline}`]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                        <p>{[company.email, company.website].filter(Boolean).join(' · ')}</p>
                    </div>
                </header>

                {/* Tiêu đề */}
                <section className="my-5 text-center">
                    <h1 className="text-xl font-bold uppercase">Báo giá</h1>
                    <p>
                        Số: <strong>{quote.code}</strong>
                        {quote.revision > 1 && ` (bản ${quote.revision})`} · Ngày lập: {formatDate(quote.createdAt)} · Hiệu lực đến:{' '}
                        <strong>{formatDate(quote.validUntil)}</strong>
                    </p>
                </section>

                {/* Khách hàng */}
                <section className="mb-4 grid grid-cols-[8rem_1fr] gap-x-2 gap-y-0.5">
                    <span>Kính gửi:</span>
                    <strong>{customer.companyName ?? customer.fullName}</strong>
                    {customer.taxCode && (
                        <>
                            <span>Mã số thuế:</span>
                            <span>{customer.taxCode}</span>
                        </>
                    )}
                    {customer.invoiceAddress && (
                        <>
                            <span>Địa chỉ:</span>
                            <span>{customer.invoiceAddress}</span>
                        </>
                    )}
                    {quote.contact && (
                        <>
                            <span>Người nhận:</span>
                            <span>
                                {quote.contact.fullName}
                                {quote.contact.position && ` (${quote.contact.position})`}
                                {quote.contact.phone && ` · ${formatVnPhone(quote.contact.phone)}`}
                            </span>
                        </>
                    )}
                    {quote.projectName && (
                        <>
                            <span>Công trình:</span>
                            <span>{quote.projectName}</span>
                        </>
                    )}
                    {quote.siteAddress && (
                        <>
                            <span>Địa điểm:</span>
                            <span>{quote.siteAddress}</span>
                        </>
                    )}
                </section>

                <p className="mb-2">
                    {company.brandName || company.name} trân trọng gửi Quý khách báo giá các sản phẩm như sau:
                </p>

                {/* Bảng giá */}
                <table className="w-full border-collapse text-[12px]">
                    <thead>
                        <tr className="bg-black/5">
                            <th className="border border-black/40 px-1.5 py-1 text-center">STT</th>
                            <th className="border border-black/40 px-1.5 py-1 text-left">Sản phẩm</th>
                            <th className="border border-black/40 px-1.5 py-1 text-center">SL</th>
                            <th className="border border-black/40 px-1.5 py-1 text-right">Giá niêm yết</th>
                            <th className="border border-black/40 px-1.5 py-1 text-right">Đơn giá báo</th>
                            <th className="border border-black/40 px-1.5 py-1 text-right">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quote.lines.map((line, index) => (
                            <tr key={line.id} className="break-inside-avoid">
                                <td className="border border-black/40 px-1.5 py-1 text-center align-top">{index + 1}</td>
                                <td className="border border-black/40 px-1.5 py-1 align-top">
                                    {line.name}
                                    {line.sku && <div className="text-[11px] text-black/60">Mã: {line.sku}</div>}
                                </td>
                                <td className="border border-black/40 px-1.5 py-1 text-center align-top tabular-nums">{line.quantity}</td>
                                <td className="border border-black/40 px-1.5 py-1 text-right align-top tabular-nums">
                                    {line.referencePrice > line.unitPrice ? (
                                        <span className="text-black/60 line-through">{formatVnd(line.referencePrice)}</span>
                                    ) : (
                                        formatVnd(line.referencePrice)
                                    )}
                                </td>
                                <td className="border border-black/40 px-1.5 py-1 text-right align-top tabular-nums">{formatVnd(line.unitPrice)}</td>
                                <td className="border border-black/40 px-1.5 py-1 text-right align-top font-medium tabular-nums">
                                    {formatVnd(line.lineTotal)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Tổng */}
                <section className="mt-3 ml-auto w-80 break-inside-avoid space-y-0.5">
                    <TotalRow label="Cộng tiền hàng (chưa VAT)" value={formatVnd(quote.subtotal)} />
                    {quote.savings > 0 && <TotalRow label="Tiết kiệm so với giá niêm yết" value={formatVnd(quote.savings)} />}
                    {quote.shippingFee > 0 && <TotalRow label="Phí vận chuyển" value={formatVnd(quote.shippingFee)} />}
                    <TotalRow
                        label={quote.vatInvoiceRequested ? 'Thuế GTGT' : 'Thuế GTGT (không xuất hóa đơn)'}
                        value={formatVnd(quote.vatTotal)}
                    />
                    <div className="flex justify-between border-t border-black pt-1 text-sm font-bold">
                        <span>Tổng cộng thanh toán</span>
                        <span className="tabular-nums">{formatVnd(quote.grandTotal)}</span>
                    </div>
                    {quote.depositRequired > 0 && <TotalRow label="Đặt cọc khi xác nhận" value={formatVnd(quote.depositRequired)} />}
                </section>
                <p className="mt-2 italic">Bằng chữ: {vndToWords(quote.grandTotal)}.</p>

                {/* Điều khoản, chuyển khoản */}
                {quote.terms && (
                    <section className="mt-4 break-inside-avoid">
                        <p className="font-semibold">Điều khoản:</p>
                        <p className="whitespace-pre-line">{quote.terms}</p>
                    </section>
                )}
                {company.bankAccount && (
                    <section className="mt-3 break-inside-avoid">
                        <p className="font-semibold">Thông tin chuyển khoản:</p>
                        <p>
                            {company.bankAccountName} · STK {company.bankAccount} · {company.bankName}
                        </p>
                        <p>Nội dung: {quote.code}</p>
                    </section>
                )}

                {/* Ký */}
                <section className="mt-8 grid grid-cols-2 break-inside-avoid text-center">
                    <div>
                        <p className="font-semibold">Xác nhận của khách hàng</p>
                        <p className="text-[11px] italic">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div>
                        <p className="font-semibold">Người lập báo giá</p>
                        <p className="text-[11px] italic">(Ký, ghi rõ họ tên)</p>
                        <p className="mt-16 font-medium">{quote.createdBy?.fullName}</p>
                    </div>
                </section>
            </article>
        </>
    );
}

function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <span>{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    );
}