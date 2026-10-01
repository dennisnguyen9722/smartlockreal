'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Phone, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
    CONSULT_KIND_LABEL,
    CONSULT_STATUSES,
    CONSULT_STATUS_LABEL,
    formatVnPhone,
    type ConsultItem,
    type ConsultStatusCounts,
    type ConsultStatusValue,
    type Paginated,
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
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/components/auth-provider';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { errorText } from '@/lib/error-text';

/**
 * Hộp thư yêu cầu tư vấn từ website.
 *
 * Chứa DỮ LIỆU CÁ NHÂN của khách (tên, số điện thoại), nên trang đòi quyền
 * customer.view để xem và customer.manage để đổi trạng thái hay ghi chú.
 */

const PAGE_SIZE = 20;

/** Màu nhãn theo trạng thái, để liếc một cái là thấy cái nào chưa ai đụng tới */
const MAU_TRANG_THAI: Record<ConsultStatusValue, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    NEW: 'default',
    CONTACTED: 'secondary',
    QUOTED: 'secondary',
    WON: 'secondary',
    LOST: 'outline',
    SPAM: 'destructive',
};

export default function TrangYeuCau() {
    const { can } = useAuth();
    const duocSua = can('customer.manage');

    const [status, setStatus] = useState<ConsultStatusValue | ''>('NEW');
    const [oTimKiem, setOTimKiem] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dangMo, setDangMo] = useState<string | null>(null);

    useEffect(() => {
        const hen = setTimeout(() => {
            setSearch(oTimKiem.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(hen);
    }, [oTimKiem]);

    const duongDan = useMemo(() => {
        const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (status) p.set('status', status);
        if (search) p.set('q', search);
        return `/consult-requests?${p.toString()}`;
    }, [page, status, search]);

    const query = useApiQuery<Paginated<ConsultItem> & { statusCounts: ConsultStatusCounts }>(
        ['consult-requests', page, status, search],
        duongDan,
    );

    const capNhat = useApiMutation<
        ConsultItem,
        { id: string; status?: ConsultStatusValue; internalNote?: string; expectedUpdatedAt: string }
    >(
        ({ id, ...than }) => ({ path: `/consult-requests/${id}`, method: 'PATCH', body: than }),
        {
            invalidate: [['consult-requests']],
            onSuccess: () => toast.success('Đã lưu'),
            onError: (error) => toast.error(errorText(error)),
        },
    );

    const dem = query.data?.statusCounts;
    const tong = query.data?.total ?? 0;
    const soTrang = Math.max(1, Math.ceil(tong / PAGE_SIZE));

    return (
        <div className="space-y-4">
            <PageHeader
                title="Yêu cầu tư vấn"
                description="Khách để lại số trên website. Gọi xong nhớ đổi trạng thái để người khác khỏi gọi trùng."
            />

            {/* Tab trạng thái, kèm số đếm để biết còn bao nhiêu cái chưa ai gọi */}
            <div className="flex flex-wrap gap-1 overflow-x-auto border-b pb-px">
                <Tab
                    dangChon={status === ''}
                    onClick={() => {
                        setStatus('');
                        setPage(1);
                    }}
                >
                    Tất cả
                </Tab>
                {CONSULT_STATUSES.map((muc) => (
                    <Tab
                        key={muc}
                        dangChon={status === muc}
                        onClick={() => {
                            setStatus(muc);
                            setPage(1);
                        }}
                    >
                        {CONSULT_STATUS_LABEL[muc]}
                        {dem && dem[muc] > 0 && (
                            <span className="so-lieu ml-1.5 text-xs text-muted-foreground">{dem[muc]}</span>
                        )}
                    </Tab>
                ))}
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={oTimKiem}
                    onChange={(event) => setOTimKiem(event.target.value)}
                    placeholder="Tìm theo tên, số điện thoại, công ty"
                    className="pl-8"
                />
            </div>

            {query.isPending ? (
                <LoadingRows />
            ) : query.isError ? (
                <ErrorState message={errorText(query.error)} onRetry={() => query.refetch()} />
            ) : (query.data?.items.length ?? 0) === 0 ? (
                <EmptyState
                    message={
                        status === 'NEW'
                            ? 'Không còn yêu cầu nào chưa gọi. Gọn gàng.'
                            : 'Chưa có yêu cầu nào khớp bộ lọc.'
                    }
                />
            ) : (
                <>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-44">Khách</TableHead>
                                    <TableHead className="w-36">Điện thoại</TableHead>
                                    <TableHead className="w-28">Loại</TableHead>
                                    <TableHead>Nội dung</TableHead>
                                    <TableHead className="w-32">Gửi lúc</TableHead>
                                    <TableHead className="w-32">Trạng thái</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {query.data?.items.map((muc) => (
                                    <Dong
                                        key={muc.id}
                                        muc={muc}
                                        duocSua={duocSua}
                                        dangMo={dangMo === muc.id}
                                        onMo={() => setDangMo(dangMo === muc.id ? null : muc.id)}
                                        onLuu={(than) => capNhat.mutate({ id: muc.id, ...than })}
                                        dangLuu={capNhat.isPending}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <span className="so-lieu text-sm text-muted-foreground">
                            {tong} yêu cầu · trang {page}/{soTrang}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((truoc) => truoc - 1)}
                            >
                                Trang trước
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= soTrang}
                                onClick={() => setPage((truoc) => truoc + 1)}
                            >
                                Trang sau
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Dong({
    muc,
    duocSua,
    dangMo,
    onMo,
    onLuu,
    dangLuu,
}: {
    muc: ConsultItem;
    duocSua: boolean;
    dangMo: boolean;
    onMo: () => void;
    onLuu: (than: { status?: ConsultStatusValue; internalNote?: string; expectedUpdatedAt: string }) => void;
    dangLuu: boolean;
}) {
    const [ghiChu, setGhiChu] = useState(muc.internalNote ?? '');

    // Yêu cầu được tải lại (đổi trạng thái, phân trang) thì lấy lại ghi chú từ máy chủ
    useEffect(() => {
        setGhiChu(muc.internalNote ?? '');
    }, [muc.internalNote]);

    const ngay = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(muc.createdAt));

    return (
        <>
            <TableRow
                onClick={onMo}
                className={`cursor-pointer ${muc.status === 'NEW' ? 'font-medium' : ''}`}
            >
                <TableCell>
                    <span className="block">{muc.fullName}</span>
                    {muc.company && (
                        <span className="block text-xs text-muted-foreground">{muc.company}</span>
                    )}
                </TableCell>
                <TableCell>
                    <a
                        href={`tel:${muc.phone}`}
                        onClick={(event) => event.stopPropagation()}
                        className="so-lieu inline-flex items-center gap-1.5 hover:underline"
                    >
                        <Phone className="size-3.5" />
                        {formatVnPhone(muc.phone)}
                    </a>
                </TableCell>
                <TableCell className="text-muted-foreground">{CONSULT_KIND_LABEL[muc.kind]}</TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                    {muc.quantity ? `${muc.quantity} bộ · ` : ''}
                    {muc.message ?? muc.productName ?? '—'}
                </TableCell>
                <TableCell className="so-lieu text-muted-foreground">{ngay}</TableCell>
                <TableCell>
                    <Badge variant={MAU_TRANG_THAI[muc.status]}>{CONSULT_STATUS_LABEL[muc.status]}</Badge>
                </TableCell>
            </TableRow>

            {dangMo && (
                <TableRow>
                    <TableCell colSpan={6} className="bg-muted/40">
                        <div className="grid gap-4 py-2 md:grid-cols-2">
                            <dl className="space-y-1.5 text-sm">
                                <ChiTiet nhan="Email" giaTri={muc.email} />
                                <ChiTiet nhan="Loại cửa" giaTri={muc.doorTypeName} />
                                <ChiTiet nhan="Sản phẩm" giaTri={muc.productName} />
                                <ChiTiet nhan="Gửi từ trang" giaTri={muc.sourcePath} />
                                <ChiTiet
                                    nhan="Đã gọi lúc"
                                    giaTri={
                                        muc.contactedAt
                                            ? new Intl.DateTimeFormat('vi-VN', {
                                                  dateStyle: 'short',
                                                  timeStyle: 'short',
                                              }).format(new Date(muc.contactedAt))
                                            : null
                                    }
                                />
                                {muc.message && (
                                    <div className="pt-2">
                                        <dt className="text-xs text-muted-foreground">Khách viết</dt>
                                        <dd className="mt-1 whitespace-pre-wrap">{muc.message}</dd>
                                    </div>
                                )}
                            </dl>

                            <div className="space-y-2">
                                <label className="block text-xs text-muted-foreground">
                                    Ghi chú nội bộ (khách không thấy)
                                </label>
                                <textarea
                                    value={ghiChu}
                                    onChange={(event) => setGhiChu(event.target.value)}
                                    disabled={!duocSua}
                                    rows={3}
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                />

                                {duocSua && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={muc.status}
                                            aria-label="Đổi trạng thái"
                                            onChange={(event) =>
                                                onLuu({
                                                    status: event.target.value as ConsultStatusValue,
                                                    expectedUpdatedAt: muc.updatedAt,
                                                })
                                            }
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            {CONSULT_STATUSES.map((trangThai) => (
                                                <option key={trangThai} value={trangThai}>
                                                    {CONSULT_STATUS_LABEL[trangThai]}
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={dangLuu || ghiChu === (muc.internalNote ?? '')}
                                            onClick={() =>
                                                onLuu({ internalNote: ghiChu, expectedUpdatedAt: muc.updatedAt })
                                            }
                                        >
                                            Lưu ghi chú
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

function ChiTiet({ nhan, giaTri }: { nhan: string; giaTri: string | null }) {
    if (!giaTri) return null;
    return (
        <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-xs text-muted-foreground">{nhan}</dt>
            <dd className="min-w-0 break-words">{giaTri}</dd>
        </div>
    );
}

function Tab({
    dangChon,
    onClick,
    children,
}: {
    dangChon: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={dangChon}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                dangChon
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
            {children}
        </button>
    );
}
