/**
 * Xuất file Excel đề xuất TÊN THƯƠNG MẠI cho toàn bộ sản phẩm.
 *
 * Vì sao cần: hiện tên sản phẩm đang là mã model ("AC-993G", "KL-989F").
 * Không ai gõ "AC-993G" lên Google — họ gõ "khóa vân tay cửa gỗ". Tên sản phẩm
 * là thứ Google đọc đầu tiên, nên để nguyên mã model là mất gần hết lượng khách
 * tìm kiếm tự nhiên.
 *
 * Script này KHÔNG đổi gì trong cơ sở dữ liệu. Nó chỉ đọc ra và ghi một file
 * Excel để bạn sửa. Đổi tên thật là việc của scripts/nhap-ten.mjs.
 *
 * CHẠY:
 *   cd apps/api
 *   node scripts/xuat-ten.mjs --email admin@ktm.vn --password 'mat-khau'
 *
 * Tùy chọn:
 *   --api <url>   Mặc định http://localhost:4000/api/v1
 *   --ra <file>   Tên file xuất ra, mặc định ten-san-pham.xlsx
 *
 * CÁCH ĐẶT TÊN ĐỀ XUẤT:
 *   <Danh mục> <Hãng> <Mã model>
 *   vd: "Khóa vân tay Avo Lock AC-993G"
 *
 *   - Danh mục nào chưa bắt đầu bằng chữ "Khóa" thì thêm vào đầu.
 *   - Hãng đã nằm trong tên danh mục thì không lặp lại.
 *   - Sản phẩm nào BẠN ĐÃ đặt tên tử tế rồi (tên không phải mã model) thì
 *     giữ nguyên, cột Ghi chú sẽ ghi "đã có tên".
 *   - KHÔNG tự thêm loại cửa vào tên. Một ổ khóa thường lắp được nhiều loại
 *     cửa; viết "cho cửa gỗ" vào tên là tự bó hẹp sai. Loại cửa để ở cột riêng
 *     cho bạn tham khảo khi tự sửa tên.
 */

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
const RA = typeof flags.ra === 'string' ? flags.ra : 'ten-san-pham.xlsx';

if (!EMAIL || !PASSWORD) {
  console.error('Thiếu tham số.');
  console.error("  node scripts/xuat-ten.mjs --email <email> --password '<mật khẩu>'");
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${pathname} → ${res.status} ${data.message || ''}`.trim());
  return data;
}

/** Giống hệt slugifyVi trong @ktm/shared — phải khớp, nếu không đường dẫn sẽ lệch */
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

/** Bỏ dấu để so sánh chữ, không dùng để tạo đường dẫn */
function khongDau(text) {
  return text.replace(/đ/gi, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Tên hiện tại có phải mã model không?
 * Mã model: toàn chữ IN HOA, số, gạch ngang; có ít nhất một chữ số; không có
 * khoảng trắng kiểu câu. "AC-993G" đúng, "KL 989F" đúng, "Khóa vân tay X" sai.
 */
function laMaModel(ten) {
  const t = ten.trim();
  if (t.length > 40) return false;
  if (!/\d/.test(t)) return false;
  return /^[A-Z0-9][A-Z0-9\s\-._/]*$/.test(t);
}

function dungTen({ danhMuc, hang, ma }) {
  const phan = [];

  let dm = (danhMuc || '').trim();
  if (dm) {
    // "Vân tay" -> "Khóa vân tay"; "Khóa vân tay" giữ nguyên
    if (!khongDau(dm).startsWith('khoa')) dm = `Khóa ${dm.charAt(0).toLowerCase()}${dm.slice(1)}`;
    phan.push(dm);
  } else {
    phan.push('Khóa');
  }

  // Danh mục đã chứa tên hãng thì thôi, không nói hai lần
  if (hang && !khongDau(phan.join(' ')).includes(khongDau(hang))) phan.push(hang.trim());
  if (ma) phan.push(ma.trim());

  return phan.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

async function layHet(pathname, khoaTrang = 'page') {
  const tatCa = [];
  let trang = 1;
  for (;;) {
    const noi = pathname.includes('?') ? '&' : '?';
    const data = await call(`${pathname}${noi}${khoaTrang}=${trang}`);
    const items = Array.isArray(data.items) ? data.items : [];
    tatCa.push(...items);
    const tong = Number(data.total) || 0;
    if (tatCa.length >= tong || items.length === 0) break;
    trang += 1;
  }
  return tatCa;
}

/** Loại cửa của từng sản phẩm, lấy qua API công khai — chỉ để tham khảo */
async function layLoaiCua() {
  const theoSlug = new Map();
  try {
    const dsLoai = await fetch(`${API}/public/door-types`).then((r) => (r.ok ? r.json() : []));
    const tenTheoSlug = new Map((dsLoai || []).map((l) => [l.slug, l.name]));

    let trang = 1;
    for (;;) {
      const res = await fetch(`${API}/public/products?pageSize=48&page=${trang}`);
      if (!res.ok) break;
      const data = await res.json();
      for (const sp of data.items || []) {
        const ten = (sp.doorTypeSlugs || []).map((s) => tenTheoSlug.get(s) || s);
        theoSlug.set(sp.slug, ten.join(', '));
      }
      if ((data.page || 1) * (data.pageSize || 48) >= (data.total || 0)) break;
      trang += 1;
    }
  } catch {
    // Không lấy được thì bỏ qua: đây là cột tham khảo, không phải cột bắt buộc
  }
  return theoSlug;
}

async function main() {
  await login();
  console.log('Đang đọc danh sách sản phẩm…');

  const sanPham = await layHet('/catalog/products?status=ALL&pageSize=100');
  console.log(`  ${sanPham.length} sản phẩm`);

  const loaiCua = await layLoaiCua();
  if (loaiCua.size === 0) console.log('  (không lấy được loại cửa — cột đó sẽ trống)');

  const hang = [];
  const demSlug = new Map();

  for (const sp of sanPham) {
    const tenHienTai = (sp.name || '').trim();
    const daCoTen = !laMaModel(tenHienTai);
    const ma = (sp.manufacturerCode || '').trim() || (laMaModel(tenHienTai) ? tenHienTai : '');

    const deXuat = daCoTen
      ? tenHienTai
      : dungTen({ danhMuc: sp.category?.name, hang: sp.brand?.name, ma });

    const duongDanMoi = slugifyVi(deXuat).slice(0, 160);
    demSlug.set(duongDanMoi, (demSlug.get(duongDanMoi) || 0) + 1);

    hang.push({
      id: sp.id,
      ma: ma || '—',
      hangSx: sp.brand?.name || '',
      danhMuc: sp.category?.name || '',
      loaiCua: loaiCua.get(sp.slug) || '',
      tenHienTai,
      deXuat,
      tenMoi: deXuat,
      duongDanHienTai: sp.slug || '',
      duongDanMoi,
      ghiChu: daCoTen ? 'đã có tên, giữ nguyên' : '',
    });
  }

  // Hai sản phẩm ra cùng một đường dẫn là lúc đổi tên sẽ lỗi trùng.
  // Báo ngay ở đây để sửa trong Excel, đừng để chạy nửa chừng mới gãy.
  let soTrung = 0;
  for (const d of hang) {
    if (demSlug.get(d.duongDanMoi) > 1) {
      d.ghiChu = [d.ghiChu, '⚠ TRÙNG đường dẫn với sản phẩm khác — sửa tên cho khác đi']
        .filter(Boolean)
        .join(' | ');
      soTrung += 1;
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tên sản phẩm');

  ws.columns = [
    { header: 'id (ĐỪNG SỬA)', key: 'id', width: 38 },
    { header: 'Mã model', key: 'ma', width: 16 },
    { header: 'Hãng', key: 'hangSx', width: 14 },
    { header: 'Danh mục', key: 'danhMuc', width: 20 },
    { header: 'Loại cửa (tham khảo)', key: 'loaiCua', width: 26 },
    { header: 'Tên hiện tại', key: 'tenHienTai', width: 22 },
    { header: 'Tên đề xuất', key: 'deXuat', width: 42 },
    { header: 'TÊN MỚI (sửa ở cột này)', key: 'tenMoi', width: 46 },
    { header: 'Đường dẫn hiện tại', key: 'duongDanHienTai', width: 28 },
    { header: 'Đường dẫn mới (tự tính)', key: 'duongDanMoi', width: 34 },
    { header: 'Ghi chú', key: 'ghiChu', width: 46 },
  ];

  ws.addRows(hang);

  const dong1 = ws.getRow(1);
  dong1.font = { bold: true };
  dong1.alignment = { vertical: 'middle' };
  dong1.height = 28;
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

  // Tô cột cần sửa cho dễ thấy, và tô đỏ dòng bị trùng đường dẫn
  ws.getColumn('tenMoi').eachCell((cell, soDong) => {
    if (soDong === 1) return;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } };
  });
  ws.getColumn('ghiChu').eachCell((cell, soDong) => {
    if (soDong === 1) return;
    if (String(cell.value || '').includes('TRÙNG')) {
      cell.font = { color: { argb: 'FFB3261E' }, bold: true };
    }
  });

  await wb.xlsx.writeFile(RA);

  const soCanDoi = hang.filter((d) => d.ghiChu.indexOf('đã có tên') === -1).length;
  console.log(`\nĐã ghi ${RA}`);
  console.log(`  ${hang.length} sản phẩm, ${soCanDoi} cái đang mang mã model cần đặt tên`);
  if (soTrung > 0) console.log(`  ⚠ ${soTrung} dòng bị TRÙNG đường dẫn — xem cột Ghi chú, sửa tên cho khác`);
  console.log('\nBước tiếp theo:');
  console.log(`  1. Mở ${RA}, sửa cột "TÊN MỚI" (ô màu vàng). Cột khác không cần động.`);
  console.log('  2. Lưu lại ở định dạng .xlsx.');
  console.log(`  3. node scripts/nhap-ten.mjs --email ${EMAIL} --password '…' --file ${RA} --thu`);
}

main().catch((error) => {
  console.error(`\nLỗi: ${error.message}`);
  process.exit(1);
});
