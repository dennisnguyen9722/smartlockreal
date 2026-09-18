import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PrismaClient, Staff } from '@ktm/database';
import { ErrorCode, type StaffRoleCode } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { PRISMA } from '../database/database.module';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  LOCK_DURATION_MINUTES,
  MAX_FAILED_LOGINS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  staff: { id: string; email: string; fullName: string; role: StaffRoleCode };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string, ctx: RequestContext): Promise<AuthResult> {
    const staff = await this.db.staff.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (!staff) {
      // Tốn thời gian tương đương lúc email có thật, tránh lộ email nào đang tồn tại
      await this.passwords.burnTime();
      throw new AppException(ErrorCode.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    if (staff.status !== 'ACTIVE') {
      throw new AppException(ErrorCode.ACCOUNT_DISABLED, HttpStatus.FORBIDDEN);
    }
    if (staff.lockedUntil && staff.lockedUntil > new Date()) {
      throw new AppException(ErrorCode.ACCOUNT_LOCKED, HttpStatus.LOCKED, {
        lockedUntil: staff.lockedUntil.toISOString(),
      });
    }

    const valid = await this.passwords.verify(staff.passwordHash, password);
    if (!valid) {
      await this.recordFailedLogin(staff);
      throw new AppException(ErrorCode.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }

    return this.createSession(staff, randomUUID(), ctx);
  }

  async refresh(rawToken: string, ctx: RequestContext): Promise<AuthResult> {
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const session = await this.db.staffSession.findUnique({
      where: { tokenHash },
      include: { staff: true },
    });

    if (!session) {
      throw new AppException(ErrorCode.SESSION_REVOKED, HttpStatus.UNAUTHORIZED);
    }

    // Token đã bị thu hồi mà vẫn được dùng: nhiều khả năng đã bị đánh cắp
    if (session.revokedAt) {
      await this.revokeFamily(session.familyId, 'REUSE_DETECTED');
      this.logger.warn(`Phát hiện dùng lại refresh token, thu hồi cả chuỗi phiên ${session.familyId}`);
      throw new AppException(ErrorCode.SESSION_REVOKED, HttpStatus.UNAUTHORIZED);
    }
    if (session.expiresAt <= new Date()) {
      throw new AppException(ErrorCode.SESSION_REVOKED, HttpStatus.UNAUTHORIZED);
    }
    if (session.staff.status !== 'ACTIVE') {
      await this.revokeFamily(session.familyId, 'ADMIN');
      throw new AppException(ErrorCode.ACCOUNT_DISABLED, HttpStatus.FORBIDDEN);
    }

    return this.createSession(session.staff, session.familyId, ctx, session.id);
  }

  async logout(rawToken: string): Promise<void> {
    const session = await this.db.staffSession.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(rawToken) },
      select: { familyId: true },
    });
    if (session) {
      await this.revokeFamily(session.familyId, 'LOGOUT');
    }
  }

  async getProfile(staffId: string) {
    const staff = await this.db.staff.findUnique({
      where: { id: staffId },
      select: { id: true, email: true, fullName: true, role: true, lastLoginAt: true },
    });
    if (!staff || staff.role === undefined) {
      throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return staff;
  }

  /** Tạo phiên mới; nếu là làm mới token thì thu hồi phiên cũ trong cùng transaction */
  private async createSession(
    staff: Staff,
    familyId: string,
    ctx: RequestContext,
    previousSessionId?: string,
  ): Promise<AuthResult> {
    const { token, tokenHash } = this.tokens.generateRefreshToken();
    const now = new Date();

    const session = await this.db.$transaction(async (tx) => {
      const created = await tx.staffSession.create({
        data: {
          staffId: staff.id,
          tokenHash,
          familyId,
          userAgent: ctx.userAgent?.slice(0, 500),
          ipAddress: ctx.ip,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        },
      });

      if (previousSessionId) {
        await tx.staffSession.update({
          where: { id: previousSessionId },
          data: { revokedAt: now, revokeReason: 'ROTATED', replacedById: created.id, lastUsedAt: now },
        });
      } else {
        await tx.staff.update({
          where: { id: staff.id },
          data: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null },
        });
      }
      return created;
    });

    const accessToken = await this.tokens.signAccessToken({
      sub: staff.id,
      role: staff.role as StaffRoleCode,
      sid: session.id,
    });

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: token,
      staff: {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role as StaffRoleCode,
      },
    };
  }

  private async recordFailedLogin(staff: Staff): Promise<void> {
    const attempts = staff.failedLoginCount + 1;
    const shouldLock = attempts >= MAX_FAILED_LOGINS;
    await this.db.staff.update({
      where: { id: staff.id },
      data: {
        failedLoginCount: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000) : staff.lockedUntil,
      },
    });
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    const sessions = await this.db.staffSession.findMany({
      where: { familyId, revokedAt: null },
      select: { id: true },
    });
    if (sessions.length === 0) return;

    await this.db.staffSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });

    // Chặn access token còn hạn của các phiên này; tự hết sau 15 phút
    const pipeline = this.redis.pipeline();
    for (const session of sessions) {
      pipeline.set(AuthService.revokedKey(session.id), reason, 'EX', ACCESS_TOKEN_TTL_SECONDS);
    }
    await pipeline.exec();
  }

    /** Khóa Redis đánh dấu một phiên đã bị thu hồi */
  static revokedKey(sessionId: string): string {
    return `revoked_session:${sessionId}`;
  }
}
