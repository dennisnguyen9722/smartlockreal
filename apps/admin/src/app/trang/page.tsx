'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { POST_STATUS_LABEL, pagePath, type PageListItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ktm/ui/components/table';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

export default function StaticPageListPage() {
    const { can } = useAuth();
    const query = useApiQuery<PageListItem[]>(['pages'], '/pages', { refetchOnMount: 'always' });

    const addButton = can('content.manage') ? (
        <Link href="/trang/moi">
            <Button>
                <Plus className="size-4" />
                Thêm trang
            </Button>
        </Link>
    ) : null;

    return (
        <>
            <PageHeader title="Trang tĩnh" description="Giới thiệu, Liên hệ, Tuyển dụng... Chính sách và FAQ quản lý ở mục riêng." actions={addButton} />
            {query.isPending ? (
                <LoadingRows rows={4} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : query.data.length === 0 ? (
                <EmptyState message="Chưa có trang nào" action={addButton} />
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Trang</TableHead>
                                <TableHead>Đường dẫn</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead>Sửa lần cuối</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {query.data.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Link href={`/trang/${item.id}`} className="font-medium hover:underline">
                                            {item.title}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{pagePath(item.slug)}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'PUBLISHED' ? 'default' : 'secondary'}>{POST_STATUS_LABEL[item.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {formatDateTimeVn(item.updatedAt)}
                                        {item.updatedBy && ` · ${item.updatedBy.fullName}`}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </>
    );
}