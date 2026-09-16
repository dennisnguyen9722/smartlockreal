import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Kết nối Redis dùng chung: cache, đếm giới hạn request, phát sự kiện... */
export const REDIS = Symbol('REDIS');
/** Kết nối RIÊNG cho việc lắng nghe (subscribe). Không dùng cho việc khác. */
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

function createRedis(url: string, name: string): Redis {
  const logger = new Logger(`Redis:${name}`);
  const client = new Redis(url, { connectionName: `ktm-api-${name}` });
  client.on('ready', () => logger.log('Đã kết nối'));
  client.on('error', (error) => logger.error(error.message));
  return client;
}

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  async onApplicationShutdown() {
    await Promise.allSettled([this.redis.quit(), this.subscriber.quit()]);
  }
}

@Global()
@Module({
  providers: [
    { provide: REDIS, inject: [ENV], useFactory: (env: Env) => createRedis(env.REDIS_URL, 'main') },
    {
      provide: REDIS_SUBSCRIBER,
      inject: [ENV],
      useFactory: (env: Env) => createRedis(env.REDIS_URL, 'sub'),
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}