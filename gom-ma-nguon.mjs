/**
 * Gom mã nguồn dự án thành MỘT file text để gửi đi.
 *
 * CHẠY (đứng ở thư mục gốc dự án):
 *   node gom-ma-nguon.mjs
 *
 * Tùy chọn:
 *   --out <file>     Nơi lưu (mặc định: ktm-context.txt ở thư mục gốc)
 *   --chi <phần>     Chỉ gom một phần: web | admin | api | shared | ui | database
 *                    Dùng khi file đầy đủ quá to. Lặp lại được: --chi web --chi ui
 *   --kem-migration  Kèm luôn file SQL trong prisma/migrations (mặc định BỎ,
 *                    vì rất dài mà ít khi cần đọc)
 *
 * Bỏ qua: node_modules, .next, dist, build, .git, .turbo, mã Prisma tự sinh,
 * file khóa phiên bản, ảnh và mọi file nhị phân.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
const flags = { chi: [] };
for (let i = 0; i < argv.length; i += 1) {
  const name = argv[i];
  if (name === '--out') { flags.out = argv[i + 1]; i += 1; }
  else if (name === '--chi') { flags.chi.push(argv[i + 1]); i += 1; }
  else if (name === '--kem-migration') { flags.migration = true; }
}

const ROOT = process.cwd();
const OUT = path.resolve(flags.out || 'ktm-context.txt');

/** Thư mục không bao giờ đi vào */
const BO_QUA_THU_MUC = new Set([
  'node_modules', '.next', '.turbo', '.git', 'dist', 'build', 'coverage',
  'generated', '.vercel', '.cache', 'out',
]);

/** Đuôi file được gom */
const DUOI = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.json', '.prisma', '.sql', '.md', '.yaml', '.yml', '.env.example',
]);

/** Tên file bỏ qua dù đúng đuôi */
const BO_QUA_FILE = new Set([
  'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'ktm-context.txt',
  'tsconfig.tsbuildinfo', 'next-env.d.ts',
]);

/** Giới hạn một file; file to hơn chỉ ghi phần đầu kèm ghi chú */
const TOI_DA_MOT_FILE = 200 * 1024;

const PHAN = {
  web: ['apps/web'],
  admin: ['apps/admin'],
  api: ['apps/api'],
  worker: ['apps/worker'],
  shared: ['packages/shared'],
  ui: ['packages/ui'],
  database: ['packages/database'],
};

/** Khi không giới hạn --chi thì gom những gốc này */
const GOC_MAC_DINH = [
  'apps', 'packages',
  'package.json', 'turbo.json', 'pnpm-workspace.yaml', 'tsconfig.json',
  'docker', 'BAN-GIAO.md', 'README.md',
];

const goc = flags.chi.length > 0
  ? flags.chi.flatMap((ten) => {
      const duong = PHAN[ten];
      if (!duong) {
        console.error(`Không biết phần "${ten}". Chọn: ${Object.keys(PHAN).join(', ')}`);
        process.exit(1);
      }
      return duong;
    })
  : GOC_MAC_DINH;

/* ------------------------------------------------------------------ */

const files = [];

function duyet(duongDan) {
  const tuyetDoi = path.resolve(ROOT, duongDan);
  if (!fs.existsSync(tuyetDoi)) return;

  const thongTin = fs.statSync(tuyetDoi);
  if (thongTin.isFile()) {
    them(duongDan);
    return;
  }

  for (const muc of fs.readdirSync(tuyetDoi, { withFileTypes: true })) {
    if (muc.name.startsWith('.') && muc.name !== '.env.example') continue;
    const con = path.join(duongDan, muc.name);
    if (muc.isDirectory()) {
      if (BO_QUA_THU_MUC.has(muc.name)) continue;
      if (!flags.migration && muc.name === 'migrations') continue;
      duyet(con);
    } else if (muc.isFile()) {
      them(con);
    }
  }
}

function them(duongDan) {
  const ten = path.basename(duongDan);
  if (BO_QUA_FILE.has(ten)) return;
  if (!DUOI.has(path.extname(duongDan))) return;
  files.push(duongDan.split(path.sep).join('/'));
}

for (const item of goc) duyet(item);
files.sort();

/* ------------------------------------------------------------------ */

const phan = [];
let tongByte = 0;
let soFileCat = 0;

for (const duongDan of files) {
  let noiDung;
  try {
    noiDung = fs.readFileSync(path.resolve(ROOT, duongDan), 'utf8');
  } catch {
    continue;
  }
  // Bỏ file nhị phân lọt lưới
  if (noiDung.includes('\u0000')) continue;

  if (noiDung.length > TOI_DA_MOT_FILE) {
    noiDung =
      noiDung.slice(0, TOI_DA_MOT_FILE) +
      `\n\n... (CẮT BỚT: file dài ${noiDung.length} ký tự, chỉ giữ ${TOI_DA_MOT_FILE} ký tự đầu)\n`;
    soFileCat += 1;
  }

  tongByte += noiDung.length;
  phan.push(`##### FILE: ${duongDan} #####\n${noiDung}\n`);
}

const dauFile = [
  `##### DU AN: Khóa Thông Minh Chính Hãng #####`,
  `##### GOM LUC: ${new Date().toISOString()} #####`,
  `##### SO FILE: ${phan.length} #####`,
  flags.chi.length > 0 ? `##### CHI GOM: ${flags.chi.join(', ')} #####` : '',
  '',
].filter(Boolean).join('\n');

fs.writeFileSync(OUT, dauFile + '\n' + phan.join('\n'), 'utf8');

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`Đã ghi: ${OUT}`);
console.log(`  File gom được : ${phan.length}`);
console.log(`  Dung lượng    : ${mb} MB`);
if (soFileCat > 0) console.log(`  Bị cắt bớt    : ${soFileCat} file quá dài`);

// Thống kê theo thư mục để thấy phần nào chiếm nhiều
const theoNhom = new Map();
for (const duongDan of files) {
  const nhom = duongDan.split('/').slice(0, 2).join('/');
  theoNhom.set(nhom, (theoNhom.get(nhom) ?? 0) + 1);
}
console.log('');
console.log('  Theo thư mục:');
for (const [nhom, soLuong] of [...theoNhom].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(soLuong).padStart(4)}  ${nhom}`);
}
if (Number(mb) > 4) {
  console.log('');
  console.log('  File hơi to. Gom riêng từng phần cho nhẹ, ví dụ:');
  console.log('    node gom-ma-nguon.mjs --chi web --chi ui --out web.txt');
}
