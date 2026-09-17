import { RealtimePanel } from '@/components/realtime-panel';

// Trang tạm để kiểm tra khung. Giao diện thật sẽ làm ở Bước 12.
export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight">Trang quản trị</h1>
      <RealtimePanel />
    </main>
  );
}
