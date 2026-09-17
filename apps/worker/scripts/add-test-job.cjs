// Thêm một job thử vào hàng đợi system.
// Cách chạy (ở thư mục gốc): node --env-file=.env apps/worker/scripts/add-test-job.cjs
const { Queue } = require('bullmq');
const { Redis } = require('ioredis');
const { QUEUE_PREFIX, QueueName } = require('@ktm/shared');

(async () => {
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QueueName.SYSTEM, { connection, prefix: QUEUE_PREFIX });

  const job = await queue.add('hello', { from: 'script', at: new Date().toISOString() });
  console.log('✅ Đã thêm job #' + job.id);
  console.log('Số job theo trạng thái:', await queue.getJobCounts());

  await queue.close();
  await connection.quit();
})().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
