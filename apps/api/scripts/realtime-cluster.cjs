// Thử thông báo giữa 2 instance API.
// Cách chạy: node apps/api/scripts/realtime-cluster.cjs [urlA] [urlB]
const { io } = require('socket.io-client');
const { RealtimeEvent } = require('@ktm/shared');

const [urlA = 'http://localhost:4000/realtime', urlB = 'http://localhost:4001/realtime'] =
  process.argv.slice(2);
const portOf = (url) => new URL(url).port;

const a = io(urlA, { transports: ['websocket'] });
const b = io(urlB, { transports: ['websocket'] });

const fail = (message) => {
  console.error('❌', message);
  process.exit(1);
};

a.on('connect_error', (e) => fail(`Client A (cổng ${portOf(urlA)}): ${e.message}`));
b.on('connect_error', (e) => fail(`Client B (cổng ${portOf(urlB)}): ${e.message}`));

b.on(RealtimeEvent.NOTIFICATION_NEW, (payload) => {
  if (payload.type !== 'broadcast-test') return; // bỏ qua thông báo chào
  console.log(`✅ Client B (cổng ${portOf(urlB)}) nhận thông báo phát từ instance cổng ${payload.fromPort}`);
  process.exit(0);
});

const connected = (socket) => new Promise((resolve) => socket.on('connect', resolve));

Promise.all([connected(a), connected(b)]).then(async () => {
  const reply = await a.timeout(3000).emitWithAck(RealtimeEvent.SYSTEM_PING, {});
  console.log(`✅ Tổng số client trên toàn cụm: ${reply.totalClients} (hỏi từ instance cổng ${reply.instancePort})`);
  a.emit('system:broadcast-test');
  console.log(`→ Client A (cổng ${portOf(urlA)}) đã yêu cầu phát thông báo`);
});

setTimeout(() => fail('Hết 5 giây mà client B không nhận được thông báo'), 5000);
