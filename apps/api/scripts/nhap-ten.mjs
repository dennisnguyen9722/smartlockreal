/**
 * Đọc file Excel đã sửa rồi đổi TÊN và ĐƯỜNG DẪN của sản phẩm.
 *
 * CHẠY (luôn chạy --thu trước để xem trước, không đổi gì):
 *   cd apps/api
 *   node scripts/nhap-ten.mjs --email admin@ktm.vn --password 'mat-khau' --file ten-san-pham.xlsx --thu
 *   node scripts/nhap-ten.mjs --email admin@ktm.vn --password 'mat-khau' --file ten-san-pham.xlsx
 *
 * Tùy chọn:
 *   --api <url>        Mặc định http://localhost:4000/api/v1
 *   --thu              Chỉ in ra những gì SẼ đổi, KHÔNG gọi API ghi
 *   --giu-duong-dan    Chỉ đổi tên, giữ nguyên đường dẫn cũ
 *
 * VỀ ĐƯỜNG DẪN: mặc định script đổi luôn đường dẫn theo tên mới, vì
 * "/san-pham/khoa-van-tay-avo-lock-ac-993g" đọc được và lên Google tốt hơn
 * "/san-pham/ac-993g". Đổi đường dẫn nghĩa là ĐỔI ĐỊA CHỈ TRANG. Website chưa
 * công khai nên bây giờ đổi là không mất gì; để sau khi Google đã lập chỉ mục
 * thì mỗi lần đổi là mất thứ hạng và phải làm chuyển hướng 301.
 * Không muốn đổi đường dẫn thì thêm --giu-duong-dan.
 *
 * AN TOÀN: trước mỗi lần ghi, script đọc lại sản phẩm để lấy mốc updatedAt và
 * gửi kèm. Ai đó vừa sửa sản phẩm đó trong trang quản trị thì lần ghi này bị
 * từ chối (EDIT_CONFLICT) chứ không đè mất việc của người ta.
 */

import fs from 'node:fs';
import process from 'node:process';
import ExcelJS from 'exceljs';

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
const FILE = flags.file;
const DRY = Boolean(flags.thu);
const GIU_DUONG_DAN = Boolean(flags['giu-duong-dan']);

if (!EMAIL || !PASSWORD || !FILE) {
  console.error('Thiếu tham số.');
  console.error("  node scripts/nhap-ten.mjs --email <email> --password '<mật khẩu>' --file <file.xlsx> [--thu] [--giu-duong-dan]");
  process.exit(1);
}
if (!fs.existsSync(FILE)) {
  console.error(`Không thấy file: ${FILE}`);
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

async function call(pathname, options = {}, retried = false) {
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${API}${pathname}`, { ...options, headers });
  if (res.status === 401 && !retried) {
    await login();
    return call(pathname, options, true);
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Giống hệt slugifyVi trong @ktm/shared */
function slugifyVi(input) {
  return input
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function chuoi(cell) {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  // Excel có thể trả về ô dạng công thức hoặc văn bản nhiều đoạn
  if (typeof v === 'object') {
    if ('result' in v) return String(v.result ?? '').trim();
    if ('richText' in v) return v.richText.map((p) => p.text).join('').trim();
    if ('text' in v) return String(v.text).trim();
    return '';
  }
  return String(v).trim();
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có sheet nào');

  // Dò cột theo tiêu đề, không theo vị trí: bạn chèn/xoá cột vẫn chạy đúng
  const cot = {};
  ws.getRow(1).eachCell((cell, soCot) => {
    const ten = chuoi(cell).toLowerCase();
    if (ten.startsWith('id')) cot.id = soCot;
    else if (ten.startsWith('tên mới')) cot.tenMoi = soCot;
    else if (ten.startsWith('tên hiện tại')) cot.tenHienTai = soCot;
    else if (ten.startsWith('đường dẫn hiện tại')) cot.duongDanHienTai = soCot;
  });

  const thieu = ['id', 'tenMoi'].filter((k) => !cot[k]);
  if (thieu.length > 0) {
    throw new Error(
      `File thiếu cột bắt buộc (${thieu.join(', ')}). Dùng đúng file do xuat-ten.mjs tạo ra, đừng đổi tiêu đề cột.`,
    );
  }

  const viec = [];
  const boQua = [];
  for (let i = 2; i <= ws.rowCount; i += 1) {
    const row = ws.getRow(i);
    const id = chuoi(row.getCell(cot.id));
    if (!id) continue;

    const tenMoi = chuoi(row.getCell(cot.tenMoi));
    const tenHienTai = cot.tenHienTai ? chuoi(row.getCell(cot.tenHienTai)) : '';

    if (!tenMoi) { boQua.push({ dong: i, ly: 'cột TÊN MỚI để trống' }); continue; }
    if (tenMoi.length > 200) { boQua.push({ dong: i, ly: `tên dài ${tenMoi.length} ký tự, tối đa 200` }); continue; }
    if (tenMoi === tenHienTai) { boQua.push({ dong: i, ly: 'tên không đổi' }); continue; }

    const duongDanMoi = slugifyVi(tenMoi).slice(0, 160);
    if (!duongDanMoi) { boQua.push({ dong: i, ly: 'tên không tạo được đường dẫn hợp lệ' }); continue; }

    viec.push({
      dong: i,
      id,
      tenHienTai,
      tenMoi,
      duongDanHienTai: cot.duongDanHienTai ? chuoi(row.getCell(cot.duongDanHienTai)) : '',
      duongDanMoi,
    });
  }

  // Chặn trùng đường dẫn TRƯỚC khi gọi API: chạy nửa chừng mới gãy là tệ nhất
  const dem = new Map();
  for (const v of viec) dem.set(v.duongDanMoi, (dem.get(v.duongDanMoi) || 0) + 1);
  const trung = viec.filter((v) => dem.get(v.duongDanMoi) > 1);
  if (trung.length > 0 && !GIU_DUONG_DAN) {
    console.error(`\n✗ ${trung.length} dòng sinh ra đường dẫn TRÙNG nhau. Chưa đổi gì cả.`);
    const theoSlug = new Map();
    for (const v of trung) {
      if (!theoSlug.has(v.duongDanMoi)) theoSlug.set(v.duongDanMoi, []);
      theoSlug.get(v.duongDanMoi).push(v);
    }
    for (const [slug, ds] of theoSlug) {
      console.error(`\n  ${slug}`);
      for (const v of ds) console.error(`    dòng ${v.dong}: ${v.tenMoi}`);
    }
    console.error('\nSửa tên cho khác nhau rồi chạy lại.');
    process.exit(1);
  }

  console.log(`Đọc ${FILE}: ${viec.length} sản phẩm cần đổi tên, ${boQua.length} dòng bỏ qua.`);
  if (GIU_DUONG_DAN) console.log('Chế độ --giu-duong-dan: chỉ đổi tên, giữ nguyên đường dẫn.');

  if (DRY) {
    console.log('\n--thu: chỉ xem trước, KHÔNG đổi gì.\n');
    for (const v of viec.slice(0, 200)) {
      console.log(`  dòng ${String(v.dong).padStart(4)}  ${v.tenHienTai || '(trống)'}  →  ${v.tenMoi}`);
      if (!GIU_DUONG_DAN) console.log(`${' '.repeat(12)}/san-pham/${v.duongDanHienTai}  →  /san-pham/${v.duongDanMoi}`);
    }
    if (viec.length > 200) console.log(`  … và ${viec.length - 200} dòng nữa`);
    inBoQua(boQua);
    console.log('\nƯng rồi thì chạy lại, bỏ --thu.');
    return;
  }

  await login();

  let xong = 0;
  const loi = [];

  for (const v of viec) {
    // Đọc lại để lấy mốc thời gian sửa gần nhất, tránh đè mất thay đổi của người khác
    const hienTai = await call(`/catalog/products/${v.id}`);
    if (!hienTai.ok) {
      loi.push({ ...v, ly: `không đọc được sản phẩm (${hienTai.status} ${hienTai.data.message || ''})`.trim() });
      continue;
    }

    const than = { name: v.tenMoi };
    if (!GIU_DUONG_DAN) than.slug = v.duongDanMoi;
    if (hienTai.data.updatedAt) than.expectedUpdatedAt = hienTai.data.updatedAt;

    const res = await call(`/catalog/products/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(than),
    });

    if (res.ok) {
      xong += 1;
      process.stdout.write(`\r  đã đổi ${xong}/${viec.length}…`);
    } else {
      const ly =
        res.data.code === 'EDIT_CONFLICT'
          ? 'có người vừa sửa sản phẩm này trong trang quản trị — chạy lại xuat-ten.mjs rồi làm lại'
          : `${res.status} ${res.data.message || ''}`.trim();
      loi.push({ ...v, ly });
    }
  }

  console.log(`\n\nĐổi xong ${xong}/${viec.length} sản phẩm.`);
  if (loi.length > 0) {
    console.log(`\n${loi.length} sản phẩm KHÔNG đổi được:`);
    const theoLy = new Map();
    for (const l of loi) {
      if (!theoLy.has(l.ly)) theoLy.set(l.ly, []);
      theoLy.get(l.ly).push(l);
    }
    for (const [ly, ds] of theoLy) {
      console.log(`\n  ${ly}  (${ds.length})`);
      for (const d of ds.slice(0, 15)) console.log(`    dòng ${d.dong}: ${d.tenMoi}`);
      if (ds.length > 15) console.log(`    … và ${ds.length - 15} cái nữa`);
    }
  }
  inBoQua(boQua);

  if (xong > 0) {
    console.log('\nTrang chủ đang đệm 60 giây, chờ chút là website hiện tên mới.');
  }
}

function inBoQua(boQua) {
  if (boQua.length === 0) return;
  const theoLy = new Map();
  for (const b of boQua) theoLy.set(b.ly, (theoLy.get(b.ly) || 0) + 1);
  console.log('\nDòng bỏ qua:');
  for (const [ly, so] of theoLy) console.log(`  ${so.toString().padStart(4)}  ${ly}`);
}

main().catch((error) => {
  console.error(`\nLỗi: ${error.message}`);
  process.exit(1);
});
