import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'phải bắt đầu bằng redis://'),
  /** Việc định kỳ (hết hạn báo giá...) cần đọc/ghi database */
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'phải bắt đầu bằng postgresql://'),
  WORKER_CONCURRENCY: z.coerce
    .number({ error: 'phải là số' })
    .int('phải là số nguyên')
    .min(1, 'phải từ 1 đến 50')
    .max(50, 'phải từ 1 đến 50')
    .default(5),
});

export type Env = z.infer<typeof EnvSchema>;

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