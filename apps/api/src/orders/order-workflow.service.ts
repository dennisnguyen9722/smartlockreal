import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  ORDER_LINES_EDITABLE_STATUSES,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  ORDER_TRANSITIONS,
  type OrderLineSerialsInput,
  type OrderLinesReplaceInput,
  type OrderStatusChangeInput,
  type OrderStatusValue,
  type OrderUpdateInput,
  type PaymentCancelInput,
  type PaymentRecordInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';
import { GeoService } from '../geo/geo.service';
import { OrderService } from './order.service';

type Tx = Prisma.TransactionClient;
type FieldError = { field: string; message: string };

/** Trạng thái đã kết thúc: chỉ còn sửa ghi chú nội bộ và hoàn tiền */
const CLOSED: readonly OrderStatusValue[] = ['COMPLETED', 'CANCELLED'];
/** Từ lúc hàng về mới có máy để ghi serial */
const SERIAL_STATUSES: readonly OrderStatusValue[] = ['GOODS_ARRIVED', 'FULFILLING', 'COMPLETED'];

const DETAIL_INCLUDE = {
  lines: { orderBy: { createdAt: 'asc' } },
  payments: {
    orderBy: { createdAt: 'asc' },
    include: { receivedBy: { select: { id: true, fullName: true } } },
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' },
    include: { staff: { select: { id: true, fullName: true } } },
  },
  customer: { select: { id: true, fullName: true, phone: true, type: true, _count: { select: { orders: true } } } },
  assignedStaff: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  fulfillmentLocation: { select: { id: true, name: true, address: true } },
} satisfies Prisma.OrderInclude;

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

@Injectable()
export class OrderWorkflowService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly geo: GeoService,
    private readonly orders: OrderService,
  ) {}

  // ================= Xem =================

  async getById(id: string) {
    const order = await this.db.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!order) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return {
      ...order,
      balanceDue: order.grandTotal - order.paidTotal,
      allowedTransitions: ORDER_TRANSITIONS[order.status],
      /** Lý do chưa chuyển sang bước tiếp theo được; rỗng = được */
      nextStepBlockers: this.nextStepBlockers(order),
    };
  }

  /** Nhân viên có thể nhận phụ trách đơn */
  assignees() {
    return this.db.staff.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    });
  }

  // ================= Sửa thông tin =================

  async update(id: string, input: OrderUpdateInput, staffId: string, ctx: AuditContext) {
    const { expectedVersion, ...changes } = input;
    const before = await this.db.order.findUnique({ where: { id }, include: { lines: true } });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (before.version !== expectedVersion) editConflict();

    const closed = CLOSED.includes(before.status);
    const touched = Object.keys(changes).filter((key) => changes[key as keyof typeof changes] !== undefined);
    if (closed && touched.some((key) => key !== 'internalNote')) {
      invalid([{ field: 'status', message: 'Đơn đã kết thúc: chỉ sửa được ghi chú nội bộ' }]);
    }

    const errors: FieldError[] = [];
    const data: Prisma.OrderUncheckedUpdateManyInput = {};

    // ----- Địa chỉ: tên tỉnh/phường tra từ danh mục, không tin tên do giao diện gửi -----
    if (changes.shipRecipientName !== undefined) data.shipRecipientName = changes.shipRecipientName;
    if (changes.shipRecipientPhone !== undefined) data.shipRecipientPhone = changes.shipRecipientPhone;
    if (changes.shipStreet !== undefined) data.shipStreet = changes.shipStreet;

    if (changes.shipProvinceCode !== undefined || changes.shipWardCode !== undefined) {
      const provinceCode =
        changes.shipProvinceCode !== undefined ? changes.shipProvinceCode : before.shipProvinceCode;
      const wardCode = changes.shipWardCode !== undefined ? changes.shipWardCode : before.shipWardCode;
      if (!provinceCode || !wardCode) {
        data.shipProvinceCode = provinceCode;
        data.shipProvinceName = provinceCode ? (this.geo.provinces().find((p) => p.code === provinceCode)?.name ?? null) : null;
        data.shipWardCode = null;
        data.shipWardName = null;
        data.shipRegion = null;
      } else {
        const resolved = this.geo.resolve(provinceCode, wardCode);
        if (!resolved) {
          errors.push({ field: 'shipWardCode', message: 'Phường/xã không thuộc tỉnh/thành đã chọn' });
        } else {
          data.shipProvinceCode = resolved.provinceCode;
          data.shipProvinceName = resolved.provinceName;
          data.shipWardCode = resolved.wardCode;
          data.shipWardName = resolved.wardName;
          data.shipRegion = resolved.region;
        }
      }
    }

    if (changes.fulfillmentLocationId !== undefined) {
      if (before.fulfillmentType !== 'STORE_PICKUP') {
        errors.push({ field: 'fulfillmentLocationId', message: 'Chỉ đơn nhận tại showroom mới chọn showroom' });
      } else if (changes.fulfillmentLocationId) {
        const location = await this.db.location.findUnique({
          where: { id: changes.fulfillmentLocationId },
          select: { isActive: true },
        });
        if (!location?.isActive) errors.push({ field: 'fulfillmentLocationId', message: 'Showroom không hợp lệ' });
        else data.fulfillmentLocationId = changes.fulfillmentLocationId;
      }
    }

    // ----- Làm việc với hãng, nội bộ -----
    if (changes.scheduledAt !== undefined) data.scheduledAt = changes.scheduledAt ? new Date(changes.scheduledAt) : null;
    if (changes.brandOrderRef !== undefined) data.brandOrderRef = changes.brandOrderRef;
    if (changes.brandTechnicianNote !== undefined) data.brandTechnicianNote = changes.brandTechnicianNote;
    if (changes.internalNote !== undefined) data.internalNote = changes.internalNote || null;
    if (changes.assignedStaffId !== undefined) {
      if (changes.assignedStaffId) {
        const staff = await this.db.staff.findUnique({ where: { id: changes.assignedStaffId }, select: { status: true } });
        if (staff?.status !== 'ACTIVE') errors.push({ field: 'assignedStaffId', message: 'Nhân viên không hợp lệ' });
      }
      data.assignedStaffId = changes.assignedStaffId;
    }

    // ----- Hóa đơn -----
    for (const key of ['invoiceBuyerName', 'invoiceCompanyName', 'invoiceTaxCode', 'invoiceAddress', 'invoiceEmail'] as const) {
      if (changes[key] !== undefined) data[key] = changes[key];
    }
    const vatRequested = changes.vatInvoiceRequested ?? before.vatInvoiceRequested;
    const buyerName = changes.invoiceBuyerName !== undefined ? changes.invoiceBuyerName : before.invoiceBuyerName;
    if (vatRequested && !buyerName) {
      errors.push({ field: 'invoiceBuyerName', message: 'Lấy hóa đơn thì phải có tên người mua' });
    }

    // ----- Tiền: tính lại tổng khi đổi phí giao hàng hoặc bật/tắt VAT -----
    const recalc = changes.shippingFee !== undefined || changes.vatInvoiceRequested !== undefined;
    const lineVat = before.lines.map((line) => ({
      id: line.id,
      vatAmount: vatRequested ? (line.lineTotal * BigInt(line.vatRateBps) + 5000n) / 10000n : 0n,
    }));
    const vatTotal = recalc ? lineVat.reduce((sum, line) => sum + line.vatAmount, 0n) : before.vatTotal;
    const shippingFee = changes.shippingFee !== undefined ? BigInt(changes.shippingFee) : before.shippingFee;
    const grandTotal = before.subtotal - before.discountTotal + shippingFee + vatTotal;
    const depositRequired = changes.depositRequired !== undefined ? BigInt(changes.depositRequired) : before.depositRequired;

    if (recalc) {
      data.vatInvoiceRequested = vatRequested;
      data.vatTotal = vatTotal;
      data.shippingFee = shippingFee;
      data.grandTotal = grandTotal;
    }
    if (changes.depositRequired !== undefined) data.depositRequired = depositRequired;
    if (grandTotal < before.paidTotal) {
      errors.push({ field: 'grandTotal', message: `Tổng đơn mới (${vnd(grandTotal)}) nhỏ hơn số đã thu (${vnd(before.paidTotal)}). Hãy ghi hoàn tiền trước.` });
    }
    if (depositRequired > grandTotal) errors.push({ field: 'depositRequired', message: 'Tiền cọc không được lớn hơn tổng đơn' });

    if (errors.length > 0) invalid(errors);

    try {
      await this.db.$transaction(async (tx) => {
        await this.bumpVersion(tx, id, expectedVersion, data);
        if (recalc) {
          for (const line of lineVat) {
            await tx.orderLine.update({ where: { id: line.id }, data: { vatAmount: line.vatAmount } });
          }
        }
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'order.update',
      entityType: 'ORDER',
      entityId: id,
      changes: { after: changes },
      ctx,
    });
    return this.getById(id);
  }

  // ================= Sửa sản phẩm trong đơn =================

  /**
   * Thay toàn bộ danh sách sản phẩm (khách đổi ý sau khi tư vấn). Chỉ trước bước Đã đặt hãng.
   * Dùng chung hàm tính giá với lúc tạo đơn; tính lại tạm tính, VAT (nếu lấy hóa đơn) và tổng.
   */
  async replaceLines(id: string, input: OrderLinesReplaceInput, staffId: string, ctx: AuditContext) {
    const order = await this.db.order.findUnique({ where: { id }, include: { lines: true } });
    if (!order) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (order.version !== input.expectedVersion) editConflict();
    if (!ORDER_LINES_EDITABLE_STATUSES.includes(order.status)) {
      invalid([{ field: 'lines', message: 'Đơn đã đặt hãng: không sửa sản phẩm được nữa' }]);
    }

    try {
      await this.db.$transaction(async (tx) => {
        const priced = await this.orders.priceLinesInTx(tx, input.lines, {
          allowPriceOverride: true,
          requirePublished: false,
        });
        if (priced.errors.length > 0) invalid(priced.errors);

        const lines = priced.lines.map((line) => ({
          ...line,
          orderId: id,
          vatAmount: order.vatInvoiceRequested ? (line.lineTotal * BigInt(line.vatRateBps) + 5000n) / 10000n : 0n,
        }));
        const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0n);
        const vatTotal = lines.reduce((sum, line) => sum + line.vatAmount, 0n);
        const grandTotal = subtotal - order.discountTotal + order.shippingFee + vatTotal;

        const errors: FieldError[] = [];
        if (grandTotal < order.paidTotal) {
          errors.push({ field: 'lines', message: `Tổng mới (${vnd(grandTotal)}) nhỏ hơn số đã thu (${vnd(order.paidTotal)}). Hãy ghi hoàn tiền trước.` });
        }
        if (order.depositRequired > grandTotal) {
          errors.push({ field: 'lines', message: `Tổng mới nhỏ hơn tiền cọc yêu cầu (${vnd(order.depositRequired)}). Hãy giảm cọc trước.` });
        }
        if (errors.length > 0) invalid(errors);

        await tx.orderLine.deleteMany({ where: { orderId: id } });
        await tx.orderLine.createMany({ data: lines });
        await this.bumpVersion(tx, id, input.expectedVersion, { subtotal, vatTotal, grandTotal });
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'order.lines_replace',
      entityType: 'ORDER',
      entityId: id,
      changes: {
        before: order.lines.map((line) => ({ sku: line.sku, quantity: line.quantity, unitPrice: line.unitPrice })),
        after: input.lines,
      },
      ctx,
    });
    return this.getById(id);
  }

  // ================= Chuyển trạng thái =================

  async changeStatus(id: string, input: OrderStatusChangeInput, staffId: string, ctx: AuditContext) {
    const order = await this.db.order.findUnique({ where: { id } });
    if (!order) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (order.version !== input.expectedVersion) editConflict();

    const from = order.status;
    const to = input.to;
    if (!ORDER_TRANSITIONS[from].includes(to)) {
      throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, {
        from,
        to,
        hint: `Không thể chuyển từ "${ORDER_STATUS_LABEL[from]}" sang "${ORDER_STATUS_LABEL[to]}"`,
      });
    }

    const forward = ORDER_STATUS_FLOW.indexOf(to) > ORDER_STATUS_FLOW.indexOf(from);
    const now = new Date();
    const data: Prisma.OrderUncheckedUpdateManyInput = { status: to };

    if (to === 'CANCELLED') {
      if (!input.cancelReason) invalid([{ field: 'cancelReason', message: 'Chưa nhập lý do hủy đơn' }]);
      if (order.paidTotal > 0n) {
        invalid([{ field: 'paidTotal', message: `Đơn đã thu ${vnd(order.paidTotal)}. Hãy ghi hoàn tiền trước khi hủy.` }]);
      }
      data.cancelledAt = now;
      data.cancelReason = input.cancelReason;
    } else if (forward) {
      const blockers = this.nextStepBlockers(order);
      if (blockers.length > 0) invalid(blockers);
      if (to === 'CONFIRMED' && !order.confirmedAt) data.confirmedAt = now;
      if (to === 'ORDERED_FROM_BRAND') {
        data.brandOrderedAt = order.brandOrderedAt ?? now;
        if (input.brandOrderRef) data.brandOrderRef = input.brandOrderRef;
      }
      if (to === 'GOODS_ARRIVED') data.goodsArrivedAt = now;
      if (to === 'COMPLETED') data.completedAt = now;
    } else {
      // Lùi một bước (bấm nhầm): xóa mốc thời gian của bước bị lùi
      if (from === 'GOODS_ARRIVED') data.goodsArrivedAt = null;
      if (from === 'ORDERED_FROM_BRAND') data.brandOrderedAt = null;
    }

    try {
      await this.db.$transaction(async (tx) => {
        await this.bumpVersion(tx, id, input.expectedVersion, data);
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            fromStatus: from,
            toStatus: to,
            staffId,
            note: to === 'CANCELLED' ? `Hủy: ${input.cancelReason}` : forward ? (input.note ?? null) : `Lùi bước${input.note ? `: ${input.note}` : ''}`,
          },
        });
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'order.status_change',
      entityType: 'ORDER',
      entityId: id,
      changes: { before: { status: from }, after: { status: to, note: input.note, cancelReason: input.cancelReason } },
      ctx,
    });
    return this.getById(id);
  }

  /** Điều kiện để sang bước tiếp theo (giao diện hiện trước, API kiểm tra lại) */
  private nextStepBlockers(order: {
    status: OrderStatusValue;
    fulfillmentType: string;
    fulfillmentLocationId: string | null;
    shipRecipientName: string | null;
    shipRecipientPhone: string | null;
    shipProvinceCode: string | null;
    shipWardCode: string | null;
    shipStreet: string | null;
    grandTotal: bigint;
    paidTotal: bigint;
  }): FieldError[] {
    const blockers: FieldError[] = [];
    if (order.status === 'PENDING_CONFIRMATION') {
      if (order.fulfillmentType === 'DELIVERY') {
        if (!order.shipRecipientName || !order.shipRecipientPhone) {
          blockers.push({ field: 'shipRecipientName', message: 'Chưa có tên và số điện thoại người nhận' });
        }
        if (!order.shipProvinceCode || !order.shipWardCode) {
          blockers.push({ field: 'shipWardCode', message: 'Chưa chọn tỉnh/thành và phường/xã' });
        }
        if (!order.shipStreet) blockers.push({ field: 'shipStreet', message: 'Chưa nhập số nhà, tên đường' });
      } else if (!order.fulfillmentLocationId) {
        blockers.push({ field: 'fulfillmentLocationId', message: 'Chưa chọn showroom nhận hàng' });
      }
    }
    if (order.status === 'FULFILLING' && order.paidTotal < order.grandTotal) {
      blockers.push({
        field: 'paidTotal',
        message: `Còn ${vnd(order.grandTotal - order.paidTotal)} chưa thu. Công ty không bán nợ: ghi nhận đủ tiền rồi mới hoàn tất.`,
      });
    }
    return blockers;
  }

  // ================= Thanh toán =================

  async recordPayment(orderId: string, input: PaymentRecordInput, staffId: string, ctx: AuditContext) {
    const order = await this.db.order.findUnique({ where: { id: orderId }, include: { _count: { select: { payments: true } } } });
    if (!order) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (order.version !== input.expectedVersion) editConflict();

    const amount = BigInt(input.amount);
    const refund = input.purpose === 'REFUND';
    if (!refund && CLOSED.includes(order.status)) {
      invalid([{ field: 'purpose', message: 'Đơn đã kết thúc: chỉ ghi được hoàn tiền' }]);
    }
    if (!refund && order.paidTotal + amount > order.grandTotal) {
      invalid([{ field: 'amount', message: `Vượt số còn phải thu (${vnd(order.grandTotal - order.paidTotal)})` }]);
    }
    if (refund && amount > order.paidTotal) {
      invalid([{ field: 'amount', message: `Hoàn quá số đã thu (${vnd(order.paidTotal)})` }]);
    }

    // Nội dung chuyển khoản duy nhất (database yêu cầu với chuyển khoản không phải hoàn tiền)
    const transferContent =
      input.method === 'BANK_TRANSFER' && !refund
        ? `${order.code.replace(/-/g, '')} ${order._count.payments + 1}`
        : null;

    try {
      await this.db.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            orderId,
            method: input.method,
            purpose: input.purpose,
            status: 'SUCCEEDED',
            amount,
            transferContent,
            paidAt: new Date(),
            receivedById: staffId,
            note: input.note,
          },
        });
        await this.bumpVersion(tx, orderId, input.expectedVersion, {
          paidTotal: refund ? order.paidTotal - amount : order.paidTotal + amount,
        });
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: refund ? 'payment.refund' : 'payment.record',
      entityType: 'ORDER',
      entityId: orderId,
      changes: { after: { method: input.method, purpose: input.purpose, amount: input.amount } },
      ctx,
    });
    return this.getById(orderId);
  }

  /** Ghi nhầm khoản thu: hủy (giữ lại dấu vết), không xóa */
  async cancelPayment(paymentId: string, input: PaymentCancelInput, staffId: string, ctx: AuditContext) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    const order = payment.order;
    if (order.version !== input.expectedVersion) editConflict();
    if (payment.status !== 'SUCCEEDED') invalid([{ field: 'status', message: 'Khoản này đã bị hủy trước đó' }]);

    const refund = payment.purpose === 'REFUND';
    const paidTotal = refund ? order.paidTotal + payment.amount : order.paidTotal - payment.amount;
    if (paidTotal > order.grandTotal) {
      invalid([{ field: 'status', message: 'Hủy khoản hoàn này sẽ làm số đã thu vượt tổng đơn' }]);
    }

    const receivedAt = payment.paidAt?.toISOString() ?? '';
    try {
      await this.db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentId },
          // Database: chỉ khoản SUCCEEDED mới có paid_at; ghi lại thời điểm cũ vào ghi chú
          data: {
            status: 'CANCELLED',
            paidAt: null,
            note: [payment.note, `Đã hủy: ${input.reason} (ghi nhận lúc ${receivedAt})`].filter(Boolean).join(' · '),
          },
        });
        await this.bumpVersion(tx, order.id, input.expectedVersion, { paidTotal });
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'payment.cancel',
      entityType: 'ORDER',
      entityId: order.id,
      changes: { before: { paymentId, amount: payment.amount, purpose: payment.purpose }, after: { reason: input.reason } },
      ctx,
    });
    return this.getById(order.id);
  }

  // ================= Serial =================

  async updateSerials(lineId: string, input: OrderLineSerialsInput, staffId: string, ctx: AuditContext) {
    const line = await this.db.orderLine.findUnique({ where: { id: lineId }, include: { order: { select: { id: true, status: true } } } });
    if (!line) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!SERIAL_STATUSES.includes(line.order.status)) {
      invalid([{ field: 'serialNumbers', message: 'Hàng về rồi mới ghi được serial' }]);
    }
    const serials = [...new Set(input.serialNumbers)];
    if (serials.length !== input.serialNumbers.length) {
      invalid([{ field: 'serialNumbers', message: 'Có serial bị nhập hai lần' }]);
    }
    if (serials.length > line.quantity) {
      invalid([{ field: 'serialNumbers', message: `Dòng này chỉ có ${line.quantity} máy` }]);
    }

    await this.db.orderLine.update({ where: { id: lineId }, data: { serialNumbers: serials } });
    await this.audit.log({
      staffId,
      action: 'order.serials',
      entityType: 'ORDER',
      entityId: line.order.id,
      changes: { before: { lineId, serialNumbers: line.serialNumbers }, after: { serialNumbers: serials } },
      ctx,
    });
    return this.getById(line.order.id);
  }

  /**
   * Cập nhật kèm khóa lạc quan: chỉ ghi khi version vẫn đúng như nhân viên đang thấy.
   * Không khớp = có người vừa sửa trước -> báo EDIT_CONFLICT thay vì ghi đè.
   */
  private async bumpVersion(tx: Tx, id: string, expectedVersion: number, data: Prisma.OrderUncheckedUpdateManyInput) {
    const result = await tx.order.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) editConflict();
  }
}