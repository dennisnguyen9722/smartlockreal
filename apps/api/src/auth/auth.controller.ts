import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, Get } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCode, Permission, RolePermissions } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, REFRESH_TOKEN_TTL_SECONDS } from './auth.constants';
import { AuthService, type AuthResult } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import type { AuthUser } from '../common/types/express';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';

const LoginSchema = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const staff = await this.auth.getProfile(user.id);
    return { ...staff, permissions: RolePermissions[user.role] };
  }

  @Public()
  @RateLimit({ name: 'login', limit: 10, windowSeconds: 900, emailLimit: 5 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = LoginSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        HttpStatus.BAD_REQUEST,
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      );
    }

    const result = await this.auth.login(parsed.data.email, parsed.data.password, this.context(req));
    return this.respond(res, result);
  }

  @Public()
  @RateLimit({ name: 'refresh', limit: 60, windowSeconds: 900 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readRefreshCookie(req);
    const result = await this.auth.refresh(token, this.context(req));
    return this.respond(res, result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof token === 'string' && token.length > 0) {
      await this.auth.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private readRefreshCookie(req: Request): string {
    const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof token !== 'string' || token.length === 0) {
      throw new AppException(ErrorCode.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED);
    }
    return token;
  }

  private context(req: Request) {
    return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
  }

  /** Đặt refresh token vào cookie; KHÔNG trả nó trong nội dung phản hồi */
  private respond(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, staff: result.staff };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      // Local chạy http nên tắt secure; production bắt buộc https
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: REFRESH_COOKIE_PATH,
      domain: this.env.COOKIE_DOMAIN,
    };
  }
}
