'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, LogOut, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PASSWORD_MIN_LENGTH, STAFF_ROLE_LABEL, checkPasswordStrength, type StaffRoleCode, type StaffSessionItem } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { SessionList } from '@/components/staff/session-list';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';

/** Yêu cầu hiện ngay dưới ô mật khẩu mới, tick xanh khi đạt (khớp checkPasswordStrength) */
const RULES: { label: string; test: (value: string) => boolean }[] = [
    { label: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`, test: (value) => value.length >= PASSWORD_MIN_LENGTH },
    { label: 'Có chữ hoa', test: (value) => /[A-Z]/.test(value) },
    { label: 'Có chữ thường', test: (value) => /[a-z]/.test(value) },
    { label: 'Có chữ số', test: (value) => /[0-9]/.test(value) },
];

export default function MyAccountPage() {
    const { staff, logout } = useAuth();
    const queryClient = useQueryClient();
    const sessions = useApiQuery<StaffSessionItem[]>(['staff', 'me', 'sessions'], '/staff/me/sessions', { refetchOnMount: 'always' });

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [show, setShow] = useState(false);
    const [error, setError] = useState('');
    const [confirmOthers, setConfirmOthers] = useState(false);
    const [revoking, setRevoking] = useState<StaffSessionItem | null>(null);

    const change = useApiMutation<void, { currentPassword: string; newPassword: string }>(
        (body) => ({ path: '/auth/change-password', method: 'POST', body }),
        {
            onSuccess: async () => {
                // Đổi mật khẩu thu hồi MỌI phiên, kể cả máy đang dùng -> đăng nhập lại bằng mật khẩu mới
                toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới');
                await logout();
            },
            onError: (apiError) => {
                if (apiError instanceof ApiError && apiError.code === 'INVALID_CREDENTIALS') {
                    setError('Mật khẩu hiện tại không đúng');
                    return;
                }
                setError(errorText(apiError));
            },
        },
    );

    const revokeOthers = useApiMutation<{ revoked: number }, void>(() => ({ path: '/staff/me/sessions', method: 'DELETE' }), {
        onSuccess: (result) => {
            setConfirmOthers(false);
            toast.success(`Đã đăng xuất ${result.revoked} phiên khác`);
            void queryClient.invalidateQueries({ queryKey: ['staff', 'me', 'sessions'] });
        },
        onError: (apiError) => toast.error(errorText(apiError)),
    });
    const revokeOne = useApiMutation<void, string>((id) => ({ path: `/staff/me/sessions/${id}`, method: 'DELETE' }), {
        onSuccess: () => {
            setRevoking(null);
            toast.success('Đã đăng xuất phiên');
            void queryClient.invalidateQueries({ queryKey: ['staff', 'me', 'sessions'] });
        },
        onError: (apiError) => {
            setRevoking(null);
            toast.error(errorText(apiError));
        },
    });

    function submit() {
        setError('');
        const strength = checkPasswordStrength(newPassword);
        if (!currentPassword) return setError('Nhập mật khẩu hiện tại');
        if (!strength.valid) return setError(strength.errors.join('. '));
        if (newPassword !== confirmPassword) return setError('Mật khẩu nhập lại không khớp');
        if (newPassword === currentPassword) return setError('Mật khẩu mới phải khác mật khẩu hiện tại');
        change.mutate({ currentPassword, newPassword });
    }

    const others = (sessions.data ?? []).filter((session) => !session.isCurrent).length;

    return (
        <>
            <PageHeader title="Tài khoản của tôi" description={staff ? `${staff.fullName} · ${STAFF_ROLE_LABEL[staff.role as StaffRoleCode] ?? staff.role}` : undefined} />

            <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Card className="self-start">
                    <CardHeader>
                        <CardTitle>Đổi mật khẩu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <fieldset disabled={change.isPending} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Mật khẩu hiện tại</Label>
                                <Input type={show ? 'text' : 'password'} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label>Mật khẩu mới</Label>
                                    <button type="button" onClick={() => setShow((value) => !value)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                        {show ? 'Ẩn' : 'Hiện'} mật khẩu
                                    </button>
                                </div>
                                <Input type={show ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
                                <ul className="grid grid-cols-2 gap-1 pt-1 text-xs">
                                    {RULES.map((rule) => {
                                        const ok = rule.test(newPassword);
                                        return (
                                            <li key={rule.label} className={ok ? 'flex items-center gap-1 text-green-700 dark:text-green-400' : 'flex items-center gap-1 text-muted-foreground'}>
                                                {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                                                {rule.label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Nhập lại mật khẩu mới</Label>
                                <Input type={show ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                            <Button onClick={submit} disabled={change.isPending}>
                                {change.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
                            </Button>
                            <p className="text-xs text-muted-foreground">Đổi xong bạn sẽ bị đăng xuất khỏi mọi máy, kể cả máy này.</p>
                        </fieldset>
                    </CardContent>
                </Card>

                <Card className="self-start">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Máy đang đăng nhập</CardTitle>
                        {others > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setConfirmOthers(true)} disabled={revokeOthers.isPending}>
                                <LogOut className="size-4" />
                                Đăng xuất {others} phiên khác
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {sessions.isPending ? (
                            <LoadingRows rows={3} />
                        ) : sessions.isError ? (
                            <ErrorState message={sessions.error.message} />
                        ) : (
                            <SessionList sessions={sessions.data} onRevoke={setRevoking} busy={revokeOne.isPending} />
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">Thấy máy lạ thì đăng xuất máy đó rồi đổi mật khẩu.</p>
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                open={confirmOthers}
                onOpenChange={setConfirmOthers}
                title="Đăng xuất các phiên khác"
                description={`Đăng xuất ${others} phiên trên các máy khác? Máy đang dùng vẫn giữ đăng nhập.`}
                confirmLabel="Đăng xuất"
                loading={revokeOthers.isPending}
                onConfirm={() => revokeOthers.mutate()}
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
