import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
import { ErrorCode } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { PRISMA } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  @Get()
  async check() {
    const startedAt = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE, {
        database: 'down',
      });
    }
    return {
      status: 'ok',
      database: 'up',
      databaseLatencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
      service: 'api'
    };
  }
}