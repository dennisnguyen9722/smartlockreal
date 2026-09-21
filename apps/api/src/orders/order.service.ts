import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  OPEN_ORDER_STATUSES,
  Permission,
  PRIVACY_POLICY_VERSION,
  RealtimeEvent,
  RolePermissions,
  roleHasPermission,
  type OrderCreatedEvent,
  type OrderCreateInput,
  type OrderLineInput,
  type OrderListQuery,
  type OrderStatusCounts,
  type Paginated,
  type ShopOrderCreateInput,
  type ShopOrderResult,
  type StaffRoleCode,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { DOCUMENT_PREFIX, nextDocumentCode } from '../common/document-code';
import { PRISMA } from '../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Tx = Prisma.TransactionClient;
type FieldError = { field: string; message: string };

/** Tên biến thể mà trang tạo sản phẩm đặt cho sản phẩm không có tùy chọn */
const DEFAULT_VARIANT_NAME = 'Mặc định';

const CUSTOMER_SOURCE_BY_CHANNEL = {
  WEBSITE: 'WEBSITE',
  ZALO: 'ZALO',
  STORE: 'STORE',
} as const;

/** Tham số của lõi tạo đơn: dùng chung cho đơn web (lượt sau) và đơn nhân viên tạo */
export interface CreateOrderParams extends Omit<OrderCreateInput, 'lines'> {
  lines: OrderLineInput[];
  /** null = khách tự đặt trên web */
  createdById: string | null;
  /** Nhân viên được sửa giá; web thì không */
  allowPriceOverride: boolean;
  /** Web chỉ bán sản phẩm Đang bán; nhân viên được bán cả sản phẩm Nháp (chưa đăng lên web) */
  requirePublished: boolean;
  idempotencyKey?: string;
  placedIp?: string;
  userAgent?: string;
  /** Khách tick đồng ý chính sách dữ liệu cá nhân trên web (Nghị định 13/2023) */
  privacyConsent?: boolean;
}

/** Tóm tắt đơn cho thông báo realtime */
type CreatedOrder = Awaited<ReturnType<OrderService['createInTx']>>;

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
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Khách tự đặt trên website. Gửi lại cùng idempotencyKey (bấm nhiều lần, mạng chập chờn)
   * thì trả lại đúng đơn cũ, không tạo đơn mới.
   */
  async createFromShop(
    input: ShopOrderCreateInput,
    meta: { ip?: string; userAgent?: string },
  ): Promise<ShopOrderResult> {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    try {
      const order = await this.db.$transaction((tx) =>
        this.createInTx(tx, {
          channel: 'WEBSITE',
          fulfillmentType: input.fulfillmentType,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          shipAddressRaw: input.shipAddressRaw,
          fulfillmentLocationId: input.fulfillmentLocationId,
          customerNote: input.customerNote,
          lines: input.lines,
          createdById: null,
          allowPriceOverride: false,
          requirePublished: true,
          idempotencyKey: input.idempotencyKey,
          placedIp: meta.ip,
          userAgent: meta.userAgent,
          privacyConsent: input.privacyConsent,
        }),
      );
      this.notifyCreated(order);
      return this.toShopResult(order);
    } catch (error) {
      // Hai lần bấm gần như cùng lúc: lần sau vướng unique idempotency_key, trả lại đơn của lần trước
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this.findByIdempotencyKey(input.idempotencyKey);
        if (again) return again;
      }
      rethrow(error);
    }
  }

  /** Nhân viên tạo đơn (khách nhắn Zalo, mua tại showroom) */
  async create(input: OrderCreateInput, staffId: string, ctx: AuditContext) {
    try {
      const order = await this.db.$transaction((tx) =>
        this.createInTx(tx, {
          ...input,
          // Mặc định người tạo đơn là người phụ trách
          assignedStaffId: input.assignedStaffId ?? staffId,
          createdById: staffId,
          allowPriceOverride: true,
          requirePublished: false,
        }),
      );
      this.notifyCreated(order);
      await this.audit.log({
        staffId,
        action: 'order.create',
        entityType: 'ORDER',
        entityId: order.id,
        changes: { after: { code: order.code, channel: order.channel, grandTotal: order.grandTotal } },
        ctx,
      });
      return order;
    } catch (error) {
      rethrow(error);
    }
  }

  /**
   * LÕI TẠO ĐƠN, chạy trong transaction của nơi gọi.
   * Chụp lại tên, SKU, giá tại thời điểm đặt: sau này sửa sản phẩm thì đơn cũ không đổi.
   */
  async createInTx(tx: Tx, params: CreateOrderParams) {
    // ----- Sản phẩm và giá -----
    const priced = await this.priceLinesInTx(tx, params.lines, {
      allowPriceOverride: params.allowPriceOverride,
      requirePublished: params.requirePublished,
    });
    const errors: FieldError[] = [...priced.errors];

    // ----- Showroom nhận hàng, nhân viên phụ trách -----
    if (params.fulfillmentType === 'STORE_PICKUP' && params.fulfillmentLocationId) {
      const location = await tx.location.findUnique({
        where: { id: params.fulfillmentLocationId },
        select: { isActive: true },
      });
      if (!location?.isActive) errors.push({ field: 'fulfillmentLocationId', message: 'Showroom không tồn tại hoặc đã tắt' });
    }
    if (params.assignedStaffId) {
      const staff = await tx.staff.findUnique({ where: { id: params.assignedStaffId }, select: { status: true } });
      if (staff?.status !== 'ACTIVE') errors.push({ field: 'assignedStaffId', message: 'Nhân viên phụ trách không hợp lệ' });
    }

    if (errors.length > 0) invalid(errors);
    const orderLines = priced.lines;

    // ----- Tổng tiền (CHECK orders_total_formula trong database kiểm tra lại) -----
    const subtotal = orderLines.reduce((sum, line) => sum + line.lineTotal, 0n);
    const grandTotal = subtotal;
    const depositRequired = BigInt(params.depositRequired ?? 0);
    if (depositRequired > grandTotal) invalid([{ field: 'depositRequired', message: 'Tiền cọc không được lớn hơn tổng đơn' }]);

    // ----- Khách, mã đơn, đơn -----
    const customerId = await this.resolveCustomerInTx(
      tx,
      params.customerName,
      params.customerPhone,
      CUSTOMER_SOURCE_BY_CHANNEL[params.channel],
    );
    if (params.privacyConsent) {
      // Chỉ ghi lần đồng ý đầu tiên; database yêu cầu thời điểm và phiên bản đi cùng nhau
      await tx.customer.updateMany({
        where: { id: customerId, privacyConsentAt: null },
        data: { privacyConsentAt: new Date(), privacyPolicyVersion: PRIVACY_POLICY_VERSION },
      });
    }
    const code = await nextDocumentCode(tx, DOCUMENT_PREFIX.ORDER);

    const order = await tx.order.create({
      data: {
        code,
        channel: params.channel,
        status: 'PENDING_CONFIRMATION',
        fulfillmentType: params.fulfillmentType,
        customerId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        fulfillmentLocationId: params.fulfillmentType === 'STORE_PICKUP' ? params.fulfillmentLocationId : null,
        // Người nhận mặc định là người đặt; nhân viên sửa khi xác nhận nếu khác
        ...(params.fulfillmentType === 'DELIVERY'
          ? {
              shipRecipientName: params.customerName,
              shipRecipientPhone: params.customerPhone,
              shipAddressRaw: params.shipAddressRaw,
            }
          : {}),
        subtotal,
        grandTotal,
        depositRequired,
        customerNote: params.customerNote,
        internalNote: params.internalNote,
        assignedStaffId: params.assignedStaffId,
        createdById: params.createdById,
        idempotencyKey: params.idempotencyKey,
        placedIp: params.placedIp,
        userAgent: params.userAgent?.slice(0, 500),
        lines: { create: orderLines },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING_CONFIRMATION',
            staffId: params.createdById,
            note: params.createdById ? 'Nhân viên tạo đơn' : 'Khách đặt trên website',
          },
        },
      },
      include: { lines: { orderBy: { createdAt: 'asc' }, select: { name: true, quantity: true } } },
    });
    return order;
  }

  /**
   * Báo cho mọi nhân viên xem được đơn. Gọi SAU khi transaction đã commit (không báo đơn chưa tồn tại).
   * Lỗi realtime chỉ ghi log, không bao giờ làm hỏng đơn đã tạo.
   */
  private notifyCreated(order: CreatedOrder) {
    try {
      const [first] = order.lines;
      const more = order.lines.length - 1;
      const payload: OrderCreatedEvent = {
        id: order.id,
        code: order.code,
        channel: order.channel,
        customerName: order.customerName,
        grandTotal: Number(order.grandTotal),
        lineSummary: first
          ? `${first.quantity > 1 ? `${first.quantity} × ` : ''}${first.name}${more > 0 ? ` và ${more} sản phẩm khác` : ''}`
          : '',
        createdByStaff: order.createdById !== null,
      };
      const roles = (Object.keys(RolePermissions) as StaffRoleCode[]).filter((role) =>
        roleHasPermission(role, Permission.ORDER_VIEW),
      );
      for (const role of roles) this.realtime.emitToRole(role, RealtimeEvent.ORDER_CREATED, payload);
    } catch (error) {
      this.logger.error(`Không phát được thông báo đơn ${order.code}: ${(error as Error).message}`);
    }
  }

  private async findByIdempotencyKey(key: string): Promise<ShopOrderResult | null> {
    const order = await this.db.order.findUnique({
      where: { idempotencyKey: key },
      select: { code: true, grandTotal: true, status: true, placedAt: true },
    });
    return order ? this.toShopResult(order) : null;
  }

  private toShopResult(order: { code: string; grandTotal: bigint; status: string; placedAt: Date }): ShopOrderResult {
    return {
      code: order.code,
      grandTotal: Number(order.grandTotal),
      status: order.status as ShopOrderResult['status'],
      placedAt: order.placedAt.toISOString(),
    };
  }

  /**
   * Tính giá và chụp tên, SKU, giá niêm yết của các dòng. Dùng CHUNG cho tạo đơn và sửa sản phẩm trong đơn,
   * để quy tắc giá chỉ nằm một chỗ. Chạy trong transaction của nơi gọi.
   */
  async priceLinesInTx(
    tx: Tx,
    rawLines: OrderLineInput[],
    options: { allowPriceOverride: boolean; requirePublished: boolean },
  ) {
    const lines = this.mergeLines(rawLines);
    const variants = await tx.productVariant.findMany({
      where: { id: { in: lines.map((line) => line.variantId) } },
      include: { product: { select: { id: true, name: true, status: true, type: true } } },
    });

    const errors: FieldError[] = [];
    const prepared = lines.map((line, index) => {
      const variant = variants.find((item) => item.id === line.variantId);
      const at = `lines.${index}`;
      if (!variant) {
        errors.push({ field: `${at}.variantId`, message: 'Sản phẩm không tồn tại' });
        return null;
      }
      const name = variant.name === DEFAULT_VARIANT_NAME ? variant.product.name : `${variant.product.name} - ${variant.name}`;
      const sellable =
        variant.isActive &&
        (options.requirePublished ? variant.product.status === 'ACTIVE' : variant.product.status !== 'ARCHIVED');
      if (!sellable) {
        errors.push({ field: `${at}.variantId`, message: `${name} hiện không bán` });
        return null;
      }

      const listPrice = variant.price;
      const override = options.allowPriceOverride && line.unitPrice !== undefined ? BigInt(line.unitPrice) : null;
      const unitPrice = override ?? listPrice;
      if (unitPrice === 0n && variant.product.type !== 'SERVICE') {
        errors.push({ field: `${at}.unitPrice`, message: `${name} chưa có giá, hãy nhập giá bán` });
        return null;
      }

      const quantity = BigInt(line.quantity);
      const lineSubtotal = unitPrice * quantity;
      return {
        lineType: variant.product.type === 'BUNDLE' ? ('BUNDLE' as const) : ('PRODUCT' as const),
        variantId: variant.id,
        sku: variant.sku,
        name: name.slice(0, 255),
        quantity: line.quantity,
        listPrice,
        unitPrice,
        priceSource: override !== null && override !== listPrice ? ('MANUAL' as const) : ('RETAIL' as const),
        lineSubtotal,
        discountAllocated: 0n,
        lineTotal: lineSubtotal,
        vatRateBps: variant.vatRateBps,
        // Giá chưa VAT; chỉ cộng VAT khi khách lấy hóa đơn (nhân viên xử lý lúc xác nhận)
        vatAmount: 0n,
      };
    });

    return {
      lines: prepared.filter((line): line is NonNullable<typeof line> => line !== null),
      errors,
    };
  }

  /**
   * Nhân viên gõ số điện thoại ở form tạo đơn: nhận ra khách cũ, gợi ý tên và địa chỉ lần trước.
   * Trả về null nếu là khách mới.
   */
  async customerLookup(phone: string) {
    const customer = await this.db.customer.findFirst({
      where: { phone, type: 'INDIVIDUAL' },
      select: { id: true, fullName: true, phone: true, _count: { select: { orders: true } } },
    });
    if (!customer) return null;

    const lastOrder = await this.db.order.findFirst({
      where: { customerId: customer.id },
      orderBy: { placedAt: 'desc' },
      select: {
        code: true,
        placedAt: true,
        shipAddressRaw: true,
        shipStreet: true,
        shipWardName: true,
        shipProvinceName: true,
      },
    });
    // Ưu tiên địa chỉ đã chuẩn hóa; chưa có thì dùng địa chỉ khách tự gõ
    const standardized = lastOrder
      ? [lastOrder.shipStreet, lastOrder.shipWardName, lastOrder.shipProvinceName].filter(Boolean).join(', ')
      : '';
    return {
      ...customer,
      lastOrder: lastOrder ? { code: lastOrder.code, placedAt: lastOrder.placedAt } : null,
      lastAddress: standardized || lastOrder?.shipAddressRaw || null,
    };
  }

  /** Showroom khách có thể đến nhận hàng */
  pickupLocations() {
    return this.db.location.findMany({
      where: { isActive: true },
      orderBy: [{ region: 'asc' }, { code: 'asc' }],
      select: { id: true, name: true, address: true, region: true },
    });
  }

  async list(query: OrderListQuery, staffId: string): Promise<Paginated<unknown> & { statusCounts: OrderStatusCounts }> {
    const baseWhere: Prisma.OrderWhereInput = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.mine === 'true' ? { assignedStaffId: staffId } : {}),
      ...(query.search ? { OR: this.searchConditions(query.search) } : {}),
    };

    const statusWhere: Prisma.OrderWhereInput =
      query.status === 'ALL'
        ? {}
        : query.status === 'OPEN'
          ? { status: { in: [...OPEN_ORDER_STATUSES] } }
          : { status: query.status };
    const where: Prisma.OrderWhereInput = { ...baseWhere, ...statusWhere };

    const [items, total] = await Promise.all([
      this.db.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          code: true,
          channel: true,
          status: true,
          fulfillmentType: true,
          customerName: true,
          customerPhone: true,
          grandTotal: true,
          paidTotal: true,
          depositRequired: true,
          scheduledAt: true,
          placedAt: true,
          needsAttention: true,
          assignedStaff: { select: { id: true, fullName: true } },
          lines: { orderBy: { createdAt: 'asc' }, take: 1, select: { name: true, quantity: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.db.order.count({ where }),
    ]);

    // groupBy để riêng: kiểu generic của groupBy hay làm TypeScript suy luận sai trong Promise.all
    const grouped = await this.db.order.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } });
    const statusCounts: OrderStatusCounts = {
      OPEN: 0,
      ALL: 0,
      PENDING_CONFIRMATION: 0,
      CONFIRMED: 0,
      ORDERED_FROM_BRAND: 0,
      GOODS_ARRIVED: 0,
      FULFILLING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const row of grouped) {
      const count = row._count._all;
      statusCounts.ALL += count;
      if (row.status in statusCounts) statusCounts[row.status as keyof OrderStatusCounts] += count;
      if ((OPEN_ORDER_STATUSES as readonly string[]).includes(row.status)) statusCounts.OPEN += count;
    }

    return { items, total, page: query.page, pageSize: query.pageSize, statusCounts };
  }

  /** Mã đơn, số điện thoại (gõ 0901... hay 84901... đều được) hoặc tên khách */
  private searchConditions(search: string): Prisma.OrderWhereInput[] {
    const conditions: Prisma.OrderWhereInput[] = [
      { code: { contains: search.toUpperCase() } },
      { customerName: { contains: search, mode: 'insensitive' } },
    ];
    const digits = search.replace(/\D/g, '');
    if (digits.length >= 4) {
      // Số lưu dạng +84901234567: bỏ số 0 hoặc 84 ở đầu rồi tìm phần còn lại
      const fragment = digits.startsWith('84') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;
      conditions.push({ customerPhone: { contains: fragment } });
    }
    return conditions;
  }

  /**
   * Gộp các dòng trùng sản phẩm và cùng giá (khách bấm "Thêm vào giỏ" hai lần).
   * Cùng sản phẩm nhưng khác giá (nhân viên sửa giá riêng) thì giữ riêng.
   */
  private mergeLines(lines: OrderLineInput[]): OrderLineInput[] {
    const merged = new Map<string, OrderLineInput>();
    for (const line of lines) {
      const key = `${line.variantId}|${line.unitPrice ?? ''}`;
      const existing = merged.get(key);
      if (existing) existing.quantity += line.quantity;
      else merged.set(key, { ...line });
    }
    return [...merged.values()];
  }

  /**
   * Tìm khách cá nhân theo số điện thoại, chưa có thì tạo vào nhóm mặc định.
   * Dùng INSERT ... ON CONFLICT dựa trên unique index customers_individual_phone_key:
   * hai đơn cùng số mới đặt cùng lúc không tạo trùng khách, và không làm hỏng transaction
   * (bắt lỗi trùng bằng try/catch trong transaction PostgreSQL là không được).
   * Khách cũ thì KHÔNG ghi đè tên: người khác đặt hộ không làm đổi hồ sơ khách.
   */
  private async resolveCustomerInTx(tx: Tx, name: string, phone: string, source: string): Promise<string> {
    const group = await tx.customerGroup.findFirst({ where: { isDefault: true }, select: { id: true } });
    if (!group) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, {
        hint: 'Chưa có nhóm khách mặc định. Hãy chạy seed database.',
      });
    }

    // uuidv7() có sẵn từ PostgreSQL 18, khớp quy ước khóa chính UUID v7
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO customers (id, type, group_id, full_name, phone, source, created_at, updated_at)
      VALUES (uuidv7(), 'INDIVIDUAL', ${group.id}::uuid, ${name}, ${phone}, ${source}::customer_source, now(), now())
      ON CONFLICT (phone) WHERE type = 'INDIVIDUAL' DO NOTHING
      RETURNING id
    `;
    const createdId = inserted[0]?.id;
    if (createdId) return createdId;

    const existing = await tx.customer.findFirst({
      where: { phone, type: 'INDIVIDUAL' },
      select: { id: true },
    });
    if (!existing) throw new Error('Không tìm thấy khách vừa bị trùng số điện thoại');
    return existing.id;
  }
}