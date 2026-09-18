// Quản lý tài khoản nhân viên.
//   node --env-file=.env apps/api/scripts/staff-cli.cjs create <email> "<Họ tên>" [SUPER_ADMIN|SALE_STAFF]
//   node --env-file=.env apps/api/scripts/staff-cli.cjs reset-password <email>
//   node --env-file=.env apps/api/scripts/staff-cli.cjs list
// Mật khẩu được nhập ẩn, KHÔNG nằm trong lịch sử Terminal.
const readline = require('node:readline');
const { createPrismaClient } = require('@ktm/database');
const { checkPasswordStrength, PASSWORD_MIN_LENGTH } = require('@ktm/shared');
const { PasswordService } = require('../dist/auth/password.service');

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      // Xóa ký tự vừa gõ khỏi màn hình
      if (!['\n', '\r', '\u0004'].includes(char.toString('utf8'))) {
        process.stdout.write('\u001b[2K\u001b[200D' + question);
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    rl.on('SIGINT', () => {
      process.stdin.off('data', onData);
      rl.close();
      reject(new Error('Đã hủy'));
    });
  });
}

async function askPasswordTwice() {
  const password = await askHidden(`Mật khẩu (tối thiểu ${PASSWORD_MIN_LENGTH} ký tự): `);
  const check = checkPasswordStrength(password);
  if (!check.valid) {
    console.error('❌ Mật khẩu chưa đạt:');
    for (const error of check.errors) console.error(`   - ${error}`);
    process.exit(1);
  }
  const confirm = await askHidden('Nhập lại mật khẩu: ');
  if (password !== confirm) {
    console.error('❌ Hai lần nhập không khớp');
    process.exit(1);
  }
  return password;
}

(async () => {
  const [command, ...args] = process.argv.slice(2);
  const db = createPrismaClient({ connectionString: process.env.DATABASE_URL, maxConnections: 1 });
  const passwords = new PasswordService();

  if (command === 'list') {
    const staff = await db.staff.findMany({
      select: { email: true, fullName: true, role: true, status: true, lastLoginAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.table(staff);
  } else if (command === 'create') {
    const [email, fullName, role = 'SALE_STAFF'] = args;
    if (!email || !fullName) throw new Error('Cần: create <email> "<Họ tên>" [vai trò]');
    if (!['SUPER_ADMIN', 'SALE_STAFF'].includes(role)) throw new Error(`Vai trò không hợp lệ: ${role}`);

    const normalized = email.trim().toLowerCase();
    if (await db.staff.findUnique({ where: { email: normalized }, select: { id: true } })) {
      throw new Error(`Email ${normalized} đã tồn tại. Dùng lệnh reset-password nếu muốn đổi mật khẩu.`);
    }

    const password = await askPasswordTwice();
    const staff = await db.staff.create({
      data: { email: normalized, fullName, role, passwordHash: await passwords.hash(password) },
    });
    console.log(`✅ Đã tạo ${staff.email} | ${staff.fullName} | ${staff.role}`);
  } else if (command === 'reset-password') {
    const [email] = args;
    if (!email) throw new Error('Cần: reset-password <email>');

    const normalized = email.trim().toLowerCase();
    const staff = await db.staff.findUnique({ where: { email: normalized }, select: { id: true } });
    if (!staff) throw new Error(`Không tìm thấy ${normalized}`);

    const password = await askPasswordTwice();
    await db.$transaction([
      db.staff.update({
        where: { id: staff.id },
        data: {
          passwordHash: await passwords.hash(password),
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      // Đổi mật khẩu thì mọi phiên đang đăng nhập bị thu hồi
      db.staffSession.updateMany({
        where: { staffId: staff.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' },
      }),
    ]);
    console.log(`✅ Đã đổi mật khẩu cho ${normalized} và thu hồi mọi phiên đăng nhập`);
  } else {
    console.log('Cách dùng:');
    console.log('  staff-cli.cjs create <email> "<Họ tên>" [SUPER_ADMIN|SALE_STAFF]');
    console.log('  staff-cli.cjs reset-password <email>');
    console.log('  staff-cli.cjs list');
  }

  await db.$disconnect();
})().catch((error) => {
  console.error('❌', error.message ?? error);
  process.exit(1);
});
