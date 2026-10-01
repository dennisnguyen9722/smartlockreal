/**
 * Quét thư mục ảnh sản phẩm và sinh file Excel để nhập vào hệ thống.
 *
 * Thư mục ảnh đang phẳng, mỗi file là một mã + màu + cách điều khiển, ví dụ:
 *   KL-599-LX-BLACK-TTLOCK.webp          -> màu Đen, dùng app TTLock
 *   KL-599-LX-BLACK-TTLOCK-REMOTE.webp   -> màu Đen, app TTLock VÀ có remote
 *   KL-668-BLACK-REMOTE.webp             -> màu Đen, CHỈ có remote (không app)
 *   KL-668-BLACK.webp                    -> màu Đen, bản cơ bản (không app, không remote)
 *
 * Script tách tên file thành 3 phần:
 *   <MÃ MODEL> - <MÀU> - <CÁCH ĐIỀU KHIỂN>
 * rồi gom các file cùng MÃ MODEL thành MỘT sản phẩm nhiều biến thể.
 * Chỉ chiều nào thực sự khác nhau trong cùng một sản phẩm mới thành tùy chọn.
 *
 * CÁCH CHẠY (đứng ở apps/api để node tìm được exceljs):
 *   cd apps/api
 *   node scripts/tao-excel-tu-thu-muc.mjs "/Users/dennis/Projects/Sản phẩm WEBP"
 *
 * Tùy chọn:
 *   --out <file.xlsx>   Nơi lưu (mặc định: san-pham-can-nhap.xlsx cạnh thư mục ảnh)
 *   --mau <file.xlsx>   File mẫu tải từ trang quản trị, để lấy trang "Tham chiếu"
 *                       (mã hãng, mã danh mục thật) và tự đoán cột "Mã hãng"
 *
 * Script CHỈ ĐỌC thư mục. Không sửa, không xóa, không đổi tên file nào.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

/* ================================================================== */
/* Tham số                                                             */
/* ================================================================== */

const argv = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) {
    flags[argv[i].slice(2)] = argv[i + 1] ?? '';
    i += 1;
  } else {
    positional.push(argv[i]);
  }
}

const sourceDir = positional[0];
if (!sourceDir) {
  console.error('Thiếu đường dẫn thư mục ảnh.');
  console.error('Ví dụ: node scripts/tao-excel-tu-thu-muc.mjs "/Users/dennis/Projects/Sản phẩm WEBP"');
  process.exit(1);
}
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`Không tìm thấy thư mục: ${sourceDir}`);
  process.exit(1);
}
const outPath = flags.out || path.join(path.dirname(path.resolve(sourceDir)), 'san-pham-can-nhap.xlsx');

/* ================================================================== */
/* Từ điển                                                             */
/* ================================================================== */

/** Màu, xếp từ dài đến ngắn để "ROSEGOLD" không bị cắt nhầm thành "GOLD" */
const COLORS = [
  ['CHAMPEGNEGOLD', 'Vàng champagne'], ['GREENBRONZE', 'Đồng xanh'], ['REDBRONZE', 'Đồng đỏ'],
  ['SILVERBLUE', 'Bạc xanh'], ['AMBERGOLD', 'Vàng hổ phách'], ['ROSEGOLD', 'Vàng hồng'],
  ['SANDGOLD', 'Vàng cát'], ['DARKGRAY', 'Xám đậm'], ['GRAYSKY', 'Xám trời'],
  ['BLUEGREY', 'Xanh xám'], ['BLUEGRAY', 'Xanh xám'],
  ['BLACK', 'Đen'], ['SILVER', 'Bạc'], ['BRONZE', 'Đồng'], ['COPPER', 'Đồng đỏ'],
  ['COFFEE', 'Cà phê'], ['BROWN', 'Nâu'], ['GREEN', 'Xanh lá'], ['BLUE', 'Xanh dương'],
  ['TITAN', 'Titan'], ['INOX', 'Inox'], ['GOLD', 'Vàng'], ['GRAY', 'Xám'], ['GREY', 'Xám'],
  ['RED', 'Đỏ'], ['24K', '24K'],
];
const COLOR_MAP = new Map(COLORS);

/** Hậu tố app trong tên file */
const APPS = { TTLOCK: 'TTLock', TUYA: 'Tuya' };

/**
 * Cách điều khiển — MỘT chiều duy nhất, không tách app và remote thành hai chiều.
 * Đọc theo đúng quy ước đặt tên file:
 *   có TTLOCK/TUYA, không REMOTE  -> chỉ dùng app đó
 *   có REMOTE, không app          -> CHỈ dùng remote
 *   có cả hai                     -> dùng app đó VÀ có remote
 *   không có gì                   -> bản cơ bản
 */
const CONTROL_BASIC = { code: 'co-ban', label: 'Bản cơ bản' };

function buildControl(app, remote) {
  if (app && remote) return { code: `${slugifyVi(app)}-remote`, label: `App ${app} + Remote` };
  if (app) return { code: slugifyVi(app), label: `App ${app}` };
  if (remote) return { code: 'remote', label: 'Remote' };
  return CONTROL_BASIC;
}

/** Ký tự Kirin/Hy Lạp nhìn giống chữ Latin, hay lọt vào tên file khi copy từ web */
const LOOKALIKE = {
  'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O',
  'Р': 'P', 'Т': 'T', 'Х': 'X', 'І': 'I', 'Ѕ': 'S', 'Ј': 'J', 'Ԍ': 'G', 'З': '3',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M',
  'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Χ': 'X',
};

const IMAGE_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif', '.gif']);

/* ================================================================== */
/* Tiện ích                                                            */
/* ================================================================== */

/** Giống slugifyVi trong @ktm/shared, chép lại để script chạy độc lập */
function slugifyVi(input) {
  return input
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Viết hoa chữ đầu, phần còn lại thường: "Vàng Xám" -> "Vàng xám" */
function sentenceCase(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Đổi ký tự nhìn giống Latin về Latin; trả về [mã đã sửa, có sửa hay không] */
function fixLookalike(code) {
  let fixed = '';
  let changed = false;
  for (const char of code) {
    const replacement = LOOKALIKE[char];
    if (replacement) { fixed += replacement; changed = true; } else { fixed += char; }
  }
  return [fixed, changed];
}

/* ================================================================== */
/* Tách tên file                                                       */
/* ================================================================== */

function parseFileName(fileName) {
  const stem = fileName.slice(0, fileName.length - path.extname(fileName).length);
  const raw = stem.trim().replace(/\s+/g, '-').toUpperCase();
  const [code, hadLookalike] = fixLookalike(raw);

  const notes = [];
  if (hadLookalike) {
    notes.push('Tên file có ký tự lạ (không phải chữ Latin), script đã tự sửa — nên đổi tên file thật cho khớp');
  }
  if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(code)) {
    notes.push('Tên file có ký tự không hợp lệ cho SKU (chỉ cho phép A-Z, 0-9 và gạch ngang)');
  }

  const tokens = code.split('-');
  let remote = false;
  if (tokens.length > 1 && tokens[tokens.length - 1] === 'REMOTE') {
    remote = true;
    tokens.pop();
  }
  let app = '';
  if (tokens.length > 1 && APPS[tokens[tokens.length - 1]]) {
    app = APPS[tokens.pop()];
  }

  const colorTokens = [];
  while (tokens.length > 1) {
    const tail = tokens[tokens.length - 1];
    if (COLOR_MAP.has(tail)) { colorTokens.unshift(tokens.pop()); continue; }
    // Trường hợp dính liền không gạch ngang: "CNCBLACK" -> "CNC" + "BLACK"
    const glued = COLORS.find(([key]) => tail.endsWith(key) && tail.length - key.length >= 2);
    if (glued) {
      tokens[tokens.length - 1] = tail.slice(0, tail.length - glued[0].length);
      colorTokens.unshift(glued[0]);
      continue;
    }
    break;
  }

  // "BLUE" + "GREY" viết rời cũng là xanh xám, gộp cho khớp với "BLUEGREY"
  if (colorTokens.length === 2 && colorTokens[0] === 'BLUE' && (colorTokens[1] === 'GREY' || colorTokens[1] === 'GRAY')) {
    colorTokens.splice(0, 2, 'BLUEGREY');
  }

  return {
    fileName,
    sku: code,
    model: tokens.join('-'),
    color: sentenceCase(colorTokens.map((token) => COLOR_MAP.get(token)).join(' ')),
    control: buildControl(app, remote),
    notes,
  };
}

/* ================================================================== */
/* Đọc trang "Tham chiếu" của file mẫu tải từ hệ thống (nếu có)        */
/* ================================================================== */

let referenceRows = [];
let brands = [];

async function readTemplate() {
  if (!flags.mau) return;
  if (!fs.existsSync(flags.mau)) {
    console.warn(`Bỏ qua --mau: không tìm thấy ${flags.mau}`);
    return;
  }
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(flags.mau);
    const sheet = wb.getWorksheet('Tham chiếu');
    if (!sheet) { console.warn('Bỏ qua --mau: file không có trang "Tham chiếu"'); return; }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item = {
        kind: String(row.getCell(1).value ?? '').trim(),
        code: String(row.getCell(2).value ?? '').trim(),
        name: String(row.getCell(3).value ?? '').trim(),
        note: String(row.getCell(4).value ?? '').trim(),
      };
      if (!item.code) return;
      referenceRows.push(item);
      if (item.kind === 'Hãng') brands.push(item);
    });
    console.log(`Đã đọc ${referenceRows.length} dòng tham chiếu (${brands.length} hãng).`);
  } catch (error) {
    console.warn(`Bỏ qua --mau: không đọc được file (${error.message})`);
  }
}

function guessBrand(text) {
  const haystack = `-${slugifyVi(text)}-`;
  let best = '';
  for (const brand of brands) {
    const needle = `-${slugifyVi(brand.name)}-`;
    if (haystack.includes(needle) && brand.code.length > best.length) best = brand.code;
  }
  return best;
}

/* ================================================================== */
/* Gom nhóm                                                            */
/* ================================================================== */

function buildProducts(parsed) {
  const groups = new Map();
  for (const item of parsed) {
    const list = groups.get(item.model) ?? [];
    list.push(item);
    groups.set(item.model, list);
  }

  const products = [];
  const issues = [];

  for (const [model, items] of groups) {
    const varyColor = new Set(items.map((item) => item.color)).size > 1;
    const varyControl = new Set(items.map((item) => item.control.code)).size > 1;

    // Cả sản phẩm cùng một cách điều khiển và không phải bản cơ bản:
    // thông tin đó thuộc về sản phẩm, không phải biến thể -> đưa vào mô tả ngắn.
    const sharedControl =
      !varyControl && items[0].control.code !== CONTROL_BASIC.code ? items[0].control.label : '';

    const variants = [];
    const seen = new Set();

    for (const item of items) {
      const parts = [];
      const options = [];

      if (item.color) parts.push(item.color);
      if (varyColor) {
        const colorLabel = item.color || 'Mặc định';
        options.push(`mau=${slugifyVi(colorLabel)}:${colorLabel}`);
      }
      if (varyControl) {
        parts.push(item.control.label);
        options.push(`dieu-khien=${item.control.code}:${item.control.label}`);
      }

      const name = parts.length > 0 ? parts.join(' - ') : 'Mặc định';
      const key = name.toLowerCase();
      if (seen.has(key)) {
        issues.push({
          file: item.fileName, model,
          problem: 'Trùng biến thể',
          detail: `Đã có biến thể "${name}" từ file khác. Dòng này bị bỏ qua — kiểm tra xem hai file có phải cùng một sản phẩm không.`,
        });
        continue;
      }
      seen.add(key);

      for (const note of item.notes) issues.push({ file: item.fileName, model, problem: 'Tên file', detail: note });

      // Cùng mã, cùng màu mà file này không hậu tố còn file kia ghi tên APP:
      // không rõ file này là bản không app thật, hay chỉ là tên file viết tắt.
      // (Không hậu tố so với "-REMOTE" thì rõ ràng: một bản có remote, một bản không.)
      if (varyControl && item.control.code === CONTROL_BASIC.code) {
        const withApp = items.filter(
          (other) => other !== item && other.color === item.color && /ttlock|tuya/.test(other.control.code),
        );
        if (withApp.length > 0) {
          issues.push({
            file: item.fileName, model,
            problem: 'Chưa rõ app',
            detail: `Tên file không ghi app, nhưng file cùng màu ghi "${withApp
              .map((other) => other.control.label)
              .join(', ')}". Tôi để dòng này là "Bản cơ bản". Nếu thật ra nó cũng là bản app đó (tên file viết thiếu) thì hai file trùng nhau — xóa dòng này và đổi tên file cho khớp.`,
          });
        }
      }

      variants.push({ sku: item.sku, name, options: options.join('|'), fileName: item.fileName });
    }

    if (variants.length > 0) products.push({ model, variants, sharedControl });
  }

  products.sort((a, b) => a.model.localeCompare(b.model, 'en', { numeric: true }));
  return { products, issues };
}

/* ================================================================== */
/* Cột — phải trùng KHÍT với PRODUCT_IMPORT_COLUMNS trong @ktm/shared  */
/* ================================================================== */

const COLUMNS = [
  { header: 'Mã sản phẩm *', key: 'productCode', width: 26, required: true },
  { header: 'Loại *', key: 'type', width: 12, required: true, options: ['LOCK', 'ACCESSORY', 'SERVICE', 'BUNDLE'] },
  { header: 'Tên sản phẩm *', key: 'name', width: 34, required: true },
  {
    header: 'Mã hãng', key: 'brandCode', width: 20, todo: true,
    note: 'Điền TÊN hãng cũng được (vd: Yale). Bắt buộc với loại LOCK.',
  },
  {
    header: 'Mã danh mục *', key: 'categoryCode', width: 24, required: true, todo: true,
    note: 'Điền TÊN danh mục cũng được (vd: Khóa vân tay).',
  },
  { header: 'Mã model của hãng', key: 'manufacturerCode', width: 22 },
  { header: 'Bảo hành (tháng)', key: 'warrantyMonths', width: 16 },
  { header: 'Mô tả ngắn', key: 'shortDescription', width: 34 },
  { header: 'SKU', key: 'sku', width: 34 },
  { header: 'Tên biến thể *', key: 'variantName', width: 30, required: true },
  { header: 'Tùy chọn', key: 'optionValues', width: 46 },
  { header: 'Giá bán (VND) *', key: 'price', width: 16, required: true, todo: true },
  { header: 'Giá gạch ngang', key: 'compareAtPrice', width: 16 },
  { header: 'Thuế VAT (%)', key: 'vatRate', width: 14 },
  { header: 'Quản lý serial', key: 'trackSerial', width: 15, options: ['Có', 'Không'] },
  { header: 'Cân nặng (gram)', key: 'weightGrams', width: 16 },
];

const HEADER_FILL = 'FF1F3864';
const REQUIRED_FILL = 'FF7F1D1D';
const TODO_FILL = 'FFFFF2CC';

function paintHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });
}

/* ================================================================== */
/* Sinh file                                                           */
/* ================================================================== */

async function main() {
  await readTemplate();

  const fileNames = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && IMAGE_EXT.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (fileNames.length === 0) {
    console.error('Thư mục không có file ảnh nào.');
    process.exit(1);
  }

  const { products, issues } = buildProducts(fileNames.map(parseFileName));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Khóa Thông Minh Chính Hãng';
  workbook.created = new Date();

  /* ---- Hướng dẫn ---- */
  const guide = workbook.addWorksheet('Hướng dẫn', { views: [{ showGridLines: false }] });
  guide.getColumn(1).width = 106;
  const LINES = [
    ['FILE NHẬP SẢN PHẨM — SINH TỰ ĐỘNG TỪ THƯ MỤC ẢNH', 'h1'],
    ['', null],
    [`Nguồn: ${sourceDir}`, null],
    [`Số file ảnh: ${fileNames.length}  |  Số sản phẩm: ${products.length}  |  Số dòng: ${products.reduce((n, p) => n + p.variants.length, 0)}`, null],
    ['', null],
    ['BA CỘT BẠN PHẢI ĐIỀN (đã tô vàng trong trang "Sản phẩm")', 'h2'],
    ['1. Mã danh mục *   Bắt buộc. Điền TÊN danh mục cũng được (vd: Khóa vân tay).', null],
    ['2. Mã hãng         Bắt buộc với loại LOCK. Điền TÊN hãng cũng được (vd: Yale).', null],
    ['3. Giá bán *       Số nguyên, KHÔNG dấu chấm/phẩy. Đúng: 12500000  Sai: 12.500.000', null],
    ['', null],
    ['Mẹo điền nhanh: các dòng đã được SẮP XẾP THEO MÃ, nên cùng một hãng nằm liền nhau.', null],
    ['Điền ô đầu tiên rồi kéo thả xuống hết khối là xong cả hãng.', null],
    ['', null],
    ['MỘT CỘT NỮA NÊN SỬA', 'h2'],
    ['Tên sản phẩm *  đang tạm để bằng mã model (vd: KL-599-LX) vì script không biết tên', null],
    ['                thương mại. Nên đổi thành tên bán hàng thật, vd: "Khóa vân tay Kaadas KL-599-LX".', null],
    ['                Để nguyên mã cũng nhập được, sửa sau trong trang quản trị cũng được.', null],
    ['', null],
    ['CÁCH SCRIPT GOM SẢN PHẨM', 'h2'],
    ['Tên file được tách thành:  <MÃ MODEL> - <MÀU> - <CÁCH ĐIỀU KHIỂN>', null],
    ['Các file cùng MÃ MODEL gộp thành MỘT sản phẩm, mỗi file là một biến thể.', null],
    ['', null],
    ['Cách điều khiển đọc theo đúng quy ước đặt tên file:', null],
    ['   ...-TTLOCK.webp          -> App TTLock          (chỉ dùng app, không remote)', null],
    ['   ...-TUYA.webp            -> App Tuya', null],
    ['   ...-REMOTE.webp          -> Remote              (CHỈ có remote, không app)', null],
    ['   ...-TTLOCK-REMOTE.webp   -> App TTLock + Remote (có cả hai)', null],
    ['   ...-TUYA-REMOTE.webp     -> App Tuya + Remote', null],
    ['   không có hậu tố nào      -> Bản cơ bản          (không app, không remote)', null],
    ['', null],
    ['Chiều nào không khác nhau thì không thành tùy chọn. Sản phẩm chỉ có một màu và', null],
    ['một cách điều khiển thì cột "Tùy chọn" để trống, biến thể tên là màu đó.', null],
    ['Nếu cả sản phẩm dùng chung một app thì thông tin đó nằm ở cột "Mô tả ngắn"', null],
    ['chứ không nhắc lại trong từng biến thể.', null],
    ['', null],
    ['CỘT SKU', 'h2'],
    ['SKU = ĐÚNG TÊN FILE ẢNH (viết hoa). Cố ý để vậy: sau khi nhập xong, muốn gắn ảnh', null],
    ['cho biến thể nào chỉ cần tìm file trùng tên với SKU. Trang "Ảnh" là bảng tra đó.', null],
    ['Lưu ý: nhập lại file có SKU đã tồn tại = CẬP NHẬT biến thể đó, không tạo trùng.', null],
    ['', null],
    ['TRƯỚC KHI TẢI LÊN', 'h2'],
    ['Xem trang "Cần kiểm tra". Đó là những chỗ script không chắc, đã ghi rõ lý do.', null],
    ['Cột "Loại" script để mặc định LOCK cho tất cả. Nếu có phụ kiện (thẻ từ, remote rời...)', null],
    ['thì sửa thành ACCESSORY, và khi đó cột "Mã hãng" không bắt buộc nữa.', null],
    ['', null],
    ['Tải lên: Sản phẩm > Nhập từ Excel. Hệ thống kiểm tra và hiện bảng xem trước;', null],
    ['dữ liệu chỉ được ghi khi bạn bấm xác nhận. Tối đa 2000 dòng, file tối đa 5 MB.', null],
  ];
  for (const [text, kind] of LINES) {
    const cell = guide.addRow([text]).getCell(1);
    if (kind === 'h1') cell.font = { bold: true, size: 14, color: { argb: HEADER_FILL } };
    else if (kind === 'h2') cell.font = { bold: true, size: 11, color: { argb: HEADER_FILL } };
    else cell.font = { size: 11 };
  }

  /* ---- Sản phẩm ---- */
  const sheet = workbook.addWorksheet('Sản phẩm', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  sheet.columns = COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
  const head = sheet.getRow(1);
  head.height = 34;
  head.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  head.alignment = { vertical: 'middle', wrapText: true };
  head.eachCell((cell, index) => {
    const column = COLUMNS[index - 1];
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: column?.required ? REQUIRED_FILL : HEADER_FILL },
    };
    if (column?.note) cell.note = column.note;
  });

  let rowCount = 0;
  for (const product of products) {
    const brandCode = guessBrand(product.model);
    for (const [index, variant] of product.variants.entries()) {
      const row = sheet.addRow({
        productCode: product.model,
        type: 'LOCK',
        name: product.model,
        brandCode,
        categoryCode: '',
        manufacturerCode: product.model,
        warrantyMonths: index === 0 ? 24 : '',
        shortDescription: index === 0 && product.sharedControl ? `Điều khiển: ${product.sharedControl}` : '',
        sku: variant.sku,
        variantName: variant.name,
        optionValues: variant.options,
        price: '',
        compareAtPrice: '', vatRate: '', trackSerial: '', weightGrams: '',
      });
      for (const column of COLUMNS) {
        if (!column.todo) continue;
        if (column.key === 'brandCode' && brandCode) continue;
        row.getCell(column.key).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TODO_FILL } };
      }
      rowCount += 1;
    }
  }

  const lastRow = rowCount + 1;
  COLUMNS.forEach((column, index) => {
    if (!column.options) return;
    const letter = sheet.getColumn(index + 1).letter;
    for (let row = 2; row <= lastRow; row += 1) {
      sheet.getCell(`${letter}${row}`).dataValidation = {
        type: 'list', allowBlank: !column.required, formulae: [`"${column.options.join(',')}"`],
      };
    }
  });
  sheet.getColumn('price').numFmt = '#,##0';
  sheet.getColumn('compareAtPrice').numFmt = '#,##0';
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };

  // Có danh sách hãng/danh mục thật thì cho chọn trong ô, khỏi phải gõ tay và gõ sai
  const pickLists = [
    { key: 'brandCode', column: 'F', items: referenceRows.filter((item) => item.kind === 'Hãng') },
    { key: 'categoryCode', column: 'G', items: referenceRows.filter((item) => item.kind === 'Danh mục') },
  ];
  for (const list of pickLists) {
    if (list.items.length === 0) continue;
    const letter = sheet.getColumn(list.key).letter;
    const range = `'Tham chiếu'!$${list.column}$2:$${list.column}$${list.items.length + 1}`;
    for (let row = 2; row <= lastRow; row += 1) {
      sheet.getCell(`${letter}${row}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`=${range}`],
        showErrorMessage: false, // vẫn cho gõ tay giá trị khác nếu cần
      };
    }
  }

  /* ---- Ảnh ---- */
  const media = workbook.addWorksheet('Ảnh', { views: [{ state: 'frozen', ySplit: 1 }] });
  media.columns = [
    { header: 'SKU', key: 'sku', width: 34 },
    { header: 'Mã sản phẩm', key: 'model', width: 26 },
    { header: 'Biến thể', key: 'variant', width: 30 },
    { header: 'Tên file ảnh', key: 'file', width: 46 },
  ];
  paintHeader(media);
  for (const product of products) {
    for (const variant of product.variants) {
      media.addRow({ sku: variant.sku, model: product.model, variant: variant.name, file: variant.fileName });
    }
  }
  media.autoFilter = { from: 'A1', to: { row: 1, column: 4 } };

  /* ---- Cần kiểm tra ---- */
  const check = workbook.addWorksheet('Cần kiểm tra', { views: [{ state: 'frozen', ySplit: 1 }] });
  check.columns = [
    { header: 'Vấn đề', key: 'problem', width: 20 },
    { header: 'Mã sản phẩm', key: 'model', width: 26 },
    { header: 'File ảnh', key: 'file', width: 40 },
    { header: 'Chi tiết', key: 'detail', width: 86 },
  ];
  paintHeader(check);
  if (issues.length === 0) {
    check.addRow({ problem: 'Không có', model: '', file: '', detail: 'Script gom được toàn bộ file, không có chỗ nào nghi ngờ.' });
  } else {
    for (const issue of issues) check.addRow(issue);
  }

  /* ---- Tham chiếu ---- */
  const reference = workbook.addWorksheet('Tham chiếu', { views: [{ state: 'frozen', ySplit: 1 }] });
  reference.columns = [
    { header: 'Loại', key: 'kind', width: 16 },
    { header: 'Mã (điền vào file)', key: 'code', width: 30 },
    { header: 'Tên', key: 'name', width: 40 },
    { header: 'Ghi chú', key: 'note', width: 58 },
  ];
  paintHeader(reference);
  if (referenceRows.length > 0) {
    for (const item of referenceRows) reference.addRow(item);
    // Cột F và G là nguồn của danh sách chọn ở trang "Sản phẩm" — đừng xóa, đừng sắp xếp lại
    reference.getCell('F1').value = 'Nguồn chọn: Hãng';
    reference.getCell('G1').value = 'Nguồn chọn: Danh mục';
    for (const cell of ['F1', 'G1']) {
      reference.getCell(cell).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      reference.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    }
    reference.getColumn('F').width = 26;
    reference.getColumn('G').width = 30;
    referenceRows.filter((item) => item.kind === 'Hãng')
      .forEach((item, index) => { reference.getCell(`F${index + 2}`).value = item.name || item.code; });
    referenceRows.filter((item) => item.kind === 'Danh mục')
      .forEach((item, index) => { reference.getCell(`G${index + 2}`).value = item.name || item.code; });
  } else {
    reference.addRow({
      kind: 'Chưa có', code: '', name: '',
      note: 'Vào Sản phẩm > Nhập từ Excel > Tải file mẫu, rồi chạy lại script kèm --mau <file đó> để có mã hãng và mã danh mục thật.',
    });
  }

  await workbook.xlsx.writeFile(outPath);

  console.log('');
  console.log(`Đã tạo: ${outPath}`);
  console.log(`  File ảnh   : ${fileNames.length}`);
  console.log(`  Sản phẩm   : ${products.length}`);
  console.log(`  Dòng Excel : ${rowCount}`);
  console.log(`  Cần kiểm tra: ${issues.length}`);
  console.log('');
  console.log('Còn phải điền trong file: Mã danh mục, Mã hãng, Giá bán (các ô tô vàng).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
