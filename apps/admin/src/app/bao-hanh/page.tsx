'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Copy, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    ORDER_STATUS_LABEL,
    WARRANTY_STATE_LABEL,
    formatVnPhone,
    type WarrantyDevice,
    type WarrantyLookupResult,
    type WarrantyMatch,
    type WarrantyOrder,
    type WarrantyState,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { errorText } from '@/lib/error-text';
import { useApiQuery } from '@/lib/hooks';

const MATCH_LABEL: Record<WarrantyMatch, string> = {
    PHONE: 'số điện thoại',
    SERIAL: 'serial',
    ORDER_CODE: 'mã đơn',
};

const STATE_BADGE: Record<WarrantyState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    ACTIVE: 'default',
    EXPIRED: 'destructive',
    UNKNOWN: 'secondary',
    NOT_DELIVERED: 'outline',
};

/** "2026-09-22" -> "22/09/2026" (chuỗi ngày đã theo giờ Việt Nam, không đổi múi giờ nữa) */
function formatIsoDate(value: string | null): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
}

export default function WarrantyLookupPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={4} />}>
            <WarrantyLookupContent />
        </Suspense>
    );
}

function WarrantyLookupContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // Chuỗi đang tra cứu nằm trên URL: tải lại trang hoặc bấm Back vẫn giữ kết quả
    const q = searchParams.get('q')?.trim() ?? '';
    const [input, setInput] = useState(q);

    useEffect(() => setInput(q), [q]);

    const query = useApiQuery<WarrantyLookupResult>(['warranty', 'lookup', q], `/warranty/lookup?q=${encodeURIComponent(q)}`, {
        enabled: q.length >= 3,
    });

    function submit() {
        const value = input.trim();
        if (value.length < 3) {
            toast.error('Nhập ít nhất 3 ký tự');
            return;
        }
        router.replace(`${pathname}?q=${encodeURIComponent(value)}`, { scroll: false });
    }

    return (
        <>
            <PageHeader
                title="Tra cứu bảo hành"
                description="Tìm máy đã giao để báo hãng. Bảo hành, đổi trả do hãng xử lý."
            />

            <div className="max-w-5xl space-y-4">
                <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-64 flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') submit();
                            }}
                            placeholder="Số điện thoại, serial hoặc mã đơn"
                            className="h-10 pl-9"
                            autoFocus
                        />
                    </div>
                    <Button className="h-10" onClick={submit}>
                        Tra cứu
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Serial gõ vài ký tự cuối cũng được (ít nhất 4). Số điện thoại tìm cả SĐT đặt hàng, người nhận và người liên hệ
                    của khách doanh nghiệp.
                </p>

                {!q ? (
                    <EmptyState message="Nhập số điện thoại hoặc serial khách đọc qua điện thoại để bắt đầu" />
                ) : query.isPending ? (
                    <LoadingRows rows={4} />
                ) : query.isError ? (
                    <ErrorState message={errorText(query.error)} />
                ) : (
                    <Results result={query.data} />
                )}
            </div>
        </>
    );
}

function Results({ result }: { result: WarrantyLookupResult }) {
    const { phone, serial, orderCode } = result.interpretedAs;
    const understood = [
        phone && `số điện thoại ${formatVnPhone(phone)}`,
        serial && `serial có chứa “${serial}”`,
        orderCode && `mã đơn ${orderCode}`,
    ].filter(Boolean);

    if (understood.length === 0) {
        return (
            <EmptyState message="Không nhận ra số điện thoại, serial hay mã đơn. Serial chỉ gồm chữ, số và . _ / - (ít nhất 4 ký tự)." />
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Tìm theo {understood.join(' hoặc ')}: <strong className="text-foreground">{result.orders.length}</strong> đơn
                {result.truncated && ' (chỉ hiện 50 đơn gần nhất, nên tìm cụ thể hơn)'}. Không tính đơn đã hủy.
            </p>

            {result.orders.length === 0 ? (
                <EmptyState message="Không tìm thấy đơn nào. Thử tìm bằng số điện thoại khác hoặc vài số cuối của serial." />
            ) : (
                result.orders.map((order) => <OrderCard key={order.orderId} order={order} />)
            )}

            <p className="text-xs text-muted-foreground">
                Hạn bảo hành là <strong>ước tính</strong>: tính từ ngày hoàn tất đơn theo số tháng bảo hành đang khai báo ở
                sản phẩm. Hãng là bên quyết định cuối cùng.
            </p>
        </div>
    );
}

/** Nội dung gửi hãng qua Zalo/email: đủ thông tin để hãng tra và cử kỹ thuật */
function brandReportText(order: WarrantyOrder, device: WarrantyDevice): string {
    return [
        `Sản phẩm: ${device.name}${device.sku ? ` (SKU ${device.sku})` : ''}`,
        `Serial: ${device.serialNumbers.length > 0 ? device.serialNumbers.join(', ') : 'chưa ghi'}`,
        `Ngày lắp đặt: ${formatIsoDate(device.startsOn)}`,
        `Khách: ${order.customer.companyName ? `${order.customer.companyName} - ` : ''}${order.customer.name}${order.customer.phone ? ` - ${formatVnPhone(order.customer.phone)}` : ''
        }`,
        order.address && `Địa chỉ: ${order.address}`,
        `Đơn hàng: ${order.orderCode}`,
    ]
        .filter(Boolean)
        .join('\n');
}

function OrderCard({ order }: { order: WarrantyOrder }) {
    async function copy(device: WarrantyDevice) {
        try {
            await navigator.clipboard.writeText(brandReportText(order, device));
            toast.success('Đã sao chép, dán vào Zalo/email gửi hãng');
        } catch {
            toast.error('Trình duyệt chặn sao chép');
        }
    }

    return (
        <Card>
            <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>
                        <Link href={`/don-hang/${order.orderId}`} className="hover:underline">
                            {order.orderCode}
                        </Link>
                    </CardTitle>
                    <Badge variant={order.status === 'COMPLETED' ? 'outline' : 'secondary'}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                    <span className="text-xs text-muted-foreground">
                        Tìm thấy theo {order.matchedBy.map((item) => MATCH_LABEL[item]).join(', ')}
                    </span>
                </div>
                <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <p>
                        <span className="text-muted-foreground">Khách: </span>
                        {order.customer.id ? (
                            <Link href={`/khach-hang/${order.customer.id}`} className="font-medium hover:underline">
                                {order.customer.companyName ?? order.customer.name}
                            </Link>
                        ) : (
                            <span className="font-medium">{order.customer.name}</span>
                        )}
                        {order.customer.companyName && ` · ${order.customer.name}`}
                        {order.customer.phone && ` · ${formatVnPhone(order.customer.phone)}`}
                    </p>
                    <p>
                        <span className="text-muted-foreground">Ngày hoàn tất: </span>
                        {order.completedOn ? formatIsoDate(order.completedOn) : 'Chưa hoàn tất'}
                    </p>
                    {order.address && (
                        <p className="sm:col-span-2">
                            <span className="text-muted-foreground">Địa chỉ lắp: </span>
                            {order.address}
                        </p>
                    )}
                    {order.brandTechnicianNote && (
                        <p className="sm:col-span-2">
                            <span className="text-muted-foreground">Ghi chú kỹ thuật hãng: </span>
                            {order.brandTechnicianNote}
                        </p>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {order.devices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Đơn không có sản phẩm cần bảo hành.</p>
                ) : (
                    <div className="divide-y rounded-lg border">
                        {order.devices.map((device) => (
                            <DeviceRow key={device.lineId} device={device} onCopy={() => copy(device)} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function DeviceRow({ device, onCopy }: { device: WarrantyDevice; onCopy: () => void }) {
    const missingSerials = Math.max(0, device.quantity - device.serialNumbers.length);

    return (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 p-3">
            <div className="min-w-56 flex-1 space-y-1.5">
                <p className="font-medium">
                    {device.name} <span className="font-normal text-muted-foreground">× {device.quantity}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                    {[device.brandName, device.sku && `SKU ${device.sku}`].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {device.serialNumbers.map((item) => (
                        <span
                            key={item}
                            className={
                                device.matchedSerials.includes(item)
                                    ? 'rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                                    : 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs'
                            }
                        >
                            {item}
                        </span>
                    ))}
                    {missingSerials > 0 && (
                        <span className="text-xs text-muted-foreground">
                            {device.serialNumbers.length === 0 ? 'Chưa ghi serial' : `Còn ${missingSerials} máy chưa ghi serial`}
                        </span>
                    )}
                </div>
            </div>

            <div className="w-44 space-y-1 text-sm">
                <Badge variant={STATE_BADGE[device.state]}>
                    <ShieldCheck className="size-3" />
                    {WARRANTY_STATE_LABEL[device.state]}
                </Badge>
                <p className="text-xs text-muted-foreground">
                    {device.warrantyMonths > 0 ? `${device.warrantyMonths} tháng` : 'Sản phẩm chưa khai báo bảo hành'}
                    {device.endsOn && ` · đến ${formatIsoDate(device.endsOn)}`}
                </p>
            </div>

            <Button variant="outline" size="sm" onClick={onCopy}>
                <Copy className="size-4" />
                Sao chép báo hãng
            </Button>
        </div>
    );
}