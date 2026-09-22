'use client';

import Link from 'next/link';
import { CalendarClock, History, Plus } from 'lucide-react';
import { POLICY_INFO, policyPath, type PolicySummary } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { useAuth } from '@/components/auth-provider';
import { ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

export default function PolicyOverviewPage() {
    const { can } = useAuth();
    const canCreate = can('setting.manage');
    const query = useApiQuery<PolicySummary[]>(['policies'], '/policies', { refetchOnMount: 'always' });

    return (
        <>
            <PageHeader
                title="Chính sách"
                description="Mỗi lần sửa là một phiên bản mới; bản cũ giữ nguyên để đối chiếu với những gì khách đã đồng ý."
            />
            {query.isPending ? (
                <LoadingRows rows={6} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {query.data.map((policy) => {
                        const info = POLICY_INFO[policy.code];
                        return (
                            <Card key={policy.code}>
                                <CardHeader>
                                    <CardTitle className="text-base">{info.label}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <p className="text-xs text-muted-foreground">{info.hint}</p>
                                    {policy.current ? (
                                        <p>
                                            <Badge>Bản {policy.current.version}</Badge>{' '}
                                            <span className="text-xs text-muted-foreground">hiệu lực từ {formatDateTimeVn(policy.current.effectiveAt)}</span>
                                        </p>
                                    ) : (
                                        <p className="text-xs text-amber-600">Chưa có bản nào, website chưa hiện chính sách này</p>
                                    )}
                                    {policy.upcoming && (
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <CalendarClock className="size-3.5" />
                                            Bản {policy.upcoming.version} sẽ có hiệu lực lúc {formatDateTimeVn(policy.upcoming.effectiveAt)}
                                        </p>
                                    )}
                                    <p className="font-mono text-xs text-muted-foreground">{policyPath(policy.code)}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {policy.versionCount > 0 && (
                                            <Link href={`/chinh-sach/${policy.code}`}>
                                                <Button variant="outline" size="sm">
                                                    <History className="size-4" />
                                                    Xem ({policy.versionCount} bản)
                                                </Button>
                                            </Link>
                                        )}
                                        {canCreate && (
                                            <Link href={`/chinh-sach/${policy.code}/moi${policy.current ? `?tu=${policy.current.id}` : ''}`}>
                                                <Button size="sm">
                                                    <Plus className="size-4" />
                                                    {policy.versionCount > 0 ? 'Tạo bản mới' : 'Tạo bản đầu tiên'}
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </>
    );
}