import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
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
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
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