import { randomInt } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import type { Redis } from 'ioredis';
import {
  ErrorCode,
  checkPasswordStrength,
  type StaffCreateInput,
  type StaffDetail,
  type StaffListItem,
  type StaffPasswordResult,
  type StaffRoleCode,
  type StaffSessionItem,
  type StaffStatusActionInput,
  type StaffStatusValue,
  type StaffUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ACCESS_TOKEN_TTL_SECONDS } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';
import { REDIS } from '../redis/redis.module';

function invalid(field: string, message: string): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [{ field, message }]);
}

function forbidden(hint: string): never {
  throw new AppException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, { hint });
}

function editConflict(): never {
  throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
}

/** Bỏ ký tự dễ nhầm (0/O, 1/l/I) vì mật khẩu tạm hay được đọc qua điện thoại hoặc Zalo */
const PASSWORD_ALPHABET = {
  lower: 'abcdefghijkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digit: '23456789',
};

/** Mật khẩu tạm dạng "Kt7m-Xp4q-Rw9z": dễ đọc, đạt chính sách mật khẩu (≥ 12 ký tự, hoa, thường, số) */
function generateTemporaryPassword(): string {
  const all = PASSWORD_ALPHABET.lower + PASSWORD_ALPHABET.upper + PASSWORD_ALPHABET.digit;
  for (;;) {
    const groups = Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => all[randomInt(all.length)]).join(''),
    );
    const password = groups.join('-');
    if (checkPasswordStrength(password).valid) return password;
  }
}

const STAFF_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffSelect;

type StaffRow = Prisma.StaffGetPayload<{ select: typeof STAFF_SELECT }>;

/**
 * Quản lý nhân viên (quyền staff.manage, chỉ quản trị). Nhân viên tự đổi mật khẩu ở /auth/change-password.
 *
 * Luật an toàn:
 * - Không tự khóa, tự đổi vai trò, tự đặt lại mật khẩu của chính mình (tránh tự khóa mình ra ngoài).
 * - Luôn còn ít nhất MỘT quản trị đang hoạt động.
 * - Khóa tài khoản, đổi vai trò, đặt lại mật khẩu -> thu hồi MỌI phiên ngay (kể cả access token còn hạn),
 *   vì quyền nằm trong access token: không thu hồi thì quyền cũ còn dùng được tới 15 phút.
 */
@Injectable()
export class StaffService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  // ================= Đọc =================

  async list(actorId: string): Promise<StaffListItem[]> {
    const [rows, sessions] = await Promise.all([
      this.db.staff.findMany({ orderBy: [{ status: 'asc' }, { fullName: 'asc' }], select: STAFF_SELECT }),
      this.db.staffSession.groupBy({
        by: ['staffId'],
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        _count: { _all: true },
      }),
    ]);
    const sessionCount = new Map(sessions.map((row) => [row.staffId, row._count._all]));
    return rows.map((row) => this.toListItem(row, actorId, sessionCount.get(row.id) ?? 0));
  }

  async getById(id: string, actorId: string, currentSessionId?: string): Promise<StaffDetail> {
    const row = await this.db.staff.findUnique({ where: { id }, select: STAFF_SELECT });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const [sessions, orders, quotes, customers] = await Promise.all([
      this.activeSessions(id, currentSessionId),
      this.db.order.count({ where: { OR: [{ createdById: id }, { assignedStaffId: id }] } }),
      this.db.quote.count({ where: { createdById: id } }),
      this.db.customer.count({ where: { assignedStaffId: id } }),
    ]);
    return {
      ...this.toListItem(row, actorId, sessions.length),
      sessions,
      stats: { orders, quotes, customers },
    };
  }

  /** Phiên đang mở của chính mình (trang Tài khoản của tôi) */
  mySessions(staffId: string, currentSessionId: string): Promise<StaffSessionItem[]> {
    return this.activeSessions(staffId, currentSessionId);
  }

  // ================= Ghi =================

  async create(input: StaffCreateInput, actorId: string, ctx: AuditContext): Promise<StaffPasswordResult> {
    const existing = await this.db.staff.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) invalid('email', 'Email này đã có tài khoản');

    const temporaryPassword = input.password ? null : generateTemporaryPassword();
    const passwordHash = await this.passwords.hash(input.password ?? (temporaryPassword as string));

    let id: string;
    try {
      const created = await this.db.staff.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          phone: input.phone ?? null,
          role: input.role,
          passwordHash,
        },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      mapPrismaError(error);
    }

    // Không bao giờ ghi mật khẩu vào nhật ký
    await this.audit.log({
      staffId: actorId,
      action: 'staff.create',
      entityType: 'STAFF',
      entityId: id,
      changes: { after: { email: input.email, fullName: input.fullName, role: input.role } },
      ctx,
    });
    return { staff: await this.getById(id, actorId), temporaryPassword };
  }

  async update(id: string, input: StaffUpdateInput, actorId: string, ctx: AuditContext): Promise<StaffDetail> {
    const current = await this.load(id, input.expectedUpdatedAt);

    const data: Prisma.StaffUpdateManyMutationInput = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined && input.email !== current.email) {
      const taken = await this.db.staff.findFirst({ where: { email: input.email, id: { not: id } }, select: { id: true } });
      if (taken) invalid('email', 'Email này đã có tài khoản khác');
      data.email = input.email;
    }

    const roleChanged = input.role !== undefined && input.role !== current.role;
    if (roleChanged) {
      if (id === actorId) forbidden('Không tự đổi vai trò của chính mình');
      if (current.role === 'SUPER_ADMIN') await this.assertAnotherActiveAdmin(id);
      data.role = input.role;
    }

    await this.write(id, current.updatedAt, data);
    // Quyền nằm trong access token: đổi vai trò thì bắt đăng nhập lại để nhận quyền mới
    const revoked = roleChanged ? await this.revokeAll(id, 'ROLE_CHANGED') : 0;

    await this.audit.log({
      staffId: actorId,
      action: 'staff.update',
      entityType: 'STAFF',
      entityId: id,
      changes: {
        before: { email: current.email, fullName: current.fullName, phone: current.phone, role: current.role },
        after: { ...data, revokedSessions: revoked },
      },
      ctx,
    });
    return this.getById(id, actorId);
  }

  async changeStatus(id: string, input: StaffStatusActionInput, actorId: string, ctx: AuditContext): Promise<StaffDetail> {
    const current = await this.load(id, input.expectedUpdatedAt);
    let revoked = 0;

    switch (input.action) {
      case 'DISABLE':
        if (id === actorId) forbidden('Không tự khóa tài khoản của chính mình');
        if (current.status === 'DISABLED') forbidden('Tài khoản đã bị khóa');
        if (current.role === 'SUPER_ADMIN') await this.assertAnotherActiveAdmin(id);
        await this.write(id, current.updatedAt, { status: 'DISABLED' });
        revoked = await this.revokeAll(id, 'ADMIN');
        break;
      case 'ENABLE':
        if (current.status === 'ACTIVE') forbidden('Tài khoản đang hoạt động');
        // Mở lại thì xóa luôn khóa tạm do nhập sai mật khẩu
        await this.write(id, current.updatedAt, { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null });
        break;
      case 'UNLOCK':
        await this.write(id, current.updatedAt, { failedLoginCount: 0, lockedUntil: null });
        break;
    }

    await this.audit.log({
      staffId: actorId,
      action: `staff.${input.action.toLowerCase()}`,
      entityType: 'STAFF',
      entityId: id,
      changes: { before: { status: current.status }, revokedSessions: revoked },
      ctx,
    });
    return this.getById(id, actorId);
  }

  /** Đặt lại mật khẩu (nhân viên quên mật khẩu). Trả mật khẩu tạm MỘT lần, không lưu ở đâu khác */
  async resetPassword(id: string, password: string | undefined, actorId: string, ctx: AuditContext): Promise<StaffPasswordResult> {
    if (id === actorId) forbidden('Đổi mật khẩu của chính mình ở trang Tài khoản của tôi');
    const current = await this.db.staff.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const temporaryPassword = password ? null : generateTemporaryPassword();
    const passwordHash = await this.passwords.hash(password ?? (temporaryPassword as string));
    await this.db.staff.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    const revoked = await this.revokeAll(id, 'PASSWORD_RESET');

    await this.audit.log({
      staffId: actorId,
      action: 'staff.password_reset',
      entityType: 'STAFF',
      entityId: id,
      changes: { revokedSessions: revoked, generated: temporaryPassword !== null },
      ctx,
    });
    return { staff: await this.getById(id, actorId), temporaryPassword };
  }

  /**
   * Đăng xuất một phiên (máy lạ, máy cũ). ownerId: chỉ cho thu hồi phiên của người này
   * (dùng cho "Tài khoản của tôi"); bỏ trống khi quản trị thu hồi phiên bất kỳ.
   */
  async revokeSession(sessionId: string, actorId: string, ctx: AuditContext, ownerId?: string): Promise<void> {
    const session = await this.db.staffSession.findUnique({ where: { id: sessionId }, select: { staffId: true, familyId: true, revokedAt: true } });
    if (!session || (ownerId && session.staffId !== ownerId)) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (session.revokedAt) return;

    await this.revokeWhere({ familyId: session.familyId }, 'ADMIN');
    await this.audit.log({
      staffId: actorId,
      action: 'staff.session_revoke',
      entityType: 'STAFF',
      entityId: session.staffId,
      changes: { sessionId },
      ctx,
    });
  }

  /**
   * Xóa hẳn: CHỈ tài khoản CHƯA TỪNG DÙNG (tạo nhầm email, người không nhận việc).
   * Chỉ cần đăng nhập một lần là đã có dòng trong nhật ký (khóa ngoại Restrict) -> không xóa được nữa,
   * vì nhật ký và chứng từ phải giữ được "ai đã làm gì". Trường hợp đó thì KHÓA tài khoản.
   */
  async remove(id: string, actorId: string, ctx: AuditContext): Promise<void> {
    if (id === actorId) forbidden('Không tự xóa tài khoản của chính mình');
    const staff = await this.db.staff.findUnique({ where: { id }, select: { email: true, fullName: true, role: true, lastLoginAt: true } });
    if (!staff) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (staff.role === 'SUPER_ADMIN') await this.assertAnotherActiveAdmin(id);

    // Đếm các dấu vết hay gặp để báo lý do dễ hiểu; khóa ngoại còn lại do database chặn (bắt P2003 bên dưới)
    const [logs, orders, quotes, customers, media] = await Promise.all([
      this.db.auditLog.count({ where: { staffId: id } }),
      this.db.order.count({ where: { OR: [{ createdById: id }, { assignedStaffId: id }] } }),
      this.db.quote.count({ where: { OR: [{ createdById: id }, { approvedById: id }, { sentById: id }] } }),
      this.db.customer.count({ where: { assignedStaffId: id } }),
      this.db.mediaAsset.count({ where: { uploadedById: id } }),
    ]);
    const used = logs + orders + quotes + customers + media;
    if (used > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        orders,
        quotes,
        customers,
        hint:
          staff.lastLoginAt || logs > 0
            ? 'Tài khoản đã từng đăng nhập hoặc đã làm việc trên hệ thống nên không xóa được (phải giữ dấu vết trong nhật ký, đơn hàng, báo giá). Hãy KHÓA tài khoản.'
            : 'Tài khoản đang gắn với dữ liệu khác nên không xóa được. Hãy KHÓA tài khoản.',
      });
    }

    try {
      // Phiên đăng nhập xóa theo (Cascade); các bảng khác là Restrict nên lỗi P2003 nghĩa là còn dữ liệu trỏ tới
      await this.db.staff.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          hint: 'Tài khoản đang gắn với dữ liệu khác nên không xóa được. Hãy KHÓA tài khoản.',
        });
      }
      mapPrismaError(error);
    }

    await this.audit.log({
      staffId: actorId,
      action: 'staff.delete',
      entityType: 'STAFF',
      entityId: id,
      changes: { before: { email: staff.email, fullName: staff.fullName, role: staff.role } },
      ctx,
    });
  }

  /** "Đăng xuất các phiên khác": giữ phiên đang dùng, thu hồi mọi phiên còn lại của chính mình */
  async revokeOtherSessions(staffId: string, currentSessionId: string, ctx: AuditContext): Promise<number> {
    const current = await this.db.staffSession.findUnique({ where: { id: currentSessionId }, select: { familyId: true } });
    const revoked = await this.revokeWhere(
      { staffId, ...(current ? { familyId: { not: current.familyId } } : { id: { not: currentSessionId } }) },
      'LOGOUT',
    );
    await this.audit.log({ staffId, action: 'staff.sessions_revoke_others', entityType: 'STAFF', entityId: staffId, changes: { revoked }, ctx });
    return revoked;
  }

  /** Quản trị đăng xuất mọi phiên của một nhân viên (mất máy, nghi lộ mật khẩu) */
  async revokeAllSessions(id: string, actorId: string, ctx: AuditContext): Promise<StaffDetail> {
    const exists = await this.db.staff.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (id === actorId) forbidden('Muốn đăng xuất các máy khác của chính mình, dùng trang Tài khoản của tôi');
    const revoked = await this.revokeAll(id, 'ADMIN');
    await this.audit.log({ staffId: actorId, action: 'staff.sessions_revoke_all', entityType: 'STAFF', entityId: id, changes: { revoked }, ctx });
    return this.getById(id, actorId);
  }

  // ================= Nội bộ =================

  private async load(id: string, expectedUpdatedAt: string) {
    const current = await this.db.staff.findUnique({
      where: { id },
      select: { email: true, fullName: true, phone: true, role: true, status: true, updatedAt: true },
    });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) editConflict();
    return current;
  }

  /** Khóa lạc quan: chỉ ghi khi chưa ai sửa kể từ lúc tải */
  private async write(id: string, updatedAt: Date, data: Prisma.StaffUpdateManyMutationInput) {
    try {
      const result = await this.db.staff.updateMany({ where: { id, updatedAt }, data });
      if (result.count === 0) editConflict();
    } catch (error) {
      if (error instanceof AppException) throw error;
      mapPrismaError(error);
    }
  }

  private async assertAnotherActiveAdmin(exceptId: string) {
    const others = await this.db.staff.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: exceptId } } });
    if (others === 0) forbidden('Phải còn ít nhất một quản trị đang hoạt động');
  }

  private revokeAll(staffId: string, reason: string): Promise<number> {
    return this.revokeWhere({ staffId }, reason);
  }

  /** Thu hồi phiên trong database + đánh dấu Redis để chặn access token còn hạn (giống AuthService) */
  private async revokeWhere(where: Prisma.StaffSessionWhereInput, reason: string): Promise<number> {
    const sessions = await this.db.staffSession.findMany({ where: { ...where, revokedAt: null }, select: { id: true } });
    if (sessions.length === 0) return 0;
    await this.db.staffSession.updateMany({ where: { ...where, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
    const pipeline = this.redis.pipeline();
    for (const session of sessions) {
      pipeline.set(AuthService.revokedKey(session.id), reason, 'EX', ACCESS_TOKEN_TTL_SECONDS);
    }
    await pipeline.exec();
    return sessions.length;
  }

  private async activeSessions(staffId: string, currentSessionId?: string): Promise<StaffSessionItem[]> {
    const rows = await this.db.staffSession.findMany({
      where: { staffId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, familyId: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
    if (rows.length === 0) return [];
    // Thời điểm đăng nhập = phiên đầu tiên của cùng family (các lần làm mới token tạo phiên mới trong family)
    const starts = await this.db.staffSession.groupBy({
      by: ['familyId'],
      where: { familyId: { in: rows.map((row) => row.familyId) } },
      _min: { createdAt: true },
    });
    const startByFamily = new Map(starts.map((row) => [row.familyId, row._min.createdAt]));
    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      signedInAt: (startByFamily.get(row.familyId) ?? row.createdAt).toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      isCurrent: row.id === currentSessionId,
    }));
  }

  private toListItem(row: StaffRow, actorId: string, activeSessions: number): StaffListItem {
    const locked = row.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil.toISOString() : null;
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      phone: row.phone,
      role: row.role as StaffRoleCode,
      status: row.status as StaffStatusValue,
      lockedUntil: locked,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      activeSessions,
      isSelf: row.id === actorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}