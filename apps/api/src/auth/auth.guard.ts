import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { ErrorCode } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { REDIS } from '../redis/redis.module';
import { AuthService } from './auth.service';
import { PUBLIC_KEY } from './auth.decorators';
import { TokenService } from './token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket có cơ chế riêng (Bước 4.7)
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.get('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new AppException(ErrorCode.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED);
    }

    const result = await this.tokens.verifyAccessToken(header.slice(7).trim());
    if (!result.ok) {
      throw new AppException(
        result.reason === 'EXPIRED' ? ErrorCode.TOKEN_EXPIRED : ErrorCode.UNAUTHENTICATED,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Phiên đã bị thu hồi (đăng xuất, đổi mật khẩu, khóa tài khoản)
    const revoked = await this.redis.exists(AuthService.revokedKey(result.payload.sid));
    if (revoked === 1) {
      throw new AppException(ErrorCode.SESSION_REVOKED, HttpStatus.UNAUTHORIZED);
    }

    request.staff = {
      id: result.payload.sub,
      role: result.payload.role,
      sessionId: result.payload.sid,
    };
    return true;
  }
}
