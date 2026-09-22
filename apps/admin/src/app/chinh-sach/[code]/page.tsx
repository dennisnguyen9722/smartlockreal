'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { POLICY_CODES, POLICY_INFO, type PolicyCode, type PolicyVersionDetail, type PolicyVersionItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { RichHtmlView } from '@/components/rich-html-view';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

const back = (
    <Link href="/chinh-sach">
        <Button variant="outline">
            <ArrowLeft className="size-4" />
            Chính sách
        </Button>
    </Link>
);

export default function PolicyHistoryPage() {
    return (
        <Suspense fallback={<LoadingRows rows={6} />}>
            <PolicyHistory />
        </Suspense>
    );
}

function PolicyHistory() {
    const { code: rawCode } = useParams<{ code: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { can } = useAuth();
    const code = (POLICY_CODES as readonly string[]).includes(rawCode) ? (rawCode as PolicyCode) : null;

    const versions = useApiQuery<PolicyVersionItem[]>(['policies', code, 'versions'], `/policies/${code}/versions`, {
        enabled: Boolean(code),
    });
    // Bản đang xem: ?v=, mặc định bản đang hiện (hoặc bản mới nhất)
    const selectedId =
        searchParams.get('v') ?? versions.data?.find((item) => item.isCurrent)?.id ?? versions.data?.[0]?.id ?? '';
    const detail = useApiQuery<PolicyVersionDetail>(['policies', 'version', selectedId], `/policies/versions/${selectedId}`, {
        enabled: Boolean(selectedId),
    });

    if (!code) {
        return (
            <>
                <PageHeader title="Chính sách" actions={back} />
                <EmptyState message="Không có loại chính sách này" action={back} />
            </>
        );
    }

    const info = POLICY_INFO[code];
    const actions = (
        <div className="flex gap-2">
            {can('setting.manage') && (
                <Link href={`/chinh-sach/${code}/moi${selectedId ? `?tu=${selectedId}` : ''}`}>
                    <Button>
                        <Plus className="size-4" />
                        Tạo bản mới từ bản đang xem
                    </Button>
                </Link>
            )}
            {back}
        </div>
    );

    return (
        <>
            <PageHeader title={info.label} description="Lịch sử phiên bản. Bản cũ chỉ xem, không sửa hay xóa được." actions={actions} />
            {versions.isPending ? (
                <LoadingRows rows={4} />
            ) : versions.isError ? (
                <ErrorState message={versions.error.message} />
            ) : versions.data.length === 0 ? (
                <EmptyState message="Chưa có phiên bản nào" />
            ) : (
                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <ul className="divide-y self-start rounded-lg border">
                        {versions.data.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => router.replace(`${pathname}?v=${item.id}`, { scroll: false })}
                                    className={cn('w-full space-y-1 p-3 text-left text-sm hover:bg-muted', item.id === selectedId && 'bg-muted')}
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        Bản {item.version}
                                        {item.isCurrent && <Badge>Đang hiện</Badge>}
                                        {item.isUpcoming && <Badge variant="secondary">Sắp hiệu lực</Badge>}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">Hiệu lực {formatDateTimeVn(item.effectiveAt)}</span>
                                    {item.createdBy && <span className="block text-xs text-muted-foreground">Tạo bởi {item.createdBy.fullName}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div className="min-w-0 rounded-lg border p-6">
                        {detail.isPending ? (
                            <LoadingRows rows={6} />
                        ) : detail.isError ? (
                            <ErrorState message={detail.error.message} />
                        ) : (
                            <>
                                <h2 className="text-2xl font-semibold">{detail.data.title}</h2>
                                <p className="mt-1 mb-4 text-xs text-muted-foreground">
                                    Bản {detail.data.version} · hiệu lực từ {formatDateTimeVn(detail.data.effectiveAt)} · tạo lúc{' '}
                                    {formatDateTimeVn(detail.data.createdAt)}
                                </p>
                                <RichHtmlView html={detail.data.content} />
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}