'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, User } from 'lucide-react';
import { formatVnPhone, type Paginated } from '@ktm/shared';
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
import { CustomerCreateDialog } from '@/components/customer/customer-create-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import type { CustomerListItem } from '@/lib/customer-types';
import { formatVnd } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';
import { useDebounced } from '@/lib/use-debounced';

const PAGE_SIZE = 20;

const TYPE_TABS = [
    { value: '', label: 'Tất cả' },
    { value: 'BUSINESS', label: 'Doanh nghiệp' },
    { value: 'INDIVIDUAL', label: 'Cá nhân' },
] as const;

export default function CustomerListPage() {
    const { can } = useAuth();
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput.trim());
    const [type, setType] = useState('');
    const [mine, setMine] = useState(false);
    const [page, setPage] = useState(1);
    const [creating, setCreating] = useState(false);

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (mine) params.set('mine', 'true');

    const query = useApiQuery<Paginated<CustomerListItem>>(
        ['customers', { page, search, type, mine }],
        `/customers?${params.toString()}`,
        { placeholderData: (previous) => previous, refetchOnMount: 'always' },
    );
    const customers = query.data?.items ?? [];

    return (
        <>
            <PageHeader
                title="Khách hàng"
                description="Khách lẻ tự tạo khi đặt hàng; khách công trình thêm tại đây"
                actions={
                    can('customer.manage') && (
                        <Button onClick={() => setCreating(true)}>
                            <Plus className="size-4" />
                            Thêm khách
                        </Button>
                    )
                }
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-64 flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo tên, số điện thoại, tên công ty, mã số thuế..."
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
                    Chỉ khách tôi phụ trách
                </label>
            </div>

            <div role="tablist" className="mb-4 flex gap-1 border-b">
                {TYPE_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={type === tab.value}
                        onClick={() => {
                            setType(tab.value);
                            setPage(1);
                        }}
                        className={cn(
                            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                            type === tab.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {query.isPending ? (
                <LoadingRows rows={6} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : customers.length === 0 ? (
                <EmptyState message={search || type || mine ? 'Không tìm thấy khách nào' : 'Chưa có khách hàng nào'} />
            ) : (
                <div className={cn('overflow-hidden rounded-lg border', query.isFetching && 'opacity-60')}>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Khách hàng</TableHead>
                                    <TableHead>Liên hệ</TableHead>
                                    <TableHead>Nhóm</TableHead>
                                    <TableHead className="text-center">Số đơn</TableHead>
                                    <TableHead className="text-right">Đã mua</TableHead>
                                    <TableHead>Đơn gần nhất</TableHead>
                                    <TableHead>Phụ trách</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell>
                                            <Link href={`/khach-hang/${customer.id}`} className="group flex items-center gap-2">
                                                {customer.type === 'BUSINESS' ? (
                                                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <User className="size-4 shrink-0 text-muted-foreground" />
                                                )}
                                                <span className="min-w-0">
                                                    <span className="block font-medium group-hover:underline">{customer.fullName}</span>
                                                    {customer.type === 'BUSINESS' && (
                                                        <span className="block text-xs text-muted-foreground">
                                                            {customer.companyName !== customer.fullName && customer.companyName}
                                                            {customer.taxCode && ` · MST ${customer.taxCode}`}
                                                        </span>
                                                    )}
                                                </span>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <p className="tabular-nums">{formatVnPhone(customer.phone) || '—'}</p>
                                            {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                                        </TableCell>
                                        <TableCell className="text-sm">{customer.group.name}</TableCell>
                                        <TableCell className="text-center tabular-nums">{customer._count.orders}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                                            {customer.completedTotal > 0 ? formatVnd(customer.completedTotal) : '—'}
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                                            {customer.lastOrderAt ? formatDateTimeVn(customer.lastOrderAt) : '—'}
                                        </TableCell>
                                        <TableCell className="text-sm">{customer.assignedStaff?.fullName ?? '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
                </div>
            )}

            {creating && <CustomerCreateDialog onClose={() => setCreating(false)} />}
        </>
    );
}