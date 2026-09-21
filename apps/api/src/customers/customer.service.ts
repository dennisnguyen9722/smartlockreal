import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  OPEN_ORDER_STATUSES,
  type CustomerContactInput,
  type CustomerContactUpdateInput,
  type CustomerCreateInput,
  type CustomerListQuery,
  type CustomerUpdateInput,
  type Paginated,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';

type Tx = Prisma.TransactionClient;
type FieldError = { field: string; message: string };

function invalid(errors: FieldError[]): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, errors);
}

/** Lỗi nghiệp vụ giữ nguyên; lỗi Prisma dịch sang lỗi chuẩn */
function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
  throw error;
}

@Injectable()
export class CustomerService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(query: CustomerListQuery, staffId: string): Promise<Paginated<unknown>> {
    const where: Prisma.CustomerWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.mine === 'true' ? { assignedStaffId: staffId } : {}),
      ...(query.search ? { OR: this.searchConditions(query.search) } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          type: true,
          fullName: true,
          phone: true,
          email: true,
          companyName: true,
          taxCode: true,
          source: true,
          createdAt: true,
          group: { select: { id: true, name: true } },
          assignedStaff: { select: { id: true, fullName: true } },
          _count: { select: { orders: true } },
          orders: { orderBy: { placedAt: 'desc' }, take: 1, select: { placedAt: true } },
        },
      }),
      this.db.customer.count({ where }),
    ]);

    // Tổng đã mua (chỉ đơn Hoàn tất) cho các khách trong trang
    const spent = await this.db.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: items.map((item) => item.id) }, status: 'COMPLETED' },
      _sum: { grandTotal: true },
    });

    return {
      items: items.map(({ orders, ...customer }) => ({
        ...customer,
        lastOrderAt: orders[0]?.placedAt ?? null,
        completedTotal: spent.find((row) => row.customerId === customer.id)?._sum.grandTotal ?? 0n,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(id: string) {
    const customer = await this.db.customer.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, code: true, name: true } },
        assignedStaff: { select: { id: true, fullName: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            code: true,
            channel: true,
            status: true,
            grandTotal: true,
            paidTotal: true,
            placedAt: true,
            _count: { select: { lines: true } },
            lines: { orderBy: { createdAt: 'asc' }, take: 1, select: { name: true, quantity: true } },
          },
        },
      },
    });
    if (!customer) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const [orderCount, openCount, completed] = await Promise.all([
      this.db.order.count({ where: { customerId: id } }),
      this.db.order.count({ where: { customerId: id, status: { in: [...OPEN_ORDER_STATUSES] } } }),
      this.db.order.aggregate({ where: { customerId: id, status: 'COMPLETED' }, _sum: { grandTotal: true } }),
    ]);

    return {
      ...customer,
      stats: {
        orderCount,
        openCount,
        completedTotal: completed._sum.grandTotal ?? 0n,
      },
    };
  }

  groups() {
    return this.db.customerGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, isDefault: true, discountBps: true },
    });
  }

  async create(input: CustomerCreateInput, staffId: string, ctx: AuditContext) {
    const groupId = input.groupId ?? (await this.defaultGroupId());
    await this.assertUnique(input.type, input.phone ?? null, input.taxCode ?? null);

    try {
      const customer = await this.db.customer.create({
        data: { ...input, groupId },
      });
      await this.audit.log({
        staffId,
        action: 'customer.create',
        entityType: 'CUSTOMER',
        entityId: customer.id,
        changes: { after: { type: input.type, fullName: input.fullName, phone: input.phone, taxCode: input.taxCode } },
        ctx,
      });
      return this.getById(customer.id);
    } catch (error) {
      rethrow(error);
    }
  }

  async update(id: string, input: CustomerUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.db.customer.findUnique({ where: { id } });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const phone = input.phone !== undefined ? input.phone : before.phone;
    const companyName = input.companyName !== undefined ? input.companyName : before.companyName;
    const taxCode = input.taxCode !== undefined ? input.taxCode : before.taxCode;

    const errors: FieldError[] = [];
    if (before.type === 'INDIVIDUAL' && !phone) errors.push({ field: 'phone', message: 'Khách cá nhân phải có số điện thoại' });
    if (before.type === 'BUSINESS' && !companyName) {
      errors.push({ field: 'companyName', message: 'Khách doanh nghiệp phải có tên công ty' });
    }
    if (errors.length > 0) invalid(errors);

    await this.assertUnique(
      before.type,
      input.phone !== undefined ? phone : null,
      input.taxCode !== undefined ? taxCode : null,
      id,
    );

    try {
      await this.db.customer.update({ where: { id }, data: input });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'customer.update',
      entityType: 'CUSTOMER',
      entityId: id,
      changes: {
        before: { fullName: before.fullName, phone: before.phone, taxCode: before.taxCode, groupId: before.groupId },
        after: input,
      },
      ctx,
    });
    return this.getById(id);
  }

  // ---------- Người liên hệ ----------

  async addContact(customerId: string, input: CustomerContactInput, staffId: string, ctx: AuditContext) {
    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
      include: { _count: { select: { contacts: true } } },
    });
    if (!customer) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    try {
      await this.db.$transaction(async (tx) => {
        // Người đầu tiên tự thành người liên hệ chính
        const isPrimary = input.isPrimary ?? customer._count.contacts === 0;
        if (isPrimary) await this.clearPrimaryInTx(tx, customerId);
        await tx.customerContact.create({ data: { ...input, customerId, isPrimary } });
      });
    } catch (error) {
      rethrow(error);
    }
    await this.audit.log({
      staffId,
      action: 'customer.contact_add',
      entityType: 'CUSTOMER',
      entityId: customerId,
      changes: { after: { fullName: input.fullName, phone: input.phone } },
      ctx,
    });
    return this.getById(customerId);
  }

  async updateContact(contactId: string, input: CustomerContactUpdateInput, staffId: string, ctx: AuditContext) {
    const contact = await this.db.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (input.isPrimary === false && contact.isPrimary) {
      invalid([{ field: 'isPrimary', message: 'Hãy chọn người khác làm liên hệ chính thay vì bỏ chọn' }]);
    }

    try {
      await this.db.$transaction(async (tx) => {
        if (input.isPrimary && !contact.isPrimary) await this.clearPrimaryInTx(tx, contact.customerId);
        await tx.customerContact.update({ where: { id: contactId }, data: input });
      });
    } catch (error) {
      rethrow(error);
    }
    await this.audit.log({
      staffId,
      action: 'customer.contact_update',
      entityType: 'CUSTOMER',
      entityId: contact.customerId,
      changes: { before: { fullName: contact.fullName, phone: contact.phone }, after: input },
      ctx,
    });
    return this.getById(contact.customerId);
  }

  /** Báo giá đã gắn người liên hệ này sẽ tự bỏ liên kết (SetNull), không mất báo giá */
  async removeContact(contactId: string, staffId: string, ctx: AuditContext) {
    const contact = await this.db.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    await this.db.$transaction(async (tx) => {
      await tx.customerContact.delete({ where: { id: contactId } });
      // Xóa người liên hệ chính: người còn lại được thêm sớm nhất thành người chính
      if (contact.isPrimary) {
        const next = await tx.customerContact.findFirst({
          where: { customerId: contact.customerId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (next) await tx.customerContact.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });
    await this.audit.log({
      staffId,
      action: 'customer.contact_delete',
      entityType: 'CUSTOMER',
      entityId: contact.customerId,
      changes: { before: { fullName: contact.fullName, phone: contact.phone } },
      ctx,
    });
    return this.getById(contact.customerId);
  }

  // ---------- Nội bộ ----------

  private async clearPrimaryInTx(tx: Tx, customerId: string) {
    await tx.customerContact.updateMany({ where: { customerId, isPrimary: true }, data: { isPrimary: false } });
  }

  private async defaultGroupId(): Promise<string> {
    const group = await this.db.customerGroup.findFirst({ where: { isDefault: true }, select: { id: true } });
    if (!group) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, {
        hint: 'Chưa có nhóm khách mặc định. Hãy chạy seed database.',
      });
    }
    return group.id;
  }

  /**
   * Báo trùng dễ hiểu trước khi database chặn: SĐT duy nhất với khách cá nhân,
   * mã số thuế duy nhất với khách doanh nghiệp. Kèm tên khách đã có để nhân viên mở ra xem.
   */
  private async assertUnique(type: string, phone: string | null, taxCode: string | null, excludeId?: string) {
    if (type === 'INDIVIDUAL' && phone) {
      const existing = await this.db.customer.findFirst({
        where: { type: 'INDIVIDUAL', phone, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true, fullName: true },
      });
      if (existing) {
        throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, [
          { field: 'phone', message: `Số này đã thuộc khách "${existing.fullName}"`, customerId: existing.id },
        ]);
      }
    }
    if (type === 'BUSINESS' && taxCode) {
      const existing = await this.db.customer.findFirst({
        where: { type: 'BUSINESS', taxCode, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true, fullName: true },
      });
      if (existing) {
        throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, [
          { field: 'taxCode', message: `Mã số thuế đã thuộc "${existing.fullName}"`, customerId: existing.id },
        ]);
      }
    }
  }

  /** Tên, tên công ty, mã số thuế, số điện thoại (gõ 0901... hay 84901... đều được) */
  private searchConditions(search: string): Prisma.CustomerWhereInput[] {
    const conditions: Prisma.CustomerWhereInput[] = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search.toLowerCase() } },
    ];
    const digits = search.replace(/\D/g, '');
    if (digits.length >= 4) {
      const fragment = digits.startsWith('84') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;
      conditions.push({ phone: { contains: fragment } }, { taxCode: { contains: digits } });
    }
    return conditions;
  }
}