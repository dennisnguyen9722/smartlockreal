import { connection } from 'next/server';
import { formatVnd } from '@ktm/shared';
import { cn } from '@ktm/ui/lib/utils';

interface Health {
    status: string;
    database: string;
    databaseLatencyMs: number;
}

async function getHealth(): Promise<Health | null> {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, { cache: 'no-store' });
        return res.ok ? ((await res.json()) as Health) : null;
    } catch (error) {
        console.error('[web] Không gọi được API:', error);
        return null;
    }
}

// Trang tạm để kiểm tra khung. Giao diện thật sẽ làm ở Bước 12.
export default async function HomePage() {
    await connection(); // render theo từng request, không render sẵn lúc build
    const health = await getHealth();

    return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
            <h1 className="text-3xl font-bold tracking-tight">Khóa Thông Minh Chính Hãng</h1>
            <p className="text-muted-foreground">Ví dụ định dạng giá: {formatVnd(12_500_000)}</p>
            <p
                className={cn(
                    'inline-block rounded-lg px-3 py-1 text-sm font-medium',
                    health ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white',
                )}
            >
                API:{' '}
                {health
                    ? `✅ ${health.status}, database ${health.database} (${health.databaseLatencyMs}ms)`
                    : '❌ không kết nối được'}
            </p>
        </main>
    );
}