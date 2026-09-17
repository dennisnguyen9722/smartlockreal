import { connection } from 'next/server';
import { formatVnd } from '@ktm/shared';

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
        <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
            <h1>Khóa Thông Minh Chính Hãng</h1>
            <p>Ví dụ định dạng giá: {formatVnd(12_500_000)}</p>
            <p>
                API:{' '}
                {health
                    ? `✅ ${health.status}, database ${health.database} (${health.databaseLatencyMs}ms)`
                    : '❌ không kết nối được'}
            </p>
        </main>
    );
}