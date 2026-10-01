/**
 * Chuyển toàn bộ sản phẩm đang ở trạng thái Nháp sang Đang bán.
 *
 * CHẠY:
 *   cd apps/api
 *   node scripts/dang-ban-hang-loat.mjs --email admin@ktm.vn --password 'mat-khau' --thu
 *   node scripts/dang-ban-hang-loat.mjs --email admin@ktm.vn --password 'mat-khau'
 *
 * Tùy chọn:
 *   --api <url>   Mặc định http://localhost:4000/api/v1
 *   --thu         Chỉ liệt kê sản phẩm sẽ đăng bán, KHÔNG đổi gì
 *
 * Hệ thống chỉ cho đăng bán khi sản phẩm đủ điều kiện: có biến thể đang bật và
 * có giá, có ít nhất một ảnh, hãng và danh mục đang bật, thông số bắt buộc đủ.
 * Sản phẩm nào chưa đủ sẽ được liệt kê kèm lý do, phần còn lại vẫn đăng bình thường.
 */

import process from 'node:process';

const argv = process.argv.slice(2);
const flags = {};
for (let i = 0; i < argv.length; i += 1) {
  if (!argv[i].startsWith('--')) continue;
  const name = argv[i].slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith('--')) { flags[name] = next; i += 1; } else { flags[name] = true; }
}

const API = (flags.api || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const EMAIL = flags.email;
const PASSWORD = flags.password;
const DRY = Boolean(flags.thu);

if (!EMAIL || !PASSWORD) {
  console.error('Thiếu tham số.');
  console.error("  node scripts/dang-ban-hang-loat.mjs --email <email> --password '<mật khẩu>' [--thu]");
  process.exit(1);
}

let token = '';

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.accessToken) throw new Error(`Đăng nhập thất bại: ${data.message || res.status}`);
  token = data.accessToken;
}

/** Token sống 15 phút; gặp 401 thì đăng nhập lại một lần rồi thử lại */
async function call(pathname, options = {}, retried = false) {
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${API}${pathname}`, { ...options, headers });
  if (res.status === 401 && !retried) {
    await login();
    return call(pathname, options, true);
  }
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

/** Gom mọi thông báo lỗi mà API trả về, dù ở dạng mảng hay một object */
function reasonsOf(body) {
  const d = body?.details;
  if (Array.isArray(d)) return d.map((i) => i.message ?? JSON.stringify(i));
  if (d && typeof d === 'object') return [d.hint ?? d.message ?? JSON.stringify(d)];
  return [body?.message ?? 'lỗi không rõ'];
}

async function main() {
  await login();

  const drafts = [];
  let page = 1;
  for (;;) {
    const res = await call(`/catalog/products?status=DRAFT&page=${page}&pageSize=100`);
    if (!res.ok) throw new Error(`Không lấy được danh sách: ${JSON.stringify(res.body)}`);
    const items = res.body.items ?? [];
    drafts.push(...items);
    if (drafts.length >= (res.body.total ?? 0) || items.length === 0) break;
    page += 1;
  }

  console.log(`Sản phẩm đang ở trạng thái Nháp: ${drafts.length}`);
  if (drafts.length === 0) { console.log('Không có gì để đăng bán.'); return; }

  if (DRY) {
    for (const p of drafts.slice(0, 30)) console.log(`   ${p.name}`);
    if (drafts.length > 30) console.log(`   ... còn ${drafts.length - 30} sản phẩm`);
    console.log('\nChế độ xem trước, chưa đổi gì. Bỏ --thu để chạy thật.');
    return;
  }

  console.log('\nĐang đăng bán...');
  let done = 0;
  const failures = [];

  for (const [index, product] of drafts.entries()) {
    const res = await call(`/catalog/products/${product.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (res.ok) done += 1;
    else failures.push({ name: product.name, reasons: reasonsOf(res.body) });

    if ((index + 1) % 20 === 0 || index === drafts.length - 1) {
      process.stdout.write(`\r  ${index + 1}/${drafts.length}  (đăng ${done}, chưa được ${failures.length})   `);
    }
  }

  console.log('\n');
  console.log(`Xong. Đã đăng bán: ${done} | Chưa đăng được: ${failures.length}`);

  if (failures.length > 0) {
    // Gom theo lý do, vì thường vài chục sản phẩm vướng cùng một nguyên nhân
    const byReason = new Map();
    for (const f of failures) {
      for (const r of f.reasons) {
        if (!byReason.has(r)) byReason.set(r, []);
        byReason.get(r).push(f.name);
      }
    }
    console.log('');
    for (const [reason, names] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`${names.length} sản phẩm: ${reason}`);
      for (const n of names.slice(0, 8)) console.log(`     ${n}`);
      if (names.length > 8) console.log(`     ... còn ${names.length - 8}`);
    }
  }
}

main().catch((error) => {
  console.error('\n' + error.message);
  process.exit(1);
});
