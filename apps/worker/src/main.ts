import { Emitter } from '@socket.io/redis-emitter';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createPrismaClient } from '@ktm/database';
import {
  type JobCompletedPayload,
  MaintenanceJob,
  QUEUE_PREFIX,
  QueueName,
  REALTIME_NAMESPACE,
  RealtimeEvent,
  type SystemHelloJobData,
} from '@ktm/shared';
import { loadEnv } from './env';
import { expireQuotes } from './maintenance';

const env = loadEnv();

// Worker dùng lệnh "chờ" của Redis, nên phải đặt maxRetriesPerRequest: null
// để lệnh chờ không bị ioredis cắt ngang khi mất kết nối tạm thời.
const connection = new Redis(env.REDIS_URL, {
  connectionName: 'ktm-worker',
  maxRetriesPerRequest: null,
});
connection.on('error', (error) => console.error('[Redis]', error.message));

// Kết nối riêng cho phía thêm job (Queue): không dùng chung với Worker đang chờ lệnh
const queueConnection = new Redis(env.REDIS_URL, { connectionName: 'ktm-worker-queue', maxRetriesPerRequest: null });
queueConnection.on('error', (error) => console.error('[Redis:queue]', error.message));

// Kết nối riêng để phát thông báo realtime qua Redis (chỉ dùng lệnh publish)
const emitterRedis = new Redis(env.REDIS_URL, { connectionName: 'ktm-worker-emitter' });
emitterRedis.on('error', (error) => console.error('[Redis:emitter]', error.message));
const realtime = new Emitter(emitterRedis).of(REALTIME_NAMESPACE);

const db = createPrismaClient({ connectionString: env.DATABASE_URL, maxConnections: 2 });

// ---------- Hàng đợi system (thử nghiệm) ----------

const systemWorker = new Worker<SystemHelloJobData>(
  QueueName.SYSTEM,
  async (job: Job<SystemHelloJobData>) => {
    console.log(`▶ Xử lý job "${job.name}" #${job.id}`, job.data);
    return { processedAt: new Date().toISOString() };
  },
  { connection, prefix: QUEUE_PREFIX, concurrency: env.WORKER_CONCURRENCY },
);

systemWorker.on('completed', (job) => {
  console.log(`✅ Xong job #${job.id}`, job.returnvalue);
  if (!job.data.notifyRoom) return;

  const payload: JobCompletedPayload = {
    queue: QueueName.SYSTEM,
    jobId: job.id ?? '',
    name: job.name,
    result: job.returnvalue,
  };
  realtime.to(job.data.notifyRoom).emit(RealtimeEvent.JOB_COMPLETED, payload);
});
systemWorker.on('failed', (job, error) => console.error(`❌ Lỗi job #${job?.id}:`, error.message));
systemWorker.on('error', (error) => console.error('[Worker]', error.message));

// ---------- Hàng đợi maintenance (việc định kỳ) ----------

const maintenanceQueue = new Queue(QueueName.MAINTENANCE, {
  connection: queueConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { age: 30 * 24 * 3600 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

// Việc định kỳ chạy tuần tự (concurrency 1): không cần song song, tránh hai lần cùng sửa một dữ liệu
const maintenanceWorker = new Worker(
  QueueName.MAINTENANCE,
  async (job: Job) => {
    switch (job.name) {
      case MaintenanceJob.EXPIRE_QUOTES:
        return expireQuotes(db);
      default:
        throw new Error(`Không biết job "${job.name}"`);
    }
  },
  { connection, prefix: QUEUE_PREFIX, concurrency: 1 },
);
maintenanceWorker.on('completed', (job) => console.log(`✅ [maintenance] ${job.name}`, job.returnvalue));
maintenanceWorker.on('failed', (job, error) => console.error(`❌ [maintenance] ${job?.name}:`, error.message));
maintenanceWorker.on('error', (error) => console.error('[Worker:maintenance]', error.message));

/**
 * Lịch chạy định kỳ. upsertJobScheduler: chạy nhiều worker hay khởi động lại nhiều lần
 * vẫn chỉ có MỘT lịch (theo id), không bị nhân đôi.
 */
async function registerSchedules() {
  await maintenanceQueue.upsertJobScheduler(
    'expire-quotes-daily',
    { pattern: '5 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
    { name: MaintenanceJob.EXPIRE_QUOTES },
  );
  // Chạy bù một lần lúc khởi động (máy chủ tắt đúng lúc 00:05 thì không bị sót)
  await maintenanceQueue.add(MaintenanceJob.EXPIRE_QUOTES, {}, { removeOnComplete: true });
}

async function start() {
  await Promise.all([systemWorker.waitUntilReady(), maintenanceWorker.waitUntilReady()]);
  await registerSchedules();
  console.log(
    `🚀 Worker sẵn sàng. Hàng đợi: ${QueueName.SYSTEM} (song song ${env.WORKER_CONCURRENCY}), ${QueueName.MAINTENANCE} (hết hạn báo giá 00:05 hằng ngày)`,
  );
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Nhận ${signal}, đợi các job đang chạy hoàn tất...`);
  // Chờ job đang xử lý xong, không nhận job mới
  await Promise.all([systemWorker.close(), maintenanceWorker.close()]);
  await maintenanceQueue.close();
  await db.$disconnect();
  await Promise.all([connection.quit(), queueConnection.quit(), emitterRedis.quit()]);
  console.log('Đã tắt worker');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((error: unknown) => {
  console.error('❌ Worker không khởi động được:', error);
  process.exit(1);
});