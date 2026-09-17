import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Nạp .env ở thư mục gốc monorepo (pnpm chạy lệnh từ apps/web).
// Kiểm tra tồn tại: khi deploy, biến môi trường thường do nền tảng cung cấp, không có file .env.
const rootEnvFile = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}
console.log('[next.config] NEXT_PUBLIC_API_URL =', process.env.NEXT_PUBLIC_API_URL ?? '(chưa có)');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
