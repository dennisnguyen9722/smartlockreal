// Thử kết nối realtime. Cách chạy: node apps/api/scripts/realtime-smoke.cjs [url]
const { io } = require('socket.io-client');
const { RealtimeEvent } = require('@ktm/shared');

const url = process.argv[2] ?? 'http://localhost:4000/realtime';
const socket = io(url, { transports: ['websocket'] });

socket.on('connect', async () => {
  console.log('✅ Đã kết nối:', socket.id);
  const reply = await socket.timeout(3000).emitWithAck(RealtimeEvent.SYSTEM_PING, { from: 'smoke-test' });
  console.log('✅ Phản hồi ping:', reply);
});

socket.on(RealtimeEvent.NOTIFICATION_NEW, (payload) => {
  console.log('✅ Nhận thông báo:', payload);
});

socket.on('connect_error', (error) => {
  console.error('❌ Lỗi kết nối:', error.message);
  process.exit(1);
});

setTimeout(() => {
  socket.close();
  process.exit(0);
}, 2000);
