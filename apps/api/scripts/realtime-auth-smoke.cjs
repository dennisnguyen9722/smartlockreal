// Thử xác thực kết nối realtime.
// Chạy: node --env-file=.env apps/api/scripts/realtime-auth-smoke.cjs <email> <mật khẩu>
const { io } = require('socket.io-client');
const { REALTIME_NAMESPACE, RealtimeEvent } = require('@ktm/shared');

const BASE = 'http://localhost:4000';
const [email, password] = process.argv.slice(2);

function connect(label, token) {
  return new Promise((resolve) => {
    const socket = io(`${BASE}${REALTIME_NAMESPACE}`, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
    });
    let reason = null;

    socket.on('auth:error', (payload) => {
      reason = payload.reason;
    });
    socket.on('connect', () => {
      // Server ngắt ngay nếu token sai; đợi một nhịp rồi mới kết luận
      setTimeout(() => {
        const ok = socket.connected;
        console.log(ok ? `✅ ${label}: kết nối được` : `✅ ${label}: bị từ chối (${reason})`);
        socket.disconnect();
        resolve(ok);
      }, 300);
    });
    socket.on('connect_error', (error) => {
      console.log(`✅ ${label}: không kết nối được (${error.message})`);
      resolve(false);
    });
  });
}

(async () => {
  await connect('Không có token', null);
  await connect('Token bịa', 'khong-phai-token');

  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.error('❌ Đăng nhập thất bại:', res.status, await res.text());
    process.exit(1);
  }
  const { accessToken, staff } = await res.json();
  console.log(`→ Đăng nhập: ${staff.email} (${staff.role})`);

  const connected = await connect('Token hợp lệ', accessToken);
  if (!connected) process.exit(1);

  // Kết nối lại và chờ nhận thông báo gửi tới phòng của chính mình
  const socket = io(`${BASE}${REALTIME_NAMESPACE}`, {
    transports: ['websocket'],
    auth: { token: accessToken },
  });
  socket.on(RealtimeEvent.JOB_COMPLETED, (payload) => {
    console.log('✅ Nhận thông báo job qua phòng staff:', payload);
    socket.disconnect();
    process.exit(0);
  });
  socket.on('connect', async () => {
    const jobRes = await fetch(`${BASE}/api/v1/dev/system-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ notifySocketId: `staff:${staff.id}` }),
    });
    console.log(`→ Thêm job: HTTP ${jobRes.status}`);
  });

  setTimeout(() => {
    console.error('❌ Hết 5 giây mà không nhận được thông báo');
    process.exit(1);
  }, 5000);
})().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
