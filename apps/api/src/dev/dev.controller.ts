import { Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ErrorCode } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { SYSTEM_QUEUE } from '../queue/queue.module';

/** Endpoint hỗ trợ phát triển. KHÔNG được đăng ký ở production. */
@Controller('dev')
export class DevController {
  constructor(@Inject(SYSTEM_QUEUE) private readonly systemQueue: Queue) {}

  @Post('system-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async addSystemJob() {
    try {
      const job = await this.systemQueue.add('hello', { from: 'api', at: new Date().toISOString() });
      return { jobId: job.id };
    } catch {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE, {
        queue: 'down',
      });
    }
  }
}