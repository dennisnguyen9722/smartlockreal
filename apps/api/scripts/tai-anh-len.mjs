/**
 * Tải toàn bộ ảnh trong một thư mục lên hệ thống và gắn vào ĐÚNG biến thể,
 * dựa vào quy ước: TÊN FILE ẢNH = SKU của biến thể.
 *
 *   KL-968-CNC-BLACK-USMART.webp  ->  biến thể có SKU  KL-968-CNC-BLACK-USMART
 *
 * CHẠY:
 *   cd apps/api
 *   node scripts/tai-anh-len.mjs "/Users/dennis/Projects/Sản phẩm WEBP" \
 *     --email admin@ktm.vn --password 'MatKhau@123'
 *
 * Tùy chọn:
 *   --api <url>   Mặc định http://localhost:4000/api/v1
 *   --thu         CHỈ xem trước: đối chiếu ảnh với SKU rồi in kết quả, KHÔNG tải gì lên
 *   --lai         Tải lại cả những ảnh đã gắn rồi (mặc định là bỏ qua)
 *
 * Chạy lại nhiều lần được: ảnh đã gắn thì hệ thống trả 409 và script bỏ qua,
 * ảnh trùng nội dung cũng không lưu hai lần trong thư viện.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* ================================================================== */
/* Tham số                                                             */
/* ================================================================== */

const argv = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) {
    const name = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[name] = next; i += 1; } else { flags[name] = true; }
  } else {
    positional.push(argv[i]);
  }
}

const sourceDir = positional[0];
const API = (flags.api || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const EMAIL = flags.email;
const PASSWORD = flags.password;
const DRY = Boolean(flags.thu);
const REDO = Boolean(flags.lai);

if (!sourceDir || (!DRY && (!EMAIL || !PASSWORD))) {
  console.error('Thiếu tham số.');
  console.error('  node scripts/tai-anh-len.mjs "<thư mục ảnh>" --email <email> --password <mật khẩu>');
  console.error('  Thêm --thu để chỉ xem trước, khi đó không cần email/mật khẩu.');
  process.exit(1);
}
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`Không tìm thấy thư mục: ${sourceDir}`);
  process.exit(1);
}

/* ================================================================== */
/* Gọi API                                                             */
/* ================================================================== */

let token = '';

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.accessToken) {
    throw new Error(`Đăng nhập thất bại: ${data.message || res.status}`);
  }
  token = data.accessToken;
}

/**
 * Gọi API kèm token. Token sống 15 phút, tải 380 ảnh có thể lâu hơn,
 * nên gặp 401 thì đăng nhập lại một lần rồi thử lại.
 */
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

/* ================================================================== */
/* Lấy danh sách sản phẩm và biến thể                                  */
/* ================================================================== */

async function fetchProducts() {
  const products = [];
  let page = 1;
  for (;;) {
    const res = await call(`/catalog/products?status=ALL&page=${page}&pageSize=100`);
    if (!res.ok) throw new Error(`Không lấy được danh sách sản phẩm: ${JSON.stringify(res.body)}`);
    const items = res.body.items ?? [];
    products.push(...items);
    if (products.length >= (res.body.total ?? 0) || items.length === 0) break;
    page += 1;
  }
  return products;
}

/* ================================================================== */
/* Đối chiếu ảnh với SKU                                               */
/* ================================================================== */

const IMAGE_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

/** Tên file -> SKU: bỏ đuôi, khoảng trắng thành gạch ngang, viết hoa */
function skuFromFileName(fileName) {
  const stem = fileName.slice(0, fileName.length - path.extname(fileName).length);
  return stem.trim().replace(/\s+/g, '-').toUpperCase();
}

function listImages() {
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') && IMAGE_EXT.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/* ================================================================== */
/* Tải lên và gắn                                                      */
/* ================================================================== */

async function uploadImage(fileName) {
  const buffer = fs.readFileSync(path.join(sourceDir, fileName));
  const type = MIME[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), fileName);
  const res = await call('/media/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`tải lên lỗi: ${res.body?.details?.message || res.body?.message || res.status}`);
  return res.body;
}

async function attach(productId, mediaAssetId, variantId, altText) {
  const res = await call(`/catalog/products/${productId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaAssetId, variantId, altText }),
  });
  if (res.ok) return 'GAN';
  if (res.status === 409) return 'DA_CO'; // đã gắn từ lần chạy trước
  throw new Error(`gắn lỗi: ${res.body?.details?.message || res.body?.message || res.status}`);
}

/* ================================================================== */

async function main() {
  const files = listImages();
  const fileBySku = new Map();
  for (const f of files) {
    const sku = skuFromFileName(f);
    if (fileBySku.has(sku)) {
      console.warn(`Hai file cùng SKU ${sku}: giữ ${fileBySku.get(sku)}, bỏ ${f}`);
      continue;
    }
    fileBySku.set(sku, f);
  }
  console.log(`Thư mục: ${sourceDir}`);
  console.log(`Ảnh: ${files.length}`);

  if (!DRY) await login();
  else if (EMAIL && PASSWORD) await login();
  else { console.log('\nChế độ xem trước cần đăng nhập để đọc danh sách sản phẩm.'); process.exit(1); }

  const products = await fetchProducts();
  const variantCount = products.reduce((n, p) => n + (p.variants?.length ?? 0), 0);
  console.log(`Sản phẩm: ${products.length} | Biến thể: ${variantCount}`);

  // Ghép theo thứ tự sản phẩm -> biến thể, để ảnh đầu tiên của sản phẩm
  // là ảnh của biến thể đầu (ảnh đại diện).
  const jobs = [];
  const variantsWithoutImage = [];
  const usedSkus = new Set();

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      const sku = String(variant.sku || '').toUpperCase();
      const fileName = fileBySku.get(sku);
      if (!fileName) { variantsWithoutImage.push(`${product.name} / ${variant.name} (${sku})`); continue; }
      usedSkus.add(sku);
      jobs.push({ productId: product.id, variantId: variant.id, sku, fileName, productName: product.name });
    }
  }
  const imagesWithoutVariant = [...fileBySku.entries()].filter(([sku]) => !usedSkus.has(sku)).map(([, f]) => f);

  console.log('');
  console.log(`Ghép được       : ${jobs.length}`);
  console.log(`Biến thể thiếu ảnh: ${variantsWithoutImage.length}`);
  console.log(`Ảnh không khớp SKU: ${imagesWithoutVariant.length}`);
  for (const v of variantsWithoutImage.slice(0, 20)) console.log(`   thiếu ảnh: ${v}`);
  if (variantsWithoutImage.length > 20) console.log(`   ... còn ${variantsWithoutImage.length - 20} dòng`);
  for (const f of imagesWithoutVariant.slice(0, 20)) console.log(`   ảnh thừa : ${f}`);
  if (imagesWithoutVariant.length > 20) console.log(`   ... còn ${imagesWithoutVariant.length - 20} dòng`);

  if (DRY) {
    console.log('\nChế độ xem trước, chưa tải gì lên. Bỏ --thu để chạy thật.');
    return;
  }

  console.log('\nBắt đầu tải lên...');
  let done = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const [index, job] of jobs.entries()) {
    try {
      const asset = await uploadImage(job.fileName);
      const result = await attach(job.productId, asset.id, job.variantId, job.sku);
      if (result === 'DA_CO' && !REDO) skipped += 1; else done += 1;
    } catch (error) {
      failed += 1;
      errors.push(`${job.fileName}: ${error.message}`);
    }
    if ((index + 1) % 20 === 0 || index === jobs.length - 1) {
      process.stdout.write(`\r  ${index + 1}/${jobs.length}  (gắn ${done}, bỏ qua ${skipped}, lỗi ${failed})   `);
    }
  }
  console.log('\n');
  console.log(`Xong. Gắn mới: ${done} | Đã có sẵn: ${skipped} | Lỗi: ${failed}`);
  for (const e of errors.slice(0, 30)) console.log(`   ${e}`);
  if (errors.length > 30) console.log(`   ... còn ${errors.length - 30} lỗi`);
}

main().catch((error) => {
  console.error('\n' + error.message);
  process.exit(1);
});
