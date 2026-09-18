// Thử băm mật khẩu và ký/kiểm tra token.
// Chạy: node --env-file=.env apps/api/scripts/auth-smoke.cjs
const { PasswordService } = require('../dist/auth/password.service');
const { TokenService } = require('../dist/auth/token.service');

(async () => {
  const passwords = new PasswordService();

  const t0 = Date.now();
  const hash = await passwords.hash('MatKhau@123');
  console.log(`✅ Băm xong trong ${Date.now() - t0}ms`);
  console.log('   Chuỗi băm:', hash.slice(0, 40) + '...');

  console.log('✅ Mật khẩu đúng:', await passwords.verify(hash, 'MatKhau@123'));
  console.log('✅ Mật khẩu sai :', await passwords.verify(hash, 'MatKhauSai'));
  console.log('✅ Chuỗi băm hỏng:', await passwords.verify('khong-phai-hash', 'MatKhau@123'));

  const hash2 = await passwords.hash('MatKhau@123');
  console.log('✅ Hai lần băm cùng mật khẩu cho chuỗi khác nhau:', hash !== hash2);

  const tokens = new TokenService({ JWT_STAFF_ACCESS_SECRET: process.env.JWT_STAFF_ACCESS_SECRET });
  const token = await tokens.signAccessToken({ sub: 'staff-1', role: 'SUPER_ADMIN', sid: 'session-1' });
  console.log('✅ Access token:', token.slice(0, 30) + '...');
  console.log('   Kiểm tra:', JSON.stringify(await tokens.verifyAccessToken(token)));

  const tampered = token.slice(0, -3) + 'aaa';
  console.log('   Token bị sửa:', JSON.stringify(await tokens.verifyAccessToken(tampered)));

  const other = new TokenService({ JWT_STAFF_ACCESS_SECRET: 'x'.repeat(40) });
  console.log('   Token ký bằng secret khác:', JSON.stringify(await other.verifyAccessToken(token)));

  const rt = tokens.generateRefreshToken();
  console.log('✅ Refresh token dài', rt.token.length, 'ký tự; mã băm dài', rt.tokenHash.length);
  console.log('   Băm lại cho cùng kết quả:', tokens.hashRefreshToken(rt.token) === rt.tokenHash);
})().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
