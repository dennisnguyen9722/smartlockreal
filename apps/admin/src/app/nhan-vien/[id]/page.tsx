'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Lock, LogOut, Pencil, Trash2, Unlock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    STAFF_ROLE_HINT,
    STAFF_ROLE_LABEL,
    formatVnPhone,
    type StaffDetail,
    type StaffPasswordResult,
    type StaffSessionItem,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { PasswordRevealDialog } from '@/components/staff/password-reveal-dialog';
import { SessionList } from '@/components/staff/session-list';
import { StaffDialog } from '@/components/staff/staff-dialog';
import { StaffStatusBadge } from '@/components/staff/staff-status-badge';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

type Confirm = 'DISABLE' | 'RESET' | 'REVOKE_ALL' | 'DELETE' | null;

const back = (
    <Link href="/nhan-vien">
        <Button variant="outline">
            <ArrowLeft className="size-4" />
            Danh sách
        </Button>
    </Link>
);

export default function StaffDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { can } = useAuth();
    const allowed = can('staff.manage');
    const queryClient = useQueryClient();
    const query = useApiQuery<StaffDetail>(['staff', id], `/staff/${id}`, { enabled: allowed, refetchOnMount: 'always' });

    const [editing, setEditing] = useState(false);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [revealed, setRevealed] = useState<StaffPasswordResult | null>(null);
    const [revoking, setRevoking] = useState<StaffSessionItem | null>(null);

    const setData = (data: StaffDetail) => {
        queryClient.setQueryData(['staff', id], data);
        void queryClient.invalidateQueries({ queryKey: ['staff'], exact: true });
    };
    const onError = (error: Error) => {
        setConfirm(null);
        if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
            toast.error('Có người vừa sửa nhân viên này, đã tải lại');
            void query.refetch();
            return;
        }
        toast.error(errorText(error));
    };

    const status = useApiMutation<StaffDetail, 'DISABLE' | 'ENABLE' | 'UNLOCK'>(
        (action) => ({ path: `/staff/${id}/status`, method: 'POST', body: { action, expectedUpdatedAt: query.data?.updatedAt } }),
        {
            onSuccess: (data, action) => {
                setData(data);
                setConfirm(null);
                toast.success(action === 'DISABLE' ? 'Đã khóa tài khoản, nhân viên bị đăng xuất khỏi mọi máy' : action === 'ENABLE' ? 'Đã mở lại tài khoản' : 'Đã gỡ khóa tạm');
            },
            onError,
        },
    );
    const reset = useApiMutation<StaffPasswordResult, void>(() => ({ path: `/staff/${id}/reset-password`, method: 'POST', body: {} }), {
        onSuccess: (result) => {
            setData(result.staff);
            setConfirm(null);
            setRevealed(result);
        },
        onError,
    });
    const revokeAll = useApiMutation<StaffDetail, void>(() => ({ path: `/staff/${id}/revoke-sessions`, method: 'POST' }), {
        onSuccess: (data) => {
            setData(data);
            setConfirm(null);
            toast.success('Đã đăng xuất khỏi mọi máy');
        },
        onError,
    });
    const remove = useApiMutation<void, void>(() => ({ path: `/staff/${id}`, method: 'DELETE' }), {
        invalidate: [['staff']],
        onSuccess: () => {
            toast.success('Đã xóa tài khoản');
            router.replace('/nhan-vien');
        },
        onError: (error) => {
            setConfirm(null);
            toast.error(errorText(error));
        },
    });
    const revokeOne = useApiMutation<void, string>((sessionId) => ({ path: `/staff/sessions/${sessionId}`, method: 'DELETE' }), {
        onSuccess: () => {
            setRevoking(null);
            toast.success('Đã đăng xuất phiên');
            void query.refetch();
        },
        onError: (error) => {
            setRevoking(null);
            toast.error(errorText(error));
        },
    });

    if (!allowed) return <EmptyState message="Chỉ quản trị mới quản lý nhân viên" action={back} />;
    if (query.isPending) {
        return (
            <>
                <PageHeader title="Nhân viên" actions={back} />
                <LoadingRows rows={6} />
            </>
        );
    }
    if (query.isError) {
        const notFound = query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Nhân viên" actions={back} />
                {notFound ? <EmptyState message="Không tìm thấy nhân viên" action={back} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }

    const staff = query.data;
    // Chưa từng đăng nhập và chưa có chứng từ nào -> còn xóa hẳn được (API kiểm tra lại lần nữa)
    const neverUsed =
        !staff.isSelf && !staff.lastLoginAt && staff.stats.orders === 0 && staff.stats.quotes === 0 && staff.stats.customers === 0;
    const busy = status.isPending || reset.isPending || revokeAll.isPending || remove.isPending;

    return (
        <>
            <PageHeader title={staff.fullName} description={staff.email} actions={back} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-4">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Thông tin</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                                <Pencil className="size-4" />
                                Sửa
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                            <p>
                                <span className="text-muted-foreground">Email đăng nhập: </span>
                                {staff.email}
                            </p>
                            <p>
                                <span className="text-muted-foreground">Điện thoại: </span>
                                {staff.phone ? formatVnPhone(staff.phone) : '—'}
                            </p>
                            <p className="sm:col-span-2">
                                <span className="text-muted-foreground">Vai trò: </span>
                                <strong>{STAFF_ROLE_LABEL[staff.role]}</strong>
                                <span className="block text-xs text-muted-foreground">{STAFF_ROLE_HINT[staff.role]}</span>
                            </p>
                            <p>
                                <span className="text-muted-foreground">Tạo lúc: </span>
                                {formatDateTimeVn(staff.createdAt)}
                            </p>
                            <p>
                                <span className="text-muted-foreground">Đăng nhập gần nhất: </span>
                                {staff.lastLoginAt ? formatDateTimeVn(staff.lastLoginAt) : 'Chưa đăng nhập'}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Phiên đăng nhập đang mở ({staff.sessions.length})</CardTitle>
                            {!staff.isSelf && staff.sessions.length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setConfirm('REVOKE_ALL')} disabled={busy}>
                                    <LogOut className="size-4" />
                                    Đăng xuất tất cả
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <SessionList sessions={staff.sessions} onRevoke={staff.isSelf ? undefined : setRevoking} busy={revokeOne.isPending} />
                            {staff.isSelf && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Phiên của chính bạn quản lý ở{' '}
                                    <Link href="/tai-khoan" className="text-primary hover:underline">
                                        Tài khoản của tôi
                                    </Link>
                                    .
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Trạng thái <StaffStatusBadge staff={staff} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {staff.lockedUntil && (
                                <>
                                    <p className="text-xs text-muted-foreground">
                                        Nhập sai mật khẩu nhiều lần, tự mở lúc {formatDateTimeVn(staff.lockedUntil)}.
                                    </p>
                                    <Button variant="outline" className="w-full" onClick={() => status.mutate('UNLOCK')} disabled={busy}>
                                        <Unlock className="size-4" />
                                        Gỡ khóa tạm ngay
                                    </Button>
                                </>
                            )}
                            {staff.isSelf ? (
                                <p className="text-xs text-muted-foreground">
                                    Không tự khóa hay đặt lại mật khẩu của chính mình. Đổi mật khẩu ở{' '}
                                    <Link href="/tai-khoan" className="text-primary hover:underline">
                                        Tài khoản của tôi
                                    </Link>
                                    .
                                </p>
                            ) : (
                                <>
                                    <Button variant="outline" className="w-full" onClick={() => setConfirm('RESET')} disabled={busy || staff.status === 'DISABLED'}>
                                        <KeyRound className="size-4" />
                                        Đặt lại mật khẩu
                                    </Button>
                                    {staff.status === 'ACTIVE' ? (
                                        <Button variant="outline" className="w-full text-destructive" onClick={() => setConfirm('DISABLE')} disabled={busy}>
                                            <Lock className="size-4" />
                                            Khóa tài khoản
                                        </Button>
                                    ) : (
                                        <Button className="w-full" onClick={() => status.mutate('ENABLE')} disabled={busy}>
                                            <Unlock className="size-4" />
                                            Mở lại tài khoản
                                        </Button>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Công việc</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                            <p>{staff.stats.orders} đơn hàng đã tạo hoặc phụ trách</p>
                            <p>{staff.stats.quotes} báo giá đã lập</p>
                            <p>{staff.stats.customers} khách hàng đang phụ trách</p>
                            {staff.isSelf ? (
                                <p className="pt-2 text-xs text-muted-foreground">Chứng từ trên cần giữ người thực hiện nên tài khoản không xóa được.</p>
                            ) : neverUsed ? (
                                <div className="space-y-1.5 pt-2">
                                    <Button variant="outline" className="w-full text-destructive" onClick={() => setConfirm('DELETE')} disabled={busy}>
                                        <Trash2 className="size-4" />
                                        Xóa tài khoản
                                    </Button>
                                    <p className="text-xs text-muted-foreground">
                                        Tài khoản chưa từng đăng nhập và chưa làm gì nên còn xóa được (vd: tạo nhầm email).
                                    </p>
                                </div>
                            ) : (
                                <p className="pt-2 text-xs text-muted-foreground">
                                    Đã đăng nhập và làm việc trên hệ thống nên <strong>không xóa được</strong>: nhật ký, đơn hàng, báo giá
                                    phải giữ được người thực hiện. Nghỉ việc thì <strong>khóa tài khoản</strong>.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {editing && <StaffDialog staff={staff} onClose={() => setEditing(false)} />}
            {revealed?.temporaryPassword && (
                <PasswordRevealDialog email={revealed.staff.email} password={revealed.temporaryPassword} onClose={() => setRevealed(null)} />
            )}

            <ConfirmDialog
                open={confirm === 'DISABLE'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Khóa tài khoản"
                description={
                    <>
                        Khóa tài khoản <strong>{staff.fullName}</strong>? Nhân viên bị đăng xuất khỏi mọi máy ngay và không đăng nhập
                        được nữa. Đơn hàng, báo giá của nhân viên vẫn giữ nguyên; mở lại được bất cứ lúc nào.
                    </>
                }
                confirmLabel="Khóa tài khoản"
                destructive
                loading={status.isPending}
                onConfirm={() => status.mutate('DISABLE')}
            />
            <ConfirmDialog
                open={confirm === 'RESET'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Đặt lại mật khẩu"
                description={
                    <>
                        Tạo mật khẩu tạm mới cho <strong>{staff.fullName}</strong>? Mật khẩu cũ hết dùng được và nhân viên bị đăng xuất
                        khỏi mọi máy. Mật khẩu tạm chỉ hiện một lần.
                    </>
                }
                confirmLabel="Đặt lại mật khẩu"
                loading={reset.isPending}
                onConfirm={() => reset.mutate()}
            />
            <ConfirmDialog
                open={confirm === 'REVOKE_ALL'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Đăng xuất khỏi mọi máy"
                description={
                    <>
                        Đăng xuất <strong>{staff.fullName}</strong> khỏi {staff.sessions.length} phiên đang mở? Nhân viên vẫn đăng nhập lại
                        được bằng mật khẩu hiện tại. Nghi lộ mật khẩu thì nên đặt lại mật khẩu thay vì chỉ đăng xuất.
                    </>
                }
                confirmLabel="Đăng xuất tất cả"
                loading={revokeAll.isPending}
                onConfirm={() => revokeAll.mutate()}
            />
            <ConfirmDialog
                open={confirm === 'DELETE'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Xóa tài khoản"
                description={
                    <>
                        Xóa hẳn tài khoản <strong>{staff.email}</strong>? Thao tác này không hoàn tác được. Nếu tài khoản đã từng
                        đăng nhập hoặc đã làm việc, hệ thống sẽ chặn và bạn nên khóa tài khoản thay vì xóa.
                    </>
                }
                confirmLabel="Xóa tài khoản"
                destructive
                loading={remove.isPending}
                onConfirm={() => remove.mutate()}
            />
            <ConfirmDialog
                open={revoking !== null}
                onOpenChange={(open) => !open && setRevoking(null)}
                title="Đăng xuất phiên"
                description="Máy này sẽ phải đăng nhập lại."
                confirmLabel="Đăng xuất"
                loading={revokeOne.isPending}
                onConfirm={() => revoking && revokeOne.mutate(revoking.id)}
            />
        </>
    );
}