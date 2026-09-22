'use client';

import Link from 'next/link';
import { ImageIcon, Plus } from 'lucide-react';
import { imageUrl, type ShowroomListItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ktm/ui/components/table';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useApiQuery } from '@/lib/hooks';

const REGION_LABEL: Record<ShowroomListItem['region'], string> = { HCM: 'TP.HCM', HN: 'Hà Nội' };

export default function ShowroomListPage() {
    const { can } = useAuth();
    const canManage = can('content.manage');
    const query = useApiQuery<ShowroomListItem[]>(['showrooms'], '/showrooms', { refetchOnMount: 'always' });

    const addButton = canManage ? (
        <Link href="/showroom/moi">
            <Button>
                <Plus className="size-4" />
                Thêm showroom
            </Button>
        </Link>
    ) : null;

    return (
        <>
            <PageHeader
                title="Showroom"
                description="Địa chỉ, giờ mở cửa, bản đồ. Dùng cho trang showroom trên website và đơn nhận tại showroom."
                actions={addButton}
            />

            {query.isPending ? (
                <LoadingRows rows={4} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : query.data.length === 0 ? (
                <EmptyState message="Chưa có showroom nào" action={addButton} />
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20" />
                                <TableHead>Showroom</TableHead>
                                <TableHead>Khu vực</TableHead>
                                <TableHead>Điện thoại</TableHead>
                                <TableHead>Website</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {query.data.map((showroom) => (
                                <TableRow key={showroom.id} className={cn(!showroom.isActive && 'opacity-60')}>
                                    <TableCell>
                                        <div className="flex size-14 items-center justify-center overflow-hidden rounded-md border bg-muted">
                                            {showroom.coverUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                                                <img
                                                    src={showroom.coverUrl.endsWith('.webp') ? imageUrl(showroom.coverUrl, 'sm') : showroom.coverUrl}
                                                    alt=""
                                                    className="size-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="size-5 text-muted-foreground" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="min-w-72">
                                        <Link href={`/showroom/${showroom.id}`} className="font-medium hover:underline">
                                            {showroom.name}
                                        </Link>
                                        <p className="text-xs text-muted-foreground">{showroom.address}</p>
                                    </TableCell>
                                    <TableCell>{REGION_LABEL[showroom.region]}</TableCell>
                                    <TableCell>{showroom.phone ?? '—'}</TableCell>
                                    <TableCell>
                                        {!showroom.isActive ? (
                                            <Badge variant="outline">Đã tắt</Badge>
                                        ) : showroom.isPublic ? (
                                            <Badge>Đang hiện</Badge>
                                        ) : showroom.missing.length > 0 ? (
                                            <span className="text-xs text-amber-600" title={showroom.missing.join(', ')}>
                                                Thiếu {showroom.missing.length} mục
                                            </span>
                                        ) : (
                                            <Badge variant="secondary">Ẩn</Badge>
                                        )}
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