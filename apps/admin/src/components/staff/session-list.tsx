'use client';

import { Laptop, LogOut, Smartphone, Terminal } from 'lucide-react';
import { describeUserAgent, type StaffSessionItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { formatDateTimeVn } from '@/lib/order-types';

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
    if (userAgent && /curl|node/i.test(userAgent)) return <Terminal className="size-4 text-muted-foreground" />;
    if (userAgent && /iPhone|Android|Mobile/.test(userAgent)) return <Smartphone className="size-4 text-muted-foreground" />;
    return <Laptop className="size-4 text-muted-foreground" />;
}

/** Danh sách phiên đăng nhập đang mở, mỗi dòng một thiết bị */
export function SessionList({
    sessions,
    onRevoke,
    busy,
}: {
    sessions: StaffSessionItem[];
    onRevoke?: (session: StaffSessionItem) => void;
    busy?: boolean;
}) {
    if (sessions.length === 0) return <p className="text-sm text-muted-foreground">Không có phiên nào đang mở.</p>;
    return (
        <ul className="divide-y rounded-lg border">
            {sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <DeviceIcon userAgent={session.userAgent} />
                    <div className="min-w-48 flex-1">
                        <p className="flex items-center gap-2 font-medium">
                            {describeUserAgent(session.userAgent)}
                            {session.isCurrent && <Badge>Máy đang dùng</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            IP {session.ipAddress ?? '—'} · đăng nhập {formatDateTimeVn(session.signedInAt)} · dùng lần cuối{' '}
                            {formatDateTimeVn(session.lastUsedAt)}
                        </p>
                    </div>
                    {onRevoke && !session.isCurrent && (
                        <Button variant="ghost" size="sm" onClick={() => onRevoke(session)} disabled={busy}>
                            <LogOut className="size-4" />
                            Đăng xuất
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    );
}
