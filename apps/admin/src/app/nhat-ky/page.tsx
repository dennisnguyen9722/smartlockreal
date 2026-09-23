'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react';
import {
    AUDIT_ACTION_GROUPS,
    AUDIT_ACTION_LABEL,
    AUDIT_ENTITY_LABEL,
    auditActionLabel,
    auditEntityHref,
    describeUserAgent,
    type AuditActorItem,
    type AuditLogItem,
    type Paginated,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { cn } from '@ktm/ui/lib/utils';
import { AuditChanges } from '@/components/audit/audit-changes';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn, fromLocalInput, toLocalInput } from '@/lib/order-types';

const PAGE_SIZE = 30;
const SELECT = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm';

export default function AuditPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={6} />}>
            <AuditContent />
        </Suspense>
    );
}

function AuditContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { can } = useAuth();
    const allowed = can('audit.view');

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const staffId = searchParams.get('nguoi') ?? '';
    const group = searchParams.get('nhom') ?? '';
    const action = searchParams.get('hanh-dong') ?? '';
    const entityId = searchParams.get('doi-tuong') ?? '';
    const from = searchParams.get('tu') ?? '';
    const to = searchParams.get('den') ?? '';
    const [expanded, setExpanded] = useState<string | null>(null);

    function update(next: Record<string, string | number | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(next)) {
            if (value === null || value === '' || (key === 'page' && value === 1)) params.delete(key);
            else params.set(key, String(value));
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (staffId) params.set('staffId', staffId);
    if (action) params.set('action', action);
    else if (group) params.set('group', group);
    if (entityId) params.set('entityId', entityId);
    if (from) params.set('from', fromLocalInput(from) ?? '');
    if (to) params.set('to', fromLocalInput(to) ?? '');

    const query = useApiQuery<Paginated<AuditLogItem>>(
        ['audit-logs', page, staffId, group, action, entityId, from, to],
        `/audit-logs?${params.toString()}`,
        { enabled: allowed, placeholderData: (previous) => previous, refetchOnMount: 'always' },
    );
    const actors = useApiQuery<AuditActorItem[]>(['audit-logs', 'actors'], '/audit-logs/actors', { enabled: allowed });

    // Hành động của nhóm đang chọn, để ô "Hành động" không dài lê thê
    const actionOptions = Object.keys(AUDIT_ACTION_LABEL).filter((item) => !group || item.startsWith(`${group}.`));
    const filtered = Boolean(staffId || group || action || entityId || from || to);

    if (!allowed) {
        return (
            <>
                <PageHeader title="Nhật ký" />
                <EmptyState message="Bạn không có quyền xem nhật ký" />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Nhật ký"
                description="Ai đã làm gì trên hệ thống. Nhật ký chỉ để xem, không sửa và không xóa được."
            />

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <select value={staffId} onChange={(event) => update({ nguoi: event.target.value, page: 1 })} className={SELECT}>
                    <option value="">Mọi người</option>
                    {(actors.data ?? []).map((actor) => (
                        <option key={actor.id} value={actor.id}>
                            {actor.fullName}
                        </option>
                    ))}
                </select>
                <select
                    value={group}
                    onChange={(event) => update({ nhom: event.target.value, 'hanh-dong': null, page: 1 })}
                    className={SELECT}
                >
                    <option value="">Mọi nhóm</option>
                    {AUDIT_ACTION_GROUPS.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.label}
                        </option>
                    ))}
                </select>
                <select value={action} onChange={(event) => update({ 'hanh-dong': event.target.value, page: 1 })} className={SELECT}>
                    <option value="">Mọi hành động</option>
                    {actionOptions.map((item) => (
                        <option key={item} value={item}>
                            {auditActionLabel(item)}
                        </option>
                    ))}
                </select>
                <label className="flex items-center gap-1 text-sm text-muted-foreground">
                    Từ
                    <Input type="datetime-local" value={from} onChange={(event) => update({ tu: event.target.value, page: 1 })} className="w-52" />
                </label>
                <label className="flex items-center gap-1 text-sm text-muted-foreground">
                    đến
                    <Input type="datetime-local" value={to} onChange={(event) => update({ den: event.target.value, page: 1 })} className="w-52" />
                </label>
                {filtered && (
                    <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
                        <X className="size-4" />
                        Bỏ lọc
                    </Button>
                )}
            </div>

            {entityId && (
                <p className="mb-3 text-sm text-muted-foreground">
                    Đang xem lịch sử của một đối tượng ({query.data?.total ?? 0} dòng).
                </p>
            )}

            {query.isPending ? (
                <LoadingRows rows={8} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : query.data.items.length === 0 ? (
                <EmptyState message={filtered ? 'Không có dòng nào khớp bộ lọc' : 'Chưa có dòng nhật ký nào'} />
            ) : (
                <div className="rounded-lg border">
                    <div className="divide-y">
                        {query.data.items.map((log) => {
                            const href = auditEntityHref(log.entityType, log.entityId);
                            const open = expanded === log.id;
                            const hasChanges = Boolean(log.changes && Object.keys(log.changes as object).length > 0);
                            return (
                                <div key={log.id} className="p-3 text-sm">
                                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(open ? null : log.id)}
                                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                                        >
                                            {open ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />}
                                            <span className="min-w-0">
                                                <span className="font-medium">{auditActionLabel(log.action)}</span>
                                                <span className="ml-2 text-muted-foreground">
                                                    {AUDIT_ENTITY_LABEL[log.entityType] ?? log.entityType}
                                                    {log.entityName && `: ${log.entityName}`}
                                                    {!log.entityName && log.entityId && ' (đã xóa)'}
                                                </span>
                                            </span>
                                        </button>
                                        <span className="text-muted-foreground">
                                            {log.staff ? (
                                                <Link href={`/nhat-ky?nguoi=${log.staff.id}`} className="hover:underline">
                                                    {log.staff.fullName}
                                                </Link>
                                            ) : (
                                                'Không rõ người'
                                            )}
                                        </span>
                                        <span className="whitespace-nowrap text-muted-foreground">{formatDateTimeVn(log.createdAt)}</span>
                                        {href && (
                                            <Link href={href} className="text-primary hover:underline" title="Mở đối tượng">
                                                <ExternalLink className="size-4" />
                                            </Link>
                                        )}
                                    </div>

                                    {open && (
                                        <div className="mt-2 space-y-2 border-l-2 pl-4">
                                            {hasChanges ? <AuditChanges changes={log.changes} /> : <p className="text-xs text-muted-foreground">Không có chi tiết thay đổi.</p>}
                                            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                                <span>IP {log.ipAddress ?? '—'}</span>
                                                <span>{describeUserAgent(log.userAgent)}</span>
                                                <span className="font-mono">{log.action}</span>
                                                {log.traceId && <span className="font-mono">trace {log.traceId}</span>}
                                            </p>
                                            {log.entityId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2"
                                                    onClick={() => update({ 'doi-tuong': log.entityId, page: 1 })}
                                                >
                                                    Xem toàn bộ lịch sử của đối tượng này
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={(next) => update({ page: next })} />
                </div>
            )}
            <p className={cn('mt-3 text-xs text-muted-foreground', !query.data && 'hidden')}>
                Nhật ký giữ nguyên cả khi đối tượng đã bị xóa, nên có dòng ghi "(đã xóa)".
            </p>
        </>
    );
}
