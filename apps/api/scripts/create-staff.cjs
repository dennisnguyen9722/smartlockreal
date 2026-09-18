// Tạo tài khoản nhân viên.
// Chạy: node --env-file=.env apps/api/scripts/create-staff.cjs <email> <mật khẩu> <họ tên> [SUPER_ADMIN|SALE_STAFF]
const { createPrismaClient } = require('@ktm/database');
const { PasswordService } = require('../dist/auth/password.service');

const [email, password, fullName, role = 'SALE_STAFF'] = process.argv.slice(2);

if (!email || !password || !fullName) {
  console.error('Thiếu tham số. Ví dụ:');
  console.error('  node --env-file=.env apps/api/scripts/create-staff.cjs admin@ktm.vn "MatKhau@123" "Nguyễn Cao Duy" SUPER_ADMIN');
  process.exit(1);
}

(async () => {
  const db = createPrismaClient({ connectionString: process.env.DATABASE_URL, maxConnections: 1 });
  const passwordHash = await new PasswordService().hash(password);

  const staff = await db.staff.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, fullName, role, status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
    create: { email: email.toLowerCase(), passwordHash, fullName, role },
  });

  console.log(`✅ ${staff.email} | ${staff.fullName} | ${staff.role} | ${staff.id}`);
  await db.$disconnect();
})().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
