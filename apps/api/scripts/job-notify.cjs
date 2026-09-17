// Thử luồng: client -> API thêm job -> worker xử lý -> thông báo realtime về client.
// Cách chạy: node apps/api/scripts/job-notify.cjs [http://localhost:4000]
const { io } = require('socket.io-client');
const { REALTIME_NAMESPACE, RealtimeEvent } = require('@ktm/shared');

const base = process.argv[2] ?? 'http://localhost:4000';
const socket = io(base + REALTIME_NAMESPACE, { transports: ['websocket'] });

const fail = (message) => {
  console.error('❌', message);
  process.exit(1);
};

socket.on('connect_error', (error) => fail(`Lỗi kết nối: ${error.message}`));

socket.on(RealtimeEvent.JOB_COMPLETED, (payload) => {
  console.log('✅ Nhận kết quả job qua realtime:', payload);
  process.exit(0);
});

socket.on('connect', async () => {
  console.log('✅ Đã kết nối:', socket.id);
  const res = await fetch(`${base}/api/v1/dev/system-jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ notifySocketId: socket.id }),
  });
  console.log(`→ API trả về HTTP ${res.status}:`, await res.json());
});

setTimeout(() => fail('Hết 5 giây mà không nhận được kết quả job'), 5000);
