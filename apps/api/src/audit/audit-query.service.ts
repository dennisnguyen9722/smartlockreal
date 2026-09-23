import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import type { AuditActorItem, AuditListQuery, AuditLogItem, Paginated } from '@ktm/shared';
import { PRISMA } from '../database/database.module';

const LOG_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  changes: true,
  ipAddress: true,
  userAgent: true,
  traceId: true,
  createdAt: true,
  staff: { select: { id: true, fullName: true } },
} satisfies Prisma.AuditLogSelect;

type LogRow = Prisma.AuditLogGetPayload<{ select: typeof LOG_SELECT }>;

/**
 * Đọc nhật ký (quyền audit.view). Chỉ có đọc: không sửa, không xóa — đó là giá trị của nhật ký.
 * Dòng nhật ký giữ nguyên kể cả khi đối tượng đã bị xóa, nên tên đối tượng có thể trống.
 */
@Injectable()
export class AuditQueryService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async list(query: AuditListQuery): Promise<Paginated<AuditLogItem>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.action ? { action: query.action } : query.group ? { action: { startsWith: `${query.group}.` } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };

    const [rows, total] = await this.db.$transaction([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: LOG_SELECT,
      }),
      this.db.auditLog.count({ where }),
    ]);

    const names = await this.resolveEntityNames(rows);
    return {
      items: rows.map((row) => ({
        id: row.id,
        staff: row.staff,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: (row.entityId && names.get(`${row.entityType}:${row.entityId}`)) ?? null,
        changes: row.changes,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        traceId: row.traceId,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Danh sách người từng có thao tác, để đổ vào ô lọc */
  async actors(): Promise<AuditActorItem[]> {
    const rows = await this.db.auditLog.groupBy({ by: ['staffId'], where: { staffId: { not: null } } });
    const ids = rows.map((row) => row.staffId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];
    return this.db.staff.findMany({ where: { id: { in: ids } }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } });
  }

  /**
   * Tên dễ đọc của đối tượng trong từng dòng (mã đơn, tên sản phẩm...).
   * Gom id theo loại rồi truy vấn một lần cho mỗi loại, tối đa vài truy vấn cho cả trang.
   */
  private async resolveEntityNames(rows: LogRow[]): Promise<Map<string, string>> {
    const idsByType = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.entityId) continue;
      idsByType.set(row.entityType, [...(idsByType.get(row.entityType) ?? []), row.entityId]);
    }
    const names = new Map<string, string>();
    const add = (type: string, items: { id: string; name: string | null }[]) => {
      for (const item of items) if (item.name) names.set(`${type}:${item.id}`, item.name);
    };
    const ids = (type: string) => idsByType.get(type) ?? [];

    await Promise.all([
      ids('ORDER').length > 0 &&
        this.db.order
          .findMany({ where: { id: { in: ids('ORDER') } }, select: { id: true, code: true } })
          .then((items) => add('ORDER', items.map((item) => ({ id: item.id, name: item.code })))),
      ids('QUOTE').length > 0 &&
        this.db.quote
          .findMany({ where: { id: { in: ids('QUOTE') } }, select: { id: true, code: true } })
          .then((items) => add('QUOTE', items.map((item) => ({ id: item.id, name: item.code })))),
      ids('CUSTOMER').length > 0 &&
        this.db.customer
          .findMany({ where: { id: { in: ids('CUSTOMER') } }, select: { id: true, fullName: true, companyName: true } })
          .then((items) => add('CUSTOMER', items.map((item) => ({ id: item.id, name: item.companyName ?? item.fullName })))),
      ids('PRODUCT').length > 0 &&
        this.db.product
          .findMany({ where: { id: { in: ids('PRODUCT') } }, select: { id: true, name: true } })
          .then((items) => add('PRODUCT', items)),
      ids('POST').length > 0 &&
        this.db.post
          .findMany({ where: { id: { in: ids('POST') } }, select: { id: true, title: true } })
          .then((items) => add('POST', items.map((item) => ({ id: item.id, name: item.title })))),
      ids('PAGE').length > 0 &&
        this.db.page
          .findMany({ where: { id: { in: ids('PAGE') } }, select: { id: true, title: true } })
          .then((items) => add('PAGE', items.map((item) => ({ id: item.id, name: item.title })))),
      ids('LOCATION').length > 0 &&
        this.db.location
          .findMany({ where: { id: { in: ids('LOCATION') } }, select: { id: true, name: true } })
          .then((items) => add('LOCATION', items)),
      ids('STAFF').length > 0 &&
        this.db.staff
          .findMany({ where: { id: { in: ids('STAFF') } }, select: { id: true, fullName: true } })
          .then((items) => add('STAFF', items.map((item) => ({ id: item.id, name: item.fullName })))),
      ids('BANNER').length > 0 &&
        this.db.banner
          .findMany({ where: { id: { in: ids('BANNER') } }, select: { id: true, title: true } })
          .then((items) => add('BANNER', items.map((item) => ({ id: item.id, name: item.title })))),
      ids('FAQ').length > 0 &&
        this.db.faq
          .findMany({ where: { id: { in: ids('FAQ') } }, select: { id: true, question: true } })
          .then((items) => add('FAQ', items.map((item) => ({ id: item.id, name: item.question })))),
    ]);
    return names;
  }
}
