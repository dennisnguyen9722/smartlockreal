'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { STAFF_ROLE_LABEL, formatVnPhone, type StaffListItem, type StaffPasswordResult } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ktm/ui/components/table';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { PasswordRevealDialog } from '@/components/staff/password-reveal-dialog';
import { StaffStatusBadge } from '@/components/staff/staff-status-badge';
import { StaffDialog } from '@/components/staff/staff-dialog';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

export default function StaffListPage() {
    const router = useRouter();
    const { can } = useAuth();
    const allowed = can('staff.manage');
    const query = useApiQuery<StaffListItem[]>(['staff'], '/staff', { enabled: allowed, refetchOnMount: 'always' });
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<StaffPasswordResult | null>(null);

    if (!allowed) {
        return (
            <>
                <PageHeader title="Nhân viên" />
                <EmptyState message="Chỉ quản trị mới quản lý nhân viên" />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Nhân viên"
                description="Tài khoản đăng nhập CMS. Nhân viên nghỉ việc thì khóa tài khoản (không xóa để giữ lịch sử đơn, báo giá)."
                actions={
                    <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" />
                        Thêm nhân viên
                    </Button>
                }
            />

            {query.isPending ? (
                <LoadingRows rows={4} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : query.data.length === 0 ? (
                <EmptyState message="Chưa có nhân viên" />
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nhân viên</TableHead>
                                <TableHead>Vai trò</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead>Đăng nhập gần nhất</TableHead>
                                <TableHead className="text-right">Phiên đang mở</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {query.data.map((staff) => (
                                <TableRow key={staff.id} className={cn(staff.status === 'DISABLED' && 'opacity-60')}>
                                    <TableCell className="min-w-64">
                                        <Link href={`/nhan-vien/${staff.id}`} className="font-medium hover:underline">
                                            {staff.fullName}
                                        </Link>
                                        {staff.isSelf && <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>}
                                        <p className="text-xs text-muted-foreground">
                                            {staff.email}
                                            {staff.phone && ` · ${formatVnPhone(staff.phone)}`}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={staff.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>{STAFF_ROLE_LABEL[staff.role]}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <StaffStatusBadge staff={staff} />
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {staff.lastLoginAt ? formatDateTimeVn(staff.lastLoginAt) : 'Chưa đăng nhập'}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{staff.activeSessions}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {creating && (
                <StaffDialog
                    staff={null}
                    onClose={() => setCreating(false)}
                    onCreated={(result) => {
                        if (result.temporaryPassword) setCreated(result);
                        else router.push(`/nhan-vien/${result.staff.id}`);
                    }}
                />
            )}
            {created?.temporaryPassword && (
                <PasswordRevealDialog
                    email={created.staff.email}
                    password={created.temporaryPassword}
                    onClose={() => {
                        const id = created.staff.id;
                        setCreated(null);
                        router.push(`/nhan-vien/${id}`);
                    }}
                />
            )}
        </>
    );
}
