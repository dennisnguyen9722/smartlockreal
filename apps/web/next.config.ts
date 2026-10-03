import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import type { NextConfig } from 'next';

// Nạp .env ở thư mục gốc monorepo (pnpm chạy lệnh từ apps/web).
// Kiểm tra tồn tại: khi deploy, biến môi trường thường do nền tảng cung cấp, không có file .env.
const rootEnvFile = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

/**
 * Nơi đặt file ảnh.
 *
 * Database lưu đường dẫn TƯƠNG ĐỐI ("/media/2026/01/abc.webp"), còn file ảnh thật
 * nằm ở máy chủ API (cổng 4000). Khai báo chuyển tiếp ở đây để trình duyệt chỉ cần
 * gọi /media/... trên chính tên miền nó đang mở là lấy được ảnh.
 *
 * Nhờ vậy cùng một bản ghi trong database chạy đúng ở cả ba nơi — máy lập trình,
 * địa chỉ wifi nội bộ (xem bằng điện thoại), và tên miền thật — không phải sửa database.
 *
 * MEDIA_ORIGIN: chỉ cần khai khi ảnh nằm ở máy chủ khác với API.
 */
/**
 * Các địa chỉ được phép mở trang dev ngoài localhost.
 *
 * VÌ SAO CẦN: Next.js 16 CHẶN truy cập từ origin lạ vào tài nguyên nội bộ của
 * máy chủ dev (/_next/...) cho an toàn. Mở web trên điện thoại bằng địa chỉ wifi
 * (http://192.168.1.181:3000) chính là một origin lạ, nên bị chặn — log hiện dòng
 * "Blocked cross-origin request to Next.js dev resource". Hậu quả nhẹ thì mất
 * tự tải lại khi sửa code, nặng thì trang không chạy được JavaScript: liên kết
 * vẫn bấm được (là thẻ <a> thuần) nhưng MỌI NÚT đều chết.
 *
 * Tự đọc địa chỉ wifi của máy thay vì ghi cứng: router đổi IP thì không phải sửa.
 * Cần thêm tên miền khác (ví dụ ngrok) thì đặt biến DEV_ORIGINS, ngăn nhau bằng dấu phẩy.
 *
 * Chỉ có tác dụng khi chạy dev, không ảnh hưởng bản chạy thật.
 */
function cacDiaChiMoDuoc(): string[] {
  const ra = new Set<string>();

  for (const nhom of Object.values(networkInterfaces())) {
    for (const mang of nhom ?? []) {
      // Bỏ qua loopback (127.0.0.1) vì Next cho sẵn, và bỏ IPv6 cho gọn
      if (mang.family === 'IPv4' && !mang.internal) ra.add(mang.address);
    }
  }

  for (const them of (process.env.DEV_ORIGINS ?? '').split(',')) {
    const sach = them.trim();
    if (sach) ra.add(sach);
  }

  return [...ra];
}

function gocMedia(): string {
  const rieng = process.env.MEDIA_ORIGIN;
  if (rieng) return rieng.replace(/\/+$/, '');

  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  try {
    return new URL(api).origin;
  } catch {
    return 'http://localhost:4000';
  }
}

const nextConfig: NextConfig = {
  // Cho phép mở trang dev bằng địa chỉ wifi (xem trên điện thoại)
  allowedDevOrigins: cacDiaChiMoDuoc(),

  poweredByHeader: false,
  reactStrictMode: true,
  // @ktm/ui xuất file .tsx gốc, Next.js cần tự biên dịch
  transpilePackages: ['@ktm/ui'],

  async rewrites() {
    /*
     * Khi lên VPS có nginx, nên để nginx đọc thẳng file ảnh từ đĩa, nhanh hơn
     * nhiều so với đi vòng qua Next.js:
     *
     *   location /media/ {
     *       alias /srv/khoathongminh/apps/api/var/media/;
     *       expires 30d;
     *       add_header Cache-Control "public, immutable";
     *   }
     *
     * Khai ở nginx thì nginx xử lý trước, dòng dưới không bao giờ chạy tới —
     * cứ để nguyên làm phương án dự phòng, không hại gì.
     */
    return [
      {
        source: '/media/:duongDan*',
        destination: `${gocMedia()}/media/:duongDan*`,
      },
    ];
  },
};

export default nextConfig;
