import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import { ErrorCode, type SystemHelloJobData } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { SYSTEM_QUEUE } from '../queue/queue.module';

const AddSystemJobSchema = z.object({
  notifySocketId: z.string().min(1).max(64).optional(),
});

/** Endpoint hỗ trợ phát triển. KHÔNG được đăng ký ở production. */
@Controller('dev')
export class DevController {
  constructor(@Inject(SYSTEM_QUEUE) private readonly systemQueue: Queue) {}

  @Post('system-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async addSystemJob(@Body() body: unknown) {
    const parsed = AddSystemJobSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        HttpStatus.BAD_REQUEST,
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    }

    const data: SystemHelloJobData = {
      from: 'api',
      at: new Date().toISOString(),
      notifyRoom: parsed.data.notifySocketId,
    };

    try {
      const job = await this.systemQueue.add('hello', data);
      return { jobId: job.id };
    } catch {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE, {
        queue: 'down',
      });
    }
  }
}