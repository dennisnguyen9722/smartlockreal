import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { createPrismaClient, PrismaClient } from '@ktm/database';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Token để tiêm database: @Inject(PRISMA) private readonly db: PrismaClient */
export const PRISMA = Symbol('PRISMA');

/** Đóng kết nối database khi server tắt */
@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger('Database');

  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async onApplicationShutdown() {
    await this.db.$disconnect();
    this.logger.log('Đã đóng kết nối database');
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      inject: [ENV],
      useFactory: (env: Env) => createPrismaClient({ connectionString: env.DATABASE_URL }),
    },
    DatabaseLifecycle,
  ],
  exports: [PRISMA],
})
export class DatabaseModule {}