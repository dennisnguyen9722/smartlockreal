import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { ErrorCode } from '@ktm/shared';
import { AppException } from '../errors/app.exception';
import { REDIS } from '../../redis/redis.module';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // req.ip đã là IP thật của khách nhờ 'trust proxy' trong main.ts
    const checks: { key: string; limit: number }[] = [
      { key: `rl:${options.name}:ip:${request.ip ?? 'unknown'}`, limit: options.limit },
    ];

    if (options.emailLimit) {
      const body: unknown = request.body;
      const email =
        typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : undefined;
      if (email) {
        // Băm email: Redis không lưu dữ liệu cá nhân dạng rõ
        const hashed = createHash('sha256').update(email).digest('hex').slice(0, 32);
        checks.push({ key: `rl:${options.name}:email:${hashed}`, limit: options.emailLimit });
      }
    }

    try {
      for (const check of checks) {
        const count = await this.redis.incr(check.key);
        if (count === 1) {
          await this.redis.expire(check.key, options.windowSeconds);
        }
        if (count > check.limit) {
          const ttl = await this.redis.ttl(check.key);
          const retryAfter = ttl > 0 ? ttl : options.windowSeconds;
          response.setHeader('Retry-After', String(retryAfter));
          throw new AppException(ErrorCode.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS, { retryAfter });
        }
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      // Redis lỗi: cho request đi qua thay vì chặn toàn bộ đăng nhập.
      // Tài khoản vẫn được bảo vệ bởi cơ chế khóa sau 5 lần sai.
      this.logger.error(`Không kiểm tra được giới hạn request: ${(error as Error).message}`);
    }
    return true;
  }
}
