'use client';

import { useState } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@ktm/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ktm/ui/components/dialog';

/**
 * Hiện mật khẩu tạm MỘT lần (API không lưu lại, đóng hộp thoại là mất).
 * Có sẵn đoạn tin nhắn để gửi nhân viên qua Zalo.
 */
export function PasswordRevealDialog({
    email,
    password,
    onClose,
}: {
    email: string;
    password: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState<'password' | 'message' | null>(null);
    const loginUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const message = [
        `Tài khoản CMS Khóa Thông Minh`,
        `Trang đăng nhập: ${loginUrl}`,
        `Email: ${email}`,
        `Mật khẩu tạm: ${password}`,
        `Đăng nhập xong vui lòng đổi mật khẩu ở mục "Tài khoản của tôi" (bấm vào tên ở góc phải).`,
    ].join('\n');

    async function copy(text: string, kind: 'password' | 'message') {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(kind);
            toast.success('Đã sao chép');
        } catch {
            toast.error('Trình duyệt chặn sao chép, hãy chép tay');
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Mật khẩu tạm</DialogTitle>
                    <DialogDescription>
                        Của <strong>{email}</strong>. Gửi cho nhân viên qua kênh riêng (Zalo, gặp trực tiếp).
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
                        <code className="flex-1 text-center font-mono text-xl tracking-wider select-all">{password}</code>
                        <Button variant="ghost" size="sm" onClick={() => copy(password, 'password')} aria-label="Sao chép mật khẩu">
                            {copied === 'password' ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => copy(message, 'message')}>
                        {copied === 'message' ? <Check className="size-4" /> : <Copy className="size-4" />}
                        Sao chép tin nhắn gửi nhân viên
                    </Button>
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        Mật khẩu chỉ hiện lần này. Đóng lại là không xem được nữa; quên thì đặt lại mật khẩu mới.
                    </p>
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>Đã lưu mật khẩu, đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
