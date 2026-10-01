'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import {
    CONSULT_KIND_LABEL,
    REALTIME_NAMESPACE,
    RealtimeEvent,
    formatVnPhone,
    type ConsultRequestedEvent,
    type OrderCreatedEvent,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { API_URL } from '@/lib/api';
import { formatVnd } from '@/lib/format';

const ALERT_PREFERENCE_KEY = 'ktm:order-alerts';

/** Tiếng "ting ting" hai nốt, tạo bằng Web Audio: không cần file âm thanh */
function playChime(context: AudioContext) {
    const now = context.currentTime;
    for (const [index, frequency] of [880, 1320].entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const start = now + index * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.4);
    }
}

function readPreference(): boolean {
    try {
        return window.localStorage.getItem(ALERT_PREFERENCE_KEY) === 'on';
    } catch {
        return false;
    }
}

function writePreference(on: boolean) {
    try {
        window.localStorage.setItem(ALERT_PREFERENCE_KEY, on ? 'on' : 'off');
    } catch {
        // Trình duyệt chặn lưu trữ: chỉ mất phần ghi nhớ lựa chọn
    }
}

/**
 * Nhận việc mới qua Socket.IO:
 * - Đơn mới (cần quyền order.view): danh sách đơn tự cập nhật; đơn khách tự đặt
 *   trên web thì có thông báo nổi + chuông + thông báo hệ điều hành.
 * - Yêu cầu tư vấn mới (cần quyền customer.view): y như trên, kèm sẵn số điện
 *   thoại để nhân viên bấm gọi ngay.
 *
 * Mỗi loại thông báo tự kiểm quyền riêng: người chỉ có quyền xem khách vẫn nhận
 * được yêu cầu tư vấn mà không thấy gì về đơn hàng.
 *
 * Trình duyệt chặn tự phát âm thanh khi người dùng chưa tương tác, nên cần bấm "Bật chuông" một lần.
 */
export function RealtimeStatus() {
    const { accessToken, authFetch, can } = useAuth();
    const queryClient = useQueryClient();
    const router = useRouter();
    const canViewOrders = can('order.view');
    const canViewCustomers = can('customer.view');
    // Có ít nhất một loại thông báo thì mới mở kết nối
    const canRealtime = canViewOrders || canViewCustomers;

    const [connected, setConnected] = useState(false);
    const [alertsOn, setAlertsOn] = useState(false);
    const alertsRef = useRef(false);
    const audioRef = useRef<AudioContext | null>(null);

    // Trình duyệt chỉ cho tạo/mở âm thanh trong một thao tác của người dùng
    const unlockAudio = useCallback(() => {
        if (!audioRef.current) audioRef.current = new AudioContext();
        void audioRef.current.resume();
    }, []);

    // Đã bật từ lần trước: mở khóa âm thanh ở lần bấm/chạm đầu tiên trên trang
    useEffect(() => {
        if (!readPreference()) return;
        alertsRef.current = true;
        setAlertsOn(true);
        const handler = () => unlockAudio();
        window.addEventListener('pointerdown', handler, { once: true });
        return () => window.removeEventListener('pointerdown', handler);
    }, [unlockAudio]);

    async function toggleAlerts() {
        const next = !alertsOn;
        alertsRef.current = next;
        setAlertsOn(next);
        writePreference(next);
        if (!next) return;

        unlockAudio();
        if (audioRef.current) playChime(audioRef.current);
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
        toast.success('Đã bật chuông báo việc mới');
    }

    useEffect(() => {
        if (!accessToken || !canRealtime) return;

        // Chỉ WebSocket (không long-polling): chạy nhiều máy chủ API không cần "sticky session"
        const socket = io(`${new URL(API_URL).origin}${REALTIME_NAMESPACE}`, {
            auth: { token: accessToken },
            transports: ['websocket'],
        });

        let everConnected = false;
        socket.on('connect', () => {
            setConnected(true);
            // Kết nối lại sau khi mất mạng: tải lại danh sách để không sót đơn đến trong lúc mất kết nối
            if (everConnected) {
                void queryClient.invalidateQueries({ queryKey: ['orders'] });
                void queryClient.invalidateQueries({ queryKey: ['consult-requests'] });
            }
            everConnected = true;
        });
        socket.on('disconnect', () => setConnected(false));

        // Token hết hạn: gọi một API bất kỳ để authFetch tự làm mới token; token mới sẽ tạo kết nối mới
        socket.on('auth:error', (data: { reason?: string }) => {
            if (data.reason === 'Token hết hạn') void authFetch('/auth/me').catch(() => undefined);
        });

        socket.on(RealtimeEvent.QUOTE_REQUESTED, (event: ConsultRequestedEvent) => {
            if (!canViewCustomers) return;
            void queryClient.invalidateQueries({ queryKey: ['consult-requests'] });

            const sdt = formatVnPhone(event.phone);
            const description = [sdt, event.summary].filter(Boolean).join(' · ');
            toast.success(`${CONSULT_KIND_LABEL[event.kind]} để lại số: ${event.fullName}`, {
                description,
                duration: 20_000,
                action: { label: 'Mở hộp thư', onClick: () => router.push('/yeu-cau') },
            });

            if (alertsRef.current && audioRef.current) playChime(audioRef.current);

            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification(`Yêu cầu tư vấn: ${event.fullName}`, {
                    body: description,
                    tag: event.id,
                });
                notification.onclick = () => {
                    window.focus();
                    router.push('/yeu-cau');
                    notification.close();
                };
            }
        });

        socket.on(RealtimeEvent.ORDER_CREATED, (event: OrderCreatedEvent) => {
            if (!canViewOrders) return;
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            if (event.createdByStaff) return;

            const description = [event.customerName, event.lineSummary, formatVnd(event.grandTotal)]
                .filter(Boolean)
                .join(' · ');
            toast.success(`Đơn mới từ website: ${event.code}`, {
                description,
                duration: 15_000,
                action: { label: 'Xem đơn', onClick: () => router.push(`/don-hang/${event.id}`) },
            });

            if (alertsRef.current && audioRef.current) playChime(audioRef.current);

            // Nhân viên đang ở tab khác: báo bằng thông báo của hệ điều hành
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification(`Đơn mới ${event.code}`, { body: description, tag: event.id });
                notification.onclick = () => {
                    window.focus();
                    router.push(`/don-hang/${event.id}`);
                    notification.close();
                };
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [accessToken, canRealtime, canViewOrders, canViewCustomers, authFetch, queryClient, router]);

    if (!canRealtime) return null;

    return (
        <div className="flex items-center gap-2">
            <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                title={connected ? 'Đang nhận đơn mới và yêu cầu tư vấn theo thời gian thực' : 'Mất kết nối, đang thử kết nối lại'}
            >
                <span className={cn('size-2 rounded-full', connected ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                <span className="hidden sm:inline">{connected ? 'Trực tuyến' : 'Mất kết nối'}</span>
            </span>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void toggleAlerts()}
                aria-label={alertsOn ? 'Tắt chuông báo việc mới' : 'Bật chuông báo việc mới'}
                title={alertsOn ? 'Chuông báo việc mới: đang bật' : 'Bật chuông báo việc mới'}
            >
                {alertsOn ? <Bell className="size-4" /> : <BellOff className="size-4 text-muted-foreground" />}
            </Button>
        </div>
    );
}

