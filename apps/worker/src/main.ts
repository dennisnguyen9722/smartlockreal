import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_PREFIX, QueueName } from '@ktm/shared';
import { loadEnv } from './env';

const env = loadEnv();

// Worker dùng lệnh "chờ" của Redis, nên phải đặt maxRetriesPerRequest: null
// để lệnh chờ không bị ioredis cắt ngang khi mất kết nối tạm thời.
const connection = new Redis(env.REDIS_URL, {
  connectionName: 'ktm-worker',
  maxRetriesPerRequest: null,
});
connection.on('error', (error) => console.error('[Redis]', error.message));

const systemWorker = new Worker(
  QueueName.SYSTEM,
  async (job: Job) => {
    console.log(`▶ Xử lý job "${job.name}" #${job.id}`, job.data);
    return { processedAt: new Date().toISOString() };
  },
  { connection, prefix: QUEUE_PREFIX, concurrency: env.WORKER_CONCURRENCY },
);

systemWorker.on('completed', (job) => console.log(`✅ Xong job #${job.id}`, job.returnvalue));
systemWorker.on('failed', (job, error) => console.error(`❌ Lỗi job #${job?.id}:`, error.message));
systemWorker.on('error', (error) => console.error('[Worker]', error.message));

async function start() {
  await systemWorker.waitUntilReady();
  console.log(`🚀 Worker sẵn sàng. Hàng đợi: ${QueueName.SYSTEM}, xử lý song song: ${env.WORKER_CONCURRENCY}`);
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Nhận ${signal}, đợi các job đang chạy hoàn tất...`);
  await systemWorker.close(); // chờ job đang xử lý xong, không nhận job mới
  await connection.quit();
  console.log('Đã tắt worker');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((error: unknown) => {
  console.error('❌ Worker không khởi động được:', error);
  process.exit(1);
});