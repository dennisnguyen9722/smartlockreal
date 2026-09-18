import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** Tên để phân biệt bộ đếm giữa các endpoint */
  name: string;
  /** Số request tối đa từ một IP trong một cửa sổ thời gian */
  limit: number;
  windowSeconds: number;
  /** Đếm thêm theo email trong nội dung request (chống dò nhiều tài khoản) */
  emailLimit?: number;
}

export const RATE_LIMIT_KEY = 'ktm:rate-limit';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
