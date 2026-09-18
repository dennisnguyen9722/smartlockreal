import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { StaffRoleCode } from '@ktm/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ALGORITHM,
  JWT_AUDIENCE_STAFF,
  JWT_ISSUER,
} from './auth.constants';

export interface StaffTokenPayload {
  /** ID nhân viên */
  sub: string;
  role: StaffRoleCode;
  /** ID phiên, để thu hồi đúng phiên khi cần */
  sid: string;
}

export type VerifyResult =
  | { ok: true; payload: StaffTokenPayload }
  | { ok: false; reason: 'EXPIRED' | 'INVALID' };

@Injectable()
export class TokenService {
  private readonly accessSecret: Uint8Array;

  constructor(@Inject(ENV) env: Env) {
    this.accessSecret = new TextEncoder().encode(env.JWT_STAFF_ACCESS_SECRET);
  }

  async signAccessToken(payload: StaffTokenPayload): Promise<string> {
    return new SignJWT({ role: payload.role, sid: payload.sid })
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setSubject(payload.sub)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE_STAFF)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<VerifyResult> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret, {
        // Chỉ chấp nhận đúng thuật toán này
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE_STAFF,
      });

      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || typeof payload.role !== 'string') {
        return { ok: false, reason: 'INVALID' };
      }
      return {
        ok: true,
        payload: { sub: payload.sub, sid: payload.sid, role: payload.role as StaffRoleCode },
      };
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) return { ok: false, reason: 'EXPIRED' };
      return { ok: false, reason: 'INVALID' };
    }
  }

  /** Refresh token: chuỗi ngẫu nhiên 256 bit, KHÔNG phải JWT */
  generateRefreshToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hashRefreshToken(token) };
  }

  /** Database chỉ lưu mã băm; lộ database cũng không dùng được token */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
