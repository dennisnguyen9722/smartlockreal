'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Plus, Search, TriangleAlert } from 'lucide-react';
import {
    formatVnPhone,
    ORDER_STATUS_LABEL,
    SALES_CHANNEL_LABEL,
    type OrderListStatus,
    type OrderStatusCounts,
    type OrderStatusValue,
    type Paginated,
    type SalesChannelValue,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
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
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { useDebounced } from '@/lib/use-debounced';

interface OrderListItem {
    id: string;
    code: string;
    channel: SalesChannelValue;
    status: OrderStatusValue;
    fulfillmentType: 'DELIVERY' | 'STORE_PICKUP' | 'TAKE_AWAY';
    customerName: string | null;
    customerPhone: string | null;
    grandTotal: number;
    paidTotal: number;
    depositRequired: number;
    scheduledAt: string | null;
    placedAt: string;
    needsAttention: boolean;
    assignedStaff: { id: string; fullName: string } | null;
    lines: { name: string; quantity: number }[];
    _count: { lines: number };
}

const PAGE_SIZE = 20;

/** Thứ tự tab theo đúng quy trình; mặc định "Đang xử lý" = mọi đơn chưa xong */
const STATUS_TABS: { value: OrderListStatus; label: string }[] = [
    { value: 'OPEN', label: 'Đang xử lý' },
    { value: 'PENDING_CONFIRMATION', label: ORDER_STATUS_LABEL.PENDING_CONFIRMATION },
    { value: 'CONFIRMED', label: ORDER_STATUS_LABEL.CONFIRMED },
    { value: 'ORDERED_FROM_BRAND', label: ORDER_STATUS_LABEL.ORDERED_FROM_BRAND },
    { value: 'GOODS_ARRIVED', label: ORDER_STATUS_LABEL.GOODS_ARRIVED },
    { value: 'FULFILLING', label: ORDER_STATUS_LABEL.FULFILLING },
    { value: 'COMPLETED', label: ORDER_STATUS_LABEL.COMPLETED },
    { value: 'CANCELLED', label: ORDER_STATUS_LABEL.CANCELLED },
    { value: 'ALL', label: 'Tất cả' },
];

const STATUS_BADGE: Partial<Record<OrderStatusValue, 'default' | 'secondary' | 'outline' | 'destructive'>> = {
    // Đơn mới: phải gọi khách ngay, làm nổi nhất
    PENDING_CONFIRMATION: 'destructive',
    COMPLETED: 'outline',
    CANCELLED: 'outline',
};

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});

/** "5 phút trước", "3 giờ trước", hoặc ngày giờ nếu lâu hơn một ngày */
function timeAgo(value: string): string {
    const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
    if (minutes < 1) return 'vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ trước`;
    return DATE_TIME.format(new Date(value));
}

export default function OrderListPage() {
    const { can } = useAuth();
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput.trim());
    const [status, setStatus] = useState<OrderListStatus>('OPEN');
    const [channel, setChannel] = useState('');
    const [mine, setMine] = useState(false);
    const [page, setPage] = useState(1);

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status });
    if (search) params.set('search', search);
    if (channel) params.set('channel', channel);
    if (mine) params.set('mine', 'true');

    const query = useApiQuery<Paginated<OrderListItem> & { statusCounts: OrderStatusCounts }>(
        ['orders', { page, search, status, channel, mine }],
        `/orders?${params.toString()}`,
        // Đơn mới đến liên tục: luôn hỏi lại server khi mở trang
        { placeholderData: (previous) => previous, refetchOnMount: 'always' },
    );

    const orders = query.data?.items ?? [];
    const hasFilter = Boolean(search || channel || mine);

    return (
        <>
            <PageHeader
                title="Đơn hàng"
                description="Đơn từ website, Zalo, tại showroom và công trình"
                actions={
                    can('order.manage') && (
                        <Link href="/don-hang/moi">
                            <Button>
                                <Plus className="size-4" />
                                Tạo đơn
                            </Button>
                        </Link>
                    )
                }
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-64 flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo mã đơn, số điện thoại, tên khách..."
                        value={searchInput}
                        onChange={(event) => {
                            setSearchInput(event.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
                <select
                    value={channel}
                    onChange={(event) => {
                        setChannel(event.target.value);
                        setPage(1);
                    }}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                    <option value="">Mọi kênh</option>
                    {Object.entries(SALES_CHANNEL_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={mine}
                        onChange={(event) => {
                            setMine(event.target.checked);
                            setPage(1);
                        }}
                        className="size-4"
                    />
                    Chỉ đơn tôi phụ trách
                </label>
            </div>

            <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b">
                {STATUS_TABS.map((tab) => {
                    const count = query.data?.statusCounts[tab.value];
                    const urgent = tab.value === 'PENDING_CONFIRMATION' && (count ?? 0) > 0;
                    return (
                        <button
                            key={tab.value}
                            type="button"
                            role="tab"
                            aria-selected={status === tab.value}
                            onClick={() => {
                                setStatus(tab.value);
                                setPage(1);
                            }}
                            className={cn(
                                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                                status === tab.value
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {tab.label}
                            {count !== undefined && (
                                <span
                                    className={cn(
                                        'ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                                        urgent ? 'bg-destructive text-white' : 'bg-muted',
                                    )}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {query.isPending ? (
                <LoadingRows rows={6} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : orders.length === 0 ? (
                <EmptyState
                    message={
                        hasFilter
                            ? 'Không tìm thấy đơn nào khớp bộ lọc'
                            : status === 'OPEN'
                                ? 'Không có đơn nào đang cần xử lý'
                                : 'Chưa có đơn nào ở trạng thái này'
                    }
                />
            ) : (
                <div className={cn('overflow-hidden rounded-lg border', query.isFetching && 'opacity-60')}>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã đơn</TableHead>
                                    <TableHead>Khách hàng</TableHead>
                                    <TableHead>Sản phẩm</TableHead>
                                    <TableHead className="text-right">Tổng tiền</TableHead>
                                    <TableHead>Hẹn giao lắp</TableHead>
                                    <TableHead>Phụ trách</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => {
                                    const first = order.lines[0];
                                    const more = order._count.lines - 1;
                                    return (
                                        <TableRow key={order.id} className={cn(order.status === 'CANCELLED' && 'opacity-60')}>
                                            <TableCell>
                                                <Link href={`/don-hang/${order.id}`} className="font-mono text-sm font-medium hover:underline">
                                                    {order.code}
                                                </Link>
                                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    {SALES_CHANNEL_LABEL[order.channel]} · {timeAgo(order.placedAt)}
                                                    {order.needsAttention && <TriangleAlert className="size-3 text-destructive" />}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium">{order.customerName ?? '—'}</p>
                                                <p className="text-xs text-muted-foreground tabular-nums">{formatVnPhone(order.customerPhone)}</p>
                                            </TableCell>
                                            <TableCell className="max-w-64">
                                                {first && (
                                                    <p className="truncate text-sm">
                                                        {first.quantity > 1 && `${first.quantity} × `}
                                                        {first.name}
                                                    </p>
                                                )}
                                                {more > 0 && <p className="text-xs text-muted-foreground">và {more} sản phẩm khác</p>}
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                                <p className="font-medium tabular-nums">{formatVnd(order.grandTotal)}</p>
                                                {order.paidTotal > 0 && (
                                                    <p className="text-xs text-muted-foreground tabular-nums">Đã thu {formatVnd(order.paidTotal)}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm">
                                                {order.scheduledAt ? (
                                                    <span className="flex items-center gap-1">
                                                        <CalendarClock className="size-3.5 text-muted-foreground" />
                                                        {DATE_TIME.format(new Date(order.scheduledAt))}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">{order.assignedStaff?.fullName ?? '—'}</TableCell>
                                            <TableCell>
                                                <Badge variant={STATUS_BADGE[order.status] ?? 'secondary'}>
                                                    {ORDER_STATUS_LABEL[order.status]}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
                </div>
            )}
        </>
    );
}