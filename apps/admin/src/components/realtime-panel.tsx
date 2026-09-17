'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { type JobCompletedPayload, REALTIME_NAMESPACE, RealtimeEvent } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';

type Status = 'connecting' | 'connected' | 'disconnected';

const STATUS_LABEL: Record<Status, string> = {
  connecting: 'Đang kết nối...',
  connected: 'Đã kết nối',
  disconnected: 'Mất kết nối',
};

/** Bảng thử nghiệm realtime. Sẽ thay bằng chuông thông báo thật ở Bước 11. */
export function RealtimePanel() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [events, setEvents] = useState<string[]>([]);

  const log = (line: string) =>
    setEvents((prev) => [`${new Date().toLocaleTimeString('vi-VN')}  ${line}`, ...prev].slice(0, 20));

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}${REALTIME_NAMESPACE}`, {
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      log(`Đã kết nối (${socket.id})`);
    });
    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      log(`Mất kết nối: ${reason}`);
    });
    socket.on('connect_error', (error) => {
      setStatus('disconnected');
      log(`Lỗi kết nối: ${error.message}`);
    });
    socket.on(RealtimeEvent.NOTIFICATION_NEW, (payload: { title?: string }) => {
      log(`Thông báo: ${payload.title ?? JSON.stringify(payload)}`);
    });
    socket.on(RealtimeEvent.JOB_COMPLETED, (payload: JobCompletedPayload) => {
      log(`Job #${payload.jobId} (${payload.name}) đã xử lý xong`);
    });

    // Dọn dẹp khi component bị gỡ: đóng kết nối, tránh rò rỉ
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  async function runTestJob() {
    const socketId = socketRef.current?.id;
    if (!socketId) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dev/system-jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notifySocketId: socketId }),
      });
      const body = await res.json();
      log(res.ok ? `Đã gửi job #${body.jobId}` : `API lỗi ${res.status}: ${body.code}`);
    } catch (error) {
      log(`Không gọi được API: ${(error as Error).message}`);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Realtime</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            status === 'connected'
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <Button onClick={() => void runTestJob()} disabled={status !== 'connected'}>
        Chạy job thử
      </Button>

      <ul className="space-y-1 font-mono text-xs text-muted-foreground">
        {events.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
