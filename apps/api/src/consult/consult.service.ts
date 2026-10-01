import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  Permission,
  RealtimeEvent,
  RolePermissions,
  roleHasPermission,
  type ConsultItem,
  type ConsultRequestedEvent,
  type ConsultListQuery,
  type ConsultStatusCounts,
  type ConsultSubmitInput,
  type ConsultSubmitResult,
  type ConsultUpdateInput,
  type Paginated,
  type StaffRoleCode,
  CONSULT_STATUSES,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PRISMA } from '../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Yêu cầu tư vấn từ website.
 *
 * Dữ liệu cá nhân: KHÔNG ghi tên và số điện thoại ra nhật ký ứng dụng. Nhật ký
 * thường được gom về nơi khác và lưu lâu hơn cơ sở dữ liệu, số điện thoại khách
 * lọt ra đó là rò rỉ mà không ai để ý.
 */

/** Gửi lại trong khoảng này với cùng số điện thoại thì coi là bấm nhầm hai lần */
const TRUNG_LAP_PHUT = 10;

const CHON: Prisma.ConsultRequestSelect = {
  id: true,
  kind: true,
  status: true,
  fullName: true,
  phone: true,
  email: true,
  company: true,
  quantity: true,
  doorTypeName: true,
  productSlug: true,
  productName: true,
  message: true,
  sourcePath: true,
  internalNote: true,
  contactedAt: true,
  createdAt: true,
  updatedAt: true,
};

type Hang = Prisma.ConsultRequestGetPayload<{ select: typeof CHON }>;

@Injectable()
export class ConsultService {
  private readonly logger = new Logger(ConsultService.name);

  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ================= Khách gửi =================

  async submit(input: ConsultSubmitInput): Promise<ConsultSubmitResult> {
    // Bấm Gửi hai lần, hoặc mạng chậm rồi bấm lại: dùng lại bản ghi cũ thay vì
    // đẻ ra hai dòng giống hệt nhau cho nhân viên phải tự đoán.
    const moc = new Date(Date.now() - TRUNG_LAP_PHUT * 60 * 1000);
    const daCo = await this.db.consultRequest.findFirst({
      where: { phone: input.phone, kind: input.kind, createdAt: { gte: moc } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (daCo) {
      this.logger.log(`Yêu cầu tư vấn trùng trong ${TRUNG_LAP_PHUT} phút, dùng lại ${daCo.id}`);
      return { id: daCo.id, duplicated: true };
    }

    const row = await this.db.consultRequest.create({
      data: {
        kind: input.kind,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        company: input.company,
        quantity: input.quantity ?? null,
        doorTypeName: input.doorTypeName,
        productSlug: input.productSlug,
        productName: input.productName,
        message: input.message,
        sourcePath: input.sourcePath,
      },
      select: { id: true },
    });

    // Chỉ ghi id và loại yêu cầu — không ghi tên, số điện thoại hay nội dung
    this.logger.log(`Yêu cầu tư vấn mới ${row.id} (${input.kind})`);

    this.baoNhanVien(row.id, input);
    return { id: row.id, duplicated: false };
  }

  /**
   * Bắn thông báo tới nhân viên đang mở trang quản trị.
   *
   * Bọc try/catch và KHÔNG await: khách đã gửi xong rồi, WebSocket trục trặc thì
   * cũng không được để khách thấy lỗi hay phải chờ. Yêu cầu đã nằm trong cơ sở
   * dữ liệu, cùng lắm là nhân viên thấy chậm khi tải lại trang.
   */
  private baoNhanVien(id: string, input: ConsultSubmitInput) {
    try {
      const phan = [
        input.quantity ? `${input.quantity} bộ` : null,
        input.company,
        input.productName,
        input.doorTypeName,
        input.message,
      ].filter(Boolean) as string[];

      const payload: ConsultRequestedEvent = {
        id,
        kind: input.kind,
        fullName: input.fullName,
        phone: input.phone,
        summary: phan.join(' · ').slice(0, 160),
      };

      // Chỉ những vai trò được xem dữ liệu khách mới nhận được, vì nội dung có số điện thoại
      const vaiTro = (Object.keys(RolePermissions) as StaffRoleCode[]).filter((role) =>
        roleHasPermission(role, Permission.CUSTOMER_VIEW),
      );
      for (const role of vaiTro) {
        this.realtime.emitToRole(role, RealtimeEvent.QUOTE_REQUESTED, payload);
      }
    } catch (error) {
      this.logger.error(`Không phát được thông báo yêu cầu ${id}: ${(error as Error).message}`);
    }
  }

  // ================= Trang quản trị =================

  async list(query: ConsultListQuery): Promise<
    Paginated<ConsultItem> & { statusCounts: ConsultStatusCounts }
  > {
    // Mọi bộ lọc TRỪ trạng thái: dùng chung cho danh sách và số đếm từng tab
    const locChung: Prisma.ConsultRequestWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { company: { contains: query.q, mode: 'insensitive' } },
              // Số lưu dạng +84…, khách tra bằng 09… nên bỏ số 0 đầu đi rồi tìm
              { phone: { contains: query.q.replace(/^0/, '').replace(/\D/g, '') } },
            ],
          }
        : {}),
    };

    const where: Prisma.ConsultRequestWhereInput = {
      ...locChung,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total, nhom] = await Promise.all([
      this.db.consultRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: CHON,
      }),
      this.db.consultRequest.count({ where }),
      this.db.consultRequest.groupBy({
        by: ['status'],
        where: locChung,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      CONSULT_STATUSES.map((trangThai) => [
        trangThai,
        nhom.find((item) => item.status === trangThai)?._count._all ?? 0,
      ]),
    ) as ConsultStatusCounts;

    return {
      items: items.map((row) => this.toItem(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts,
    };
  }

  async getById(id: string): Promise<ConsultItem> {
    const row = await this.db.consultRequest.findUnique({ where: { id }, select: CHON });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.toItem(row);
  }

  async update(
    id: string,
    input: ConsultUpdateInput,
    staffId: string,
    ctx: AuditContext,
  ): Promise<ConsultItem> {
    const hienTai = await this.db.consultRequest.findUnique({
      where: { id },
      select: { status: true, updatedAt: true },
    });
    if (!hienTai) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const data: Prisma.ConsultRequestUpdateInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.internalNote !== undefined) data.internalNote = input.internalNote;

    // Lần đầu chuyển khỏi "Mới" là lúc thật sự có người gọi khách. Ghi lại mốc đó
    // để sau còn đo được bao lâu thì khách được gọi lại.
    if (input.status && input.status !== 'NEW' && hienTai.status === 'NEW') {
      data.contactedAt = new Date();
    }

    if (Object.keys(data).length === 0) return this.getById(id);

    // Khóa lạc quan: hai nhân viên cùng mở một yêu cầu thì người sau bị chặn,
    // không âm thầm đè mất ghi chú của người trước.
    if (input.expectedUpdatedAt) {
      const ketQua = await this.db.consultRequest.updateMany({
        where: { id, updatedAt: new Date(input.expectedUpdatedAt) },
        data,
      });
      if (ketQua.count === 0) {
        throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT, {
          hint: 'Có người vừa sửa yêu cầu này. Tải lại trang rồi thử lại.',
        });
      }
    } else {
      await this.db.consultRequest.update({ where: { id }, data });
    }

    await this.audit.log({
      staffId,
      action: 'consult.update',
      entityType: 'CONSULT_REQUEST',
      entityId: id,
      // Không ghi tên hay số điện thoại vào nhật ký, chỉ ghi cái gì đổi
      changes: { after: { status: input.status ?? null, coGhiChu: input.internalNote != null } },
      ctx,
    });

    return this.getById(id);
  }

  private toItem(row: Hang): ConsultItem {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      company: row.company,
      quantity: row.quantity,
      doorTypeName: row.doorTypeName,
      productSlug: row.productSlug,
      productName: row.productName,
      message: row.message,
      sourcePath: row.sourcePath,
      internalNote: row.internalNote,
      contactedAt: row.contactedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
