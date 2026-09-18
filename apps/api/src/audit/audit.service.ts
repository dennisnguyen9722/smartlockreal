import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
import { PRISMA } from '../database/database.module';
import { type JsonObject, toJsonSafe } from '@ktm/shared';

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  traceId?: string;
}

export interface AuditEntry {
  /** Null với thao tác chưa xác định được người thực hiện (vd: đăng nhập thất bại) */
  staffId?: string;
  /** vd: staff.login, staff.password_changed, order.cancel */
  action: string;
  entityType: string;
  entityId?: string;
  /** { before, after } hoặc dữ liệu bổ sung; TUYỆT ĐỐI không chứa mật khẩu hay token */
  changes?: Record<string, unknown>;
  ctx?: AuditContext;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  /**
   * Ghi nhật ký. Lỗi ghi nhật ký KHÔNG được làm hỏng nghiệp vụ chính,
   * nên hàm này tự bắt lỗi và chỉ ghi log.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.auditLog.create({
        data: {
          staffId: entry.staffId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          changes: (entry.changes ? toJsonSafe(entry.changes) : {}) as JsonObject,
          ipAddress: entry.ctx?.ip,
          userAgent: entry.ctx?.userAgent?.slice(0, 500),
          traceId: entry.ctx?.traceId,
        },
      });
    } catch (error) {
      this.logger.error(`Không ghi được nhật ký "${entry.action}": ${(error as Error).message}`);
    }
  }
}
