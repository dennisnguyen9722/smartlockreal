'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import {
    formatDiscountBps,
    QUOTE_STATUS_LABEL,
    type Paginated,
    type QuoteListStatus,
    type QuoteStatusCounts,
    type QuoteStatusValue,
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
import { formatDateTimeVn } from '@/lib/order-types';
import type { QuoteListItem } from '@/lib/quote-types';
import { useDebounced } from '@/lib/use-debounced';

const PAGE_SIZE = 20;

const TABS: { value: QuoteListStatus; label: string }[] = [
    { value: 'OPEN', label: 'Đang theo dõi' },
    { value: 'DRAFT', label: QUOTE_STATUS_LABEL.DRAFT },
    { value: 'PENDING_APPROVAL', label: QUOTE_STATUS_LABEL.PENDING_APPROVAL },
    { value: 'APPROVED', label: QUOTE_STATUS_LABEL.APPROVED },
    { value: 'SENT', label: QUOTE_STATUS_LABEL.SENT },
    { value: 'ACCEPTED', label: QUOTE_STATUS_LABEL.ACCEPTED },
    { value: 'CONVERTED', label: QUOTE_STATUS_LABEL.CONVERTED },
    { value: 'CLOSED', label: 'Từ chối, hết hạn, hủy' },
    { value: 'ALL', label: 'Tất cả' },
];

const STATUS_BADGE: Partial<Record<QuoteStatusValue, 'default' | 'secondary' | 'outline' | 'destructive'>> = {
    PENDING_APPROVAL: 'destructive',
    CONVERTED: 'default',
    REJECTED: 'outline',
    EXPIRED: 'outline',
    CANCELLED: 'outline',
};

export default function QuoteListPage() {
    const { can } = useAuth();
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput.trim());
    const [status, setStatus] = useState<QuoteListStatus>('OPEN');
    const [mine, setMine] = useState(false);
    const [page, setPage] = useState(1);

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status });
    if (search) params.set('search', search);
    if (mine) params.set('mine', 'true');

    const query = useApiQuery<Paginated<QuoteListItem> & { statusCounts: QuoteStatusCounts }>(
        ['quotes', { page, search, status, mine }],
        `/quotes?${params.toString()}`,
        { placeholderData: (previous) => previous, refetchOnMount: 'always' },
    );
    const quotes = query.data?.items ?? [];

    return (
        <>
            <PageHeader
                title="Báo giá công trình"
                description="Báo giá nhiều sản phẩm, giá riêng; giảm quá ngưỡng cần quản trị duyệt"
                actions={
                    can('quote.manage') && (
                        <Link href="/bao-gia/moi">
                            <Button>
                                <Plus className="size-4" />
                                Lập báo giá
                            </Button>
                        </Link>
                    )
                }
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-64 flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo mã báo giá, tên công trình, tên khách..."
                        value={searchInput}
                        onChange={(event) => {
                            setSearchInput(event.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
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
                    Chỉ báo giá tôi lập
                </label>
            </div>

            <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b">
                {TABS.map((tab) => {
                    const count = query.data?.statusCounts[tab.value];
                    const urgent = tab.value === 'PENDING_APPROVAL' && (count ?? 0) > 0;
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
                                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                                status === tab.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {tab.label}
                            {count !== undefined && (
                                <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums', urgent ? 'bg-destructive text-white' : 'bg-muted')}>
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
            ) : quotes.length === 0 ? (
                <EmptyState message={search || mine ? 'Không tìm thấy báo giá nào' : 'Chưa có báo giá nào ở trạng thái này'} />
            ) : (
                <div className={cn('overflow-hidden rounded-lg border', query.isFetching && 'opacity-60')}>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã báo giá</TableHead>
                                    <TableHead>Khách / công trình</TableHead>
                                    <TableHead className="text-right">Tổng (gồm VAT)</TableHead>
                                    <TableHead className="text-right">Giảm nhiều nhất</TableHead>
                                    <TableHead>Hiệu lực đến</TableHead>
                                    <TableHead>Người lập</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotes.map((quote) => (
                                    <TableRow key={quote.id} className={cn(['CANCELLED', 'EXPIRED', 'REJECTED'].includes(quote.status) && 'opacity-60')}>
                                        <TableCell>
                                            <Link href={`/bao-gia/${quote.id}`} className="font-mono text-sm font-medium hover:underline">
                                                {quote.code}
                                            </Link>
                                            {quote.revision > 1 && <span className="ml-1 text-xs text-muted-foreground">bản {quote.revision}</span>}
                                            <p className="text-xs text-muted-foreground">
                                                {formatDateTimeVn(quote.createdAt)} · {quote._count.lines} sản phẩm
                                            </p>
                                        </TableCell>
                                        <TableCell className="max-w-72">
                                            <p className="truncate font-medium">{quote.customer.companyName ?? quote.customer.fullName}</p>
                                            {quote.projectName && <p className="truncate text-xs text-muted-foreground">{quote.projectName}</p>}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap tabular-nums">{formatVnd(quote.grandTotal)}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                                            {quote.maxDiscountBps > 0 ? (
                                                <span className={cn(quote.requiresApproval && 'font-medium text-destructive')}>
                                                    {formatDiscountBps(quote.maxDiscountBps)}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">
                                            {new Date(`${quote.validUntil.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell className="text-sm">{quote.createdBy?.fullName ?? '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={STATUS_BADGE[quote.status] ?? 'secondary'}>{QUOTE_STATUS_LABEL[quote.status]}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
                </div>
            )}
        </>
    );
}