import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_PREFIX, QueueName } from '@ktm/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Token để tiêm hàng đợi system: @Inject(SYSTEM_QUEUE) private readonly queue: Queue */
export const SYSTEM_QUEUE = Symbol('SYSTEM_QUEUE');
const QUEUE_REDIS = Symbol('QUEUE_REDIS');

@Injectable()
class QueueLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(SYSTEM_QUEUE) private readonly systemQueue: Queue,
    @Inject(QUEUE_REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown() {
    await this.systemQueue.close();
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_REDIS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const logger = new Logger('Redis:queue');
        // Phía thêm job: lỗi ngay khi mất Redis, không để request của khách treo
        const client = new Redis(env.REDIS_URL, {
          connectionName: 'ktm-api-queue',
          enableOfflineQueue: false,
        });
        client.on('error', (error) => logger.error(error.message));
        return client;
      },
    },
    {
      provide: SYSTEM_QUEUE,
      inject: [QUEUE_REDIS],
      useFactory: (connection: Redis) =>
        new Queue(QueueName.SYSTEM, {
          connection,
          prefix: QUEUE_PREFIX,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: { age: 24 * 3600, count: 1000 },
            removeOnFail: { age: 7 * 24 * 3600 },
          },
        }),
    },
    QueueLifecycle,
  ],
  exports: [SYSTEM_QUEUE],
})
export class QueueModule {}