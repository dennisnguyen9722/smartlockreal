import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  OPEN_QUOTE_STATUSES,
  QUOTE_STATUS_LABEL,
  type Paginated,
  type QuoteActionInput,
  type QuoteConvertInput,
  type QuoteCreateInput,
  type QuoteLinesReplaceInput,
  type QuoteListQuery,
  type QuoteStatusCounts,
  type QuoteStatusValue,
  type QuoteUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { DOCUMENT_PREFIX, nextDocumentCode } from '../common/document-code';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';
import { OrderService } from '../orders/order.service';
import { SettingsService } from '../settings/settings.service';

type Tx = Prisma.TransactionClient;
type FieldError = { field: string; message: string };
type PricedLine = Awaited<ReturnType<OrderService['priceLinesInTx']>>['lines'][number];

const CLOSED_STATUSES: readonly QuoteStatusValue[] = ['REJECTED', 'EXPIRED', 'CANCELLED'];
/** Đã kết thúc hoặc đã bị thay: không thao tác gì nữa */
const FINAL_STATUSES: readonly QuoteStatusValue[] = ['CONVERTED', 'CANCELLED', 'SUPERSEDED'];

const DETAIL_INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  customer: {
    select: {
      id: true,
      type: true,
      fullName: true,
      companyName: true,
      taxCode: true,
      phone: true,
      email: true,
      invoiceAddress: true,
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { id: true, fullName: true, position: true, phone: true, email: true, isPrimary: true } },
    },
  },
  contact: { select: { id: true, fullName: true, position: true, phone: true, email: true } },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  sentBy: { select: { id: true, fullName: true } },
  order: { select: { id: true, code: true, status: true } },
} satisfies Prisma.QuoteInclude;

function invalid(errors: FieldError[]): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, errors);
}

function editConflict(): never {
  throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
}

/** Lỗi nghiệp vụ giữ nguyên; lỗi Prisma dịch sang lỗi chuẩn */
function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
  throw error;
}

function vnd(amount: bigint): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

/** Ngày hôm nay theo giờ Việt Nam cộng thêm N ngày, dạng YYYY-MM-DD */
function vnDatePlus(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

@Injectable()
export class QuoteService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly orders: OrderService,
    private readonly settingsService: SettingsService,
  ) {}

  // ================= Danh sách, chi tiết =================

  async list(query: QuoteListQuery, staffId: string): Promise<Paginated<unknown> & { statusCounts: QuoteStatusCounts }> {
    // Phiên bản đã bị thay thì không hiện ở danh sách (xem trong trang chi tiết của bản mới)
    const baseWhere: Prisma.QuoteWhereInput = {
      status: { not: 'SUPERSEDED' },
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.mine === 'true' ? { createdById: staffId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search.toUpperCase() } },
              { projectName: { contains: query.search, mode: 'insensitive' } },
              { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const statusWhere: Prisma.QuoteWhereInput =
      query.status === 'ALL'
        ? {}
        : query.status === 'OPEN'
          ? { status: { in: [...OPEN_QUOTE_STATUSES] } }
          : query.status === 'CLOSED'
            ? { status: { in: [...CLOSED_STATUSES] } }
            : { status: query.status };
    const where: Prisma.QuoteWhereInput = { AND: [baseWhere, statusWhere] };

    const [items, total] = await Promise.all([
      this.db.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          code: true,
          revision: true,
          status: true,
          projectName: true,
          validUntil: true,
          grandTotal: true,
          referenceSubtotal: true,
          subtotal: true,
          maxDiscountBps: true,
          requiresApproval: true,
          createdAt: true,
          customer: { select: { id: true, fullName: true, companyName: true } },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.db.quote.count({ where }),
    ]);

    const grouped = await this.db.quote.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } });
    const statusCounts: QuoteStatusCounts = {
      OPEN: 0,
      ALL: 0,
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      SENT: 0,
      ACCEPTED: 0,
      CONVERTED: 0,
      CLOSED: 0,
    };
    for (const row of grouped) {
      const count = row._count._all;
      statusCounts.ALL += count;
      if (row.status in statusCounts) statusCounts[row.status as keyof QuoteStatusCounts] += count;
      if (OPEN_QUOTE_STATUSES.includes(row.status)) statusCounts.OPEN += count;
      if (CLOSED_STATUSES.includes(row.status)) statusCounts.CLOSED += count;
    }

    return { items, total, page: query.page, pageSize: query.pageSize, statusCounts };
  }

  async getById(id: string) {
    const quote = await this.db.quote.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!quote) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    const [revisions, settings] = await Promise.all([
      this.db.quote.findMany({
        where: { code: quote.code },
        orderBy: { revision: 'desc' },
        select: { id: true, revision: true, status: true, grandTotal: true, createdAt: true },
      }),
      this.quoteRules(),
    ]);
    return {
      ...quote,
      validUntil: quote.validUntil.toISOString().slice(0, 10),
      /** Số tiền khách tiết kiệm so với giá hệ thống */
      savings: quote.referenceSubtotal - quote.subtotal,
      approvalThresholdBps: settings.thresholdBps,
      revisions,
    };
  }

  // ================= Lập báo giá =================

  async create(input: QuoteCreateInput, staffId: string, ctx: AuditContext) {
    await this.assertCustomerAndContact(input.customerId, input.contactId ?? null);
    const settings = await this.quoteRules();

    try {
      const quote = await this.db.$transaction(async (tx) => {
        const lines = await this.priceInTx(tx, input.lines, input.vatInvoiceRequested);
        const totals = this.totals(lines, BigInt(input.shippingFee), settings.thresholdBps);
        const depositRequired = BigInt(input.depositRequired);
        if (depositRequired > totals.grandTotal) {
          invalid([{ field: 'depositRequired', message: 'Tiền cọc không được lớn hơn tổng báo giá' }]);
        }

        return tx.quote.create({
          data: {
            code: await nextDocumentCode(tx, DOCUMENT_PREFIX.QUOTE),
            status: 'DRAFT',
            customerId: input.customerId,
            contactId: input.contactId,
            projectName: input.projectName,
            siteAddress: input.siteAddress,
            validUntil: toDbDate(input.validUntil ?? vnDatePlus(settings.validDays)),
            vatInvoiceRequested: input.vatInvoiceRequested,
            shippingFee: BigInt(input.shippingFee),
            depositRequired,
            terms: input.terms,
            internalNote: input.internalNote,
            createdById: staffId,
            ...totals,
            lines: { create: lines },
          },
        });
      });

      await this.audit.log({
        staffId,
        action: 'quote.create',
        entityType: 'QUOTE',
        entityId: quote.id,
        changes: { after: { code: quote.code, customerId: input.customerId, grandTotal: quote.grandTotal } },
        ctx,
      });
      return this.getById(quote.id);
    } catch (error) {
      rethrow(error);
    }
  }

  /** Sửa thông tin chung. Chỉ khi Nháp; riêng ghi chú nội bộ sửa được mọi lúc. */
  async update(id: string, input: QuoteUpdateInput, staffId: string, ctx: AuditContext) {
    const { expectedVersion, ...changes } = input;
    const quote = await this.db.quote.findUnique({ where: { id }, include: { lines: true } });
    if (!quote) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (quote.version !== expectedVersion) editConflict();

    const touched = Object.keys(changes).filter((key) => changes[key as keyof typeof changes] !== undefined);
    if (quote.status !== 'DRAFT' && touched.some((key) => key !== 'internalNote')) {
      invalid([{ field: 'status', message: `Báo giá đang "${QUOTE_STATUS_LABEL[quote.status]}": đưa về Nháp hoặc tạo phiên bản mới để sửa` }]);
    }
    if (changes.contactId) await this.assertCustomerAndContact(quote.customerId, changes.contactId);

    const data: Prisma.QuoteUncheckedUpdateManyInput = {};
    for (const key of ['contactId', 'projectName', 'siteAddress', 'terms'] as const) {
      if (changes[key] !== undefined) data[key] = changes[key];
    }
    if (changes.internalNote !== undefined) data.internalNote = changes.internalNote || null;
    if (changes.validUntil !== undefined) data.validUntil = toDbDate(changes.validUntil);

    // Đổi VAT hoặc phí giao: tính lại VAT từng dòng và tổng
    const vat = changes.vatInvoiceRequested ?? quote.vatInvoiceRequested;
    const shippingFee = changes.shippingFee !== undefined ? BigInt(changes.shippingFee) : quote.shippingFee;
    const recalc = changes.vatInvoiceRequested !== undefined || changes.shippingFee !== undefined;
    const lineVat = quote.lines.map((line) => ({ id: line.id, vatAmount: vat ? this.vatOf(line.lineTotal, line.vatRateBps) : 0n }));
    const vatTotal = recalc ? lineVat.reduce((sum, line) => sum + line.vatAmount, 0n) : quote.vatTotal;
    const grandTotal = quote.subtotal + shippingFee + vatTotal;
    const depositRequired = changes.depositRequired !== undefined ? BigInt(changes.depositRequired) : quote.depositRequired;
    if (depositRequired > grandTotal) invalid([{ field: 'depositRequired', message: 'Tiền cọc không được lớn hơn tổng báo giá' }]);

    if (recalc) Object.assign(data, { vatInvoiceRequested: vat, shippingFee, vatTotal, grandTotal });
    if (changes.depositRequired !== undefined) data.depositRequired = depositRequired;

    try {
      await this.db.$transaction(async (tx) => {
        if (recalc) {
          for (const line of lineVat) await tx.quoteLine.update({ where: { id: line.id }, data: { vatAmount: line.vatAmount } });
        }
        await this.bumpVersion(tx, id, expectedVersion, data);
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({ staffId, action: 'quote.update', entityType: 'QUOTE', entityId: id, changes: { after: changes }, ctx });
    return this.getById(id);
  }

  /** Thay toàn bộ dòng (chỉ khi Nháp: trigger database cũng chặn). Tính lại % giảm và cờ cần duyệt. */
  async replaceLines(id: string, input: QuoteLinesReplaceInput, staffId: string, ctx: AuditContext) {
    const quote = await this.db.quote.findUnique({ where: { id } });
    if (!quote) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (quote.version !== input.expectedVersion) editConflict();
    if (quote.status !== 'DRAFT') {
      invalid([{ field: 'lines', message: 'Chỉ sửa sản phẩm khi báo giá còn Nháp' }]);
    }
    const settings = await this.quoteRules();

    try {
      await this.db.$transaction(async (tx) => {
        const lines = await this.priceInTx(tx, input.lines, quote.vatInvoiceRequested);
        const totals = this.totals(lines, quote.shippingFee, settings.thresholdBps);
        if (quote.depositRequired > totals.grandTotal) {
          invalid([{ field: 'lines', message: `Tổng mới nhỏ hơn tiền cọc yêu cầu (${vnd(quote.depositRequired)})` }]);
        }
        await tx.quoteLine.deleteMany({ where: { quoteId: id } });
        await tx.quoteLine.createMany({ data: lines.map((line) => ({ ...line, quoteId: id })) });
        await this.bumpVersion(tx, id, input.expectedVersion, totals);
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'quote.lines_replace',
      entityType: 'QUOTE',
      entityId: id,
      changes: { after: input.lines },
      ctx,
    });
    return this.getById(id);
  }

  // ================= Duyệt, hủy =================

  async act(id: string, input: QuoteActionInput, staffId: string, ctx: AuditContext) {
    const quote = await this.db.quote.findUnique({ where: { id } });
    if (!quote) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (quote.version !== input.expectedVersion) editConflict();

    const status = quote.status;
    const now = new Date();
    const expect = (allowed: QuoteStatusValue[]) => {
      if (!allowed.includes(status)) {
        throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, {
          from: status,
          hint: `Báo giá đang "${QUOTE_STATUS_LABEL[status]}", không thực hiện được thao tác này`,
        });
      }
    };

    let data: Prisma.QuoteUncheckedUpdateManyInput;
    switch (input.action) {
      case 'SUBMIT':
        expect(['DRAFT']);
        if (!quote.requiresApproval) invalid([{ field: 'action', message: 'Báo giá không vượt ngưỡng giảm, không cần duyệt' }]);
        data = { status: 'PENDING_APPROVAL', approvalNote: input.note ?? null };
        break;
      case 'WITHDRAW':
        expect(['PENDING_APPROVAL']);
        data = { status: 'DRAFT' };
        break;
      case 'APPROVE':
        expect(['PENDING_APPROVAL']);
        data = { status: 'APPROVED', approvedById: staffId, approvedAt: now, approvalNote: input.note ?? null };
        break;
      case 'RETURN':
        expect(['PENDING_APPROVAL']);
        if (!input.note) invalid([{ field: 'note', message: 'Trả lại thì cần ghi lý do để nhân viên sửa' }]);
        data = { status: 'DRAFT', approvalNote: input.note };
        break;
      case 'REOPEN':
        // Đã duyệt nhưng cần sửa: về Nháp và bỏ duyệt, sửa xong phải duyệt lại
        expect(['APPROVED']);
        data = { status: 'DRAFT', approvedById: null, approvedAt: null };
        break;
      case 'MARK_SENT':
        // Gửi lại cùng phiên bản (vd: gửi thêm qua Email) thì chỉ cập nhật thời điểm và kênh.
        // Cần duyệt thì phải duyệt xong mới gửi (database cũng chặn: quotes_approved_before_send).
        expect(quote.requiresApproval ? ['APPROVED', 'SENT'] : ['DRAFT', 'APPROVED', 'SENT']);
        if (quote.validUntil.toISOString().slice(0, 10) < vnDatePlus(0)) {
          invalid([{ field: 'validUntil', message: 'Báo giá đã quá ngày hiệu lực: sửa ngày hiệu lực (khi Nháp) hoặc tạo phiên bản mới' }]);
        }
        data = {
          status: 'SENT',
          sentAt: now,
          sentVia: input.via,
          sentById: staffId,
          // Database yêu cầu có link file khi đã gửi: dùng trang in (khách nhận bản PDF lưu từ trang này)
          pdfUrl: `/bao-gia/${id}/in`,
        };
        break;
      case 'ACCEPT':
        expect(['SENT']);
        data = { status: 'ACCEPTED', acceptedAt: now };
        break;
      case 'REJECT':
        expect(['SENT', 'ACCEPTED']);
        data = { status: 'REJECTED', rejectedReason: input.note };
        break;
      case 'CANCEL':
        if (FINAL_STATUSES.includes(status)) expect([]);
        data = {
          status: 'CANCELLED',
          cancelledAt: now,
          internalNote: [quote.internalNote, `Hủy: ${input.note ?? 'không ghi lý do'}`].filter(Boolean).join('\n'),
        };
        break;
    }

    try {
      await this.db.$transaction((tx) => this.bumpVersion(tx, id, input.expectedVersion, data));
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: `quote.${input.action.toLowerCase()}`,
      entityType: 'QUOTE',
      entityId: id,
      changes: { before: { status }, after: { status: data.status, note: input.note } },
      ctx,
    });
    return this.getById(id);
  }

  // ================= Phiên bản mới =================

  /**
   * Khách muốn sửa sau khi đã gửi: bản cũ chuyển "Đã thay thế", bản mới cùng mã, số bản +1, về Nháp.
   * Giữ giá đã báo; giá hệ thống cập nhật theo giá niêm yết hiện tại. Chuyển bản cũ TRƯỚC khi thêm bản mới
   * vì database chỉ cho mỗi mã một bản đang hiệu lực (quotes_one_current_revision).
   */
  async revise(id: string, expectedVersion: number, staffId: string, ctx: AuditContext) {
    const quote = await this.db.quote.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    if (!quote) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (quote.version !== expectedVersion) editConflict();
    if (!(['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as QuoteStatusValue[]).includes(quote.status)) {
      invalid([{ field: 'status', message: 'Chỉ tạo phiên bản mới khi báo giá đã gửi khách. Chưa gửi thì đưa về Nháp để sửa.' }]);
    }
    const settings = await this.quoteRules();

    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.bumpVersion(tx, id, expectedVersion, { status: 'SUPERSEDED' });
        const lines = await this.priceInTx(
          tx,
          quote.lines
            .filter((line) => line.variantId)
            .map((line) => ({ variantId: line.variantId as string, quantity: line.quantity, unitPrice: Number(line.unitPrice) })),
          quote.vatInvoiceRequested,
        );
        const totals = this.totals(lines, quote.shippingFee, settings.thresholdBps);
        return tx.quote.create({
          data: {
            code: quote.code,
            revision: quote.revision + 1,
            previousRevisionId: quote.id,
            status: 'DRAFT',
            customerId: quote.customerId,
            contactId: quote.contactId,
            projectName: quote.projectName,
            siteAddress: quote.siteAddress,
            siteRegion: quote.siteRegion,
            validUntil: toDbDate(vnDatePlus(settings.validDays)),
            vatInvoiceRequested: quote.vatInvoiceRequested,
            shippingFee: quote.shippingFee,
            depositRequired: quote.depositRequired > totals.grandTotal ? totals.grandTotal : quote.depositRequired,
            terms: quote.terms,
            internalNote: quote.internalNote,
            createdById: staffId,
            ...totals,
            lines: { create: lines },
          },
        });
      });

      await this.audit.log({
        staffId,
        action: 'quote.revise',
        entityType: 'QUOTE',
        entityId: created.id,
        changes: { before: { id, revision: quote.revision }, after: { revision: created.revision } },
        ctx,
      });
      return this.getById(created.id);
    } catch (error) {
      rethrow(error);
    }
  }

  // ================= Chuyển thành đơn =================

  /**
   * Khách đồng ý -> tạo đơn kênh Công trình, GIỮ NGUYÊN giá đã báo (price_source = QUOTE, liên kết dòng báo giá).
   * Đơn bắt đầu ở Chờ xác nhận rồi đi theo quy trình đơn hàng (chuẩn hóa địa chỉ, đặt hãng, thu cọc...).
   * Tạo đơn và chuyển báo giá sang "Đã thành đơn" trong cùng một transaction.
   */
  async convert(id: string, input: QuoteConvertInput, staffId: string, ctx: AuditContext) {
    const quote = await this.db.quote.findUnique({
      where: { id },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, customer: true, contact: true },
    });
    if (!quote) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (quote.version !== input.expectedVersion) editConflict();
    if (!(['SENT', 'ACCEPTED'] as QuoteStatusValue[]).includes(quote.status)) {
      invalid([{ field: 'status', message: `Báo giá đang "${QUOTE_STATUS_LABEL[quote.status]}": chỉ báo giá đã gửi hoặc khách đã đồng ý mới tạo đơn được` }]);
    }

    const { customer, contact } = quote;
    const phone = contact?.phone ?? customer.phone ?? '';
    const name = contact?.fullName ?? customer.fullName;
    const errors: FieldError[] = [];
    if (!phone) errors.push({ field: 'phone', message: 'Cần số điện thoại người liên hệ hoặc của khách để tạo đơn' });
    const shipAddressRaw = input.shipAddressRaw ?? quote.siteAddress;
    if (input.fulfillmentType === 'DELIVERY' && !shipAddressRaw) {
      errors.push({ field: 'shipAddressRaw', message: 'Chưa có địa chỉ giao lắp (báo giá chưa ghi địa chỉ công trình)' });
    }
    if (input.fulfillmentType === 'STORE_PICKUP' && input.fulfillmentLocationId) {
      const location = await this.db.location.findUnique({ where: { id: input.fulfillmentLocationId }, select: { isActive: true } });
      if (!location?.isActive) errors.push({ field: 'fulfillmentLocationId', message: 'Showroom không hợp lệ' });
    }
    if (errors.length > 0) invalid(errors);

    const now = new Date();
    const delivery = input.fulfillmentType === 'DELIVERY';
    try {
      const order = await this.db.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            code: await nextDocumentCode(tx, DOCUMENT_PREFIX.ORDER),
            channel: 'PROJECT',
            status: 'PENDING_CONFIRMATION',
            fulfillmentType: input.fulfillmentType,
            customerId: customer.id,
            customerName: name,
            // Đã kiểm tra ở trên: có số điện thoại mới tới được đây
            customerPhone: phone,
            quoteId: quote.id,
            fulfillmentLocationId: delivery ? null : input.fulfillmentLocationId,
            ...(delivery ? { shipRecipientName: name, shipRecipientPhone: phone, shipAddressRaw } : {}),
            subtotal: quote.subtotal,
            shippingFee: quote.shippingFee,
            vatTotal: quote.vatTotal,
            grandTotal: quote.grandTotal,
            depositRequired: quote.depositRequired,
            vatInvoiceRequested: quote.vatInvoiceRequested,
            ...(quote.vatInvoiceRequested
              ? {
                  invoiceBuyerName: customer.companyName ?? customer.fullName,
                  invoiceCompanyName: customer.companyName,
                  invoiceTaxCode: customer.taxCode,
                  invoiceAddress: customer.invoiceAddress,
                  invoiceEmail: contact?.email ?? customer.email,
                }
              : {}),
            assignedStaffId: quote.createdById ?? staffId,
            createdById: staffId,
            internalNote: `Từ báo giá ${quote.code}${quote.revision > 1 ? ` (bản ${quote.revision})` : ''}${quote.projectName ? ` · ${quote.projectName}` : ''}`,
            lines: {
              create: quote.lines.map((line) => ({
                lineType: line.lineType,
                variantId: line.variantId,
                sku: line.sku,
                name: line.name,
                quantity: line.quantity,
                listPrice: line.referencePrice,
                unitPrice: line.unitPrice,
                priceSource: 'QUOTE' as const,
                lineSubtotal: line.lineTotal,
                discountAllocated: 0n,
                lineTotal: line.lineTotal,
                vatRateBps: line.vatRateBps,
                vatAmount: line.vatAmount,
                quoteLineId: line.id,
              })),
            },
            statusHistory: {
              create: { fromStatus: null, toStatus: 'PENDING_CONFIRMATION', staffId, note: `Tạo từ báo giá ${quote.code}` },
            },
          },
          select: { id: true, code: true },
        });
        await this.bumpVersion(tx, id, input.expectedVersion, {
          status: 'CONVERTED',
          convertedAt: now,
          acceptedAt: quote.acceptedAt ?? now,
        });
        return created;
      });

      await this.audit.log({
        staffId,
        action: 'quote.convert',
        entityType: 'QUOTE',
        entityId: id,
        changes: { after: { orderId: order.id, orderCode: order.code } },
        ctx,
      });
      return { orderId: order.id, orderCode: order.code };
    } catch (error) {
      rethrow(error);
    }
  }

  // ================= Trang in =================

  /** Dữ liệu trang in: báo giá + thông tin công ty mới nhất */
  async printData(id: string) {
    const [quote, company] = await Promise.all([this.getById(id), this.settingsService.companyInfo()]);
    return { quote, company };
  }

  // ================= Nội bộ =================

  /** Dùng chung hàm tính giá của đơn hàng; giá hệ thống = giá niêm yết, giá báo = giá nhân viên nhập */
  private async priceInTx(tx: Tx, rawLines: QuoteCreateInput['lines'], vat: boolean) {
    const priced = await this.orders.priceLinesInTx(tx, rawLines, { allowPriceOverride: true, requirePublished: false });
    if (priced.errors.length > 0) invalid(priced.errors);
    return priced.lines.map((line: PricedLine, index) => ({
      lineType: line.lineType,
      variantId: line.variantId,
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      referencePrice: line.listPrice,
      unitPrice: line.unitPrice,
      discountBps: this.discountBps(line.listPrice, line.unitPrice),
      lineTotal: line.lineTotal,
      vatRateBps: line.vatRateBps,
      vatAmount: vat ? this.vatOf(line.lineTotal, line.vatRateBps) : 0n,
      sortOrder: index,
    }));
  }

  /** (giá hệ thống − giá báo) / giá hệ thống, phần vạn; âm nếu báo cao hơn. Giới hạn theo CHECK database. */
  private discountBps(reference: bigint, unit: bigint): number {
    if (reference <= 0n) return 0;
    const bps = Number(((reference - unit) * 10000n) / reference);
    return Math.max(-10000, Math.min(10000, bps));
  }

  private vatOf(lineTotal: bigint, rateBps: number): bigint {
    return (lineTotal * BigInt(rateBps) + 5000n) / 10000n;
  }

  private totals(
    lines: { quantity: number; referencePrice: bigint; lineTotal: bigint; vatAmount: bigint; discountBps: number }[],
    shippingFee: bigint,
    thresholdBps: number,
  ) {
    const referenceSubtotal = lines.reduce((sum, line) => sum + line.referencePrice * BigInt(line.quantity), 0n);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0n);
    const vatTotal = lines.reduce((sum, line) => sum + line.vatAmount, 0n);
    const maxDiscountBps = lines.reduce((max, line) => Math.max(max, line.discountBps), 0);
    return {
      referenceSubtotal,
      subtotal,
      vatTotal,
      grandTotal: subtotal + shippingFee + vatTotal,
      maxDiscountBps,
      // "Giảm quá" ngưỡng mới cần duyệt: đúng bằng ngưỡng thì không cần
      requiresApproval: maxDiscountBps > thresholdBps,
    };
  }

  /** Ngưỡng duyệt và số ngày hiệu lực: sửa ở trang Cấu hình, tab Quy tắc bán hàng */
  private async quoteRules() {
    const [thresholdBps, validDays] = await Promise.all([
      this.settingsService.number('quote.approval_threshold_bps'),
      this.settingsService.number('quote.default_valid_days'),
    ]);
    return { thresholdBps, validDays };
  }

  private async assertCustomerAndContact(customerId: string, contactId: string | null) {
    const customer = await this.db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) invalid([{ field: 'customerId', message: 'Khách hàng không tồn tại' }]);
    if (contactId) {
      const contact = await this.db.customerContact.findUnique({ where: { id: contactId }, select: { customerId: true } });
      if (contact?.customerId !== customerId) invalid([{ field: 'contactId', message: 'Người liên hệ không thuộc khách này' }]);
    }
  }

  /** Khóa lạc quan: chỉ ghi khi version vẫn đúng như nhân viên đang thấy */
  private async bumpVersion(tx: Tx, id: string, expectedVersion: number, data: Prisma.QuoteUncheckedUpdateManyInput) {
    const result = await tx.quote.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) editConflict();
  }
}