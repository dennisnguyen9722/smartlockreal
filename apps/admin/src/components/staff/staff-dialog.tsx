'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
    STAFF_ROLES,
    STAFF_ROLE_HINT,
    STAFF_ROLE_LABEL,
    StaffCreateSchema,
    StaffUpdateSchema,
    formatVnPhone,
    type StaffDetail,
    type StaffPasswordResult,
    type StaffRoleCode,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ktm/ui/components/dialog';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation } from '@/lib/hooks';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

/**
 * Thêm nhân viên (staff = null) hoặc sửa thông tin.
 * Tạo mới mặc định để hệ thống tạo mật khẩu tạm; onCreated nhận mật khẩu để hiện một lần.
 */
export function StaffDialog({
    staff,
    onClose,
    onCreated,
}: {
    staff: StaffDetail | null;
    onClose: () => void;
    onCreated?: (result: StaffPasswordResult) => void;
}) {
    const [email, setEmail] = useState(staff?.email ?? '');
    const [fullName, setFullName] = useState(staff?.fullName ?? '');
    const [phone, setPhone] = useState(staff?.phone ? formatVnPhone(staff.phone) : '');
    const [role, setRole] = useState<StaffRoleCode>(staff?.role ?? 'SALE_STAFF');
    const [ownPassword, setOwnPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const isSelf = staff?.isSelf ?? false;

    const save = useApiMutation<StaffDetail | StaffPasswordResult, Record<string, unknown>>(
        (body) => (staff ? { path: `/staff/${staff.id}`, method: 'PATCH', body } : { path: '/staff', method: 'POST', body }),
        {
            invalidate: [['staff']],
            onSuccess: (result) => {
                if (!staff) {
                    toast.success('Đã tạo tài khoản');
                    onCreated?.(result as StaffPasswordResult);
                } else {
                    const saved = result as StaffDetail;
                    toast.success(saved.role !== staff.role ? 'Đã đổi vai trò. Nhân viên phải đăng nhập lại' : 'Đã lưu');
                }
                onClose();
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    toast.error('Có người vừa sửa nhân viên này. Đóng lại rồi mở lại để xem bản mới nhất.');
                    return;
                }
                const fields = apiFieldErrors(error);
                if (fields) setErrors(fields);
                else toast.error(errorText(error));
            },
        },
    );

    function submit() {
        const body: Record<string, unknown> = staff
            ? { email: email.trim(), fullName: fullName.trim(), phone, ...(isSelf ? {} : { role }), expectedUpdatedAt: staff.updatedAt }
            : { email: email.trim(), fullName: fullName.trim(), phone, role, ...(ownPassword ? { password } : {}) };
        const parsed = (staff ? StaffUpdateSchema : StaffCreateSchema).safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors([...parsed.error.issues]));
            return;
        }
        setErrors({});
        save.mutate(body);
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{staff ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên'}</DialogTitle>
                    <DialogDescription>
                        {staff ? 'Đổi vai trò thì nhân viên bị đăng xuất khỏi mọi máy để nhận quyền mới.' : 'Nhân viên đăng nhập CMS bằng email này.'}
                    </DialogDescription>
                </DialogHeader>
                <fieldset disabled={save.isPending} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Họ tên *</Label>
                        <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus />
                        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Email đăng nhập *</Label>
                            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@khoathongminh.vn" />
                            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Số điện thoại</Label>
                            <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
                            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Vai trò</Label>
                        {isSelf ? (
                            <p className="text-sm text-muted-foreground">
                                {STAFF_ROLE_LABEL[role]} · không tự đổi vai trò của chính mình
                            </p>
                        ) : (
                            STAFF_ROLES.map((item) => (
                                <label key={item} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary">
                                    <input type="radio" name="role" checked={role === item} onChange={() => setRole(item)} className="mt-0.5" />
                                    <span>
                                        <span className="font-medium">{STAFF_ROLE_LABEL[item]}</span>
                                        <span className="block text-xs text-muted-foreground">{STAFF_ROLE_HINT[item]}</span>
                                    </span>
                                </label>
                            ))
                        )}
                    </div>

                    {!staff && (
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={ownPassword} onChange={(event) => setOwnPassword(event.target.checked)} className="size-4" />
                                Tự đặt mật khẩu (bỏ trống thì hệ thống tạo mật khẩu tạm)
                            </label>
                            {ownPassword && (
                                <>
                                    <Input type="text" value={password} onChange={(event) => setPassword(event.target.value)} className="font-mono" autoComplete="new-password" />
                                    {errors.password ? (
                                        <p className="text-xs text-destructive">{errors.password}</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Ít nhất 12 ký tự, có chữ hoa, chữ thường và chữ số</p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </fieldset>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={save.isPending}>
                        Hủy
                    </Button>
                    <Button onClick={submit} disabled={save.isPending}>
                        {save.isPending ? 'Đang lưu...' : staff ? 'Lưu' : 'Tạo tài khoản'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
