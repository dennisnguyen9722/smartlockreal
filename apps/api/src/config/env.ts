import { z } from 'zod';

const jwtSecret = z.string().min(32, 'phải dài tối thiểu 32 ký tự');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'phải bắt đầu bằng postgresql://'),
    REDIS_URL: z.string().regex(/^rediss?:\/\//, 'phải bắt đầu bằng redis://'),

    API_PORT: z.coerce
      .number({ error: 'phải là số' })
      .int('phải là số nguyên')
      .min(1, 'phải từ 1 đến 65535')
      .max(65535, 'phải từ 1 đến 65535')
      .default(4000),
    CORS_ORIGINS: z
      .string()
      .min(1, 'không được để trống')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => value || undefined),

    JWT_CUSTOMER_ACCESS_SECRET: jwtSecret,
    JWT_CUSTOMER_REFRESH_SECRET: jwtSecret,
    JWT_STAFF_ACCESS_SECRET: jwtSecret,
    JWT_STAFF_REFRESH_SECRET: jwtSecret,
    
  })
  .superRefine((env, ctx) => {
    const secrets = [
      env.JWT_CUSTOMER_ACCESS_SECRET,
      env.JWT_CUSTOMER_REFRESH_SECRET,
      env.JWT_STAFF_ACCESS_SECRET,
      env.JWT_STAFF_REFRESH_SECRET,
    ];
    if (new Set(secrets).size !== secrets.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_*'],
        message: '4 JWT secret phải khác nhau',
      });
    }
    if (env.NODE_ENV === 'production' && !env.COOKIE_DOMAIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_DOMAIN'],
        message: 'bắt buộc ở production (vd: .khoathongminhchinhhang.vn)',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Đọc và kiểm tra biến môi trường. Sai hoặc thiếu biến -> in lỗi và dừng ngay.
 * Gọi MỘT lần khi khởi động.
 */
export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Biến môi trường không hợp lệ:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}