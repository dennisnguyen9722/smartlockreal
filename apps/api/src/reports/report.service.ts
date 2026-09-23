import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  SALES_CHANNEL_LABEL,
  auditActionLabel,
  roleHasPermission,
  type DashboardResponse,
  type DashboardTask,
  type StaffRoleCode,
  type ReportBreakdownItem,
  type ReportGranularity,
  type ReportPoint,
  type ReportProductItem,
  type ReportQuery,
  type ReportResponse,
  type ReportSummary,
  type SalesChannelValue,
} from '@ktm/shared';
import { PRISMA } from '../database/database.module';

/** Giờ Việt Nam: mọi mốc ngày trong báo cáo cắt theo múi giờ này, không theo UTC */
const TZ = 'Asia/Ho_Chi_Minh';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toNumber(value: bigint | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** yyyy-mm-dd theo giờ Việt Nam */
function vnDateStringOf(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** 00:00 giờ Việt Nam của ngày yyyy-mm-dd, trả về mốc UTC tương ứng */
function vnStartOfDay(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

/** 00:00 giờ Việt Nam của NGÀY KẾ TIẾP: dùng làm mốc "nhỏ hơn" để lấy trọn ngày cuối */
function vnEndExclusive(date: string): Date {
  const start = vnStartOfDay(date);
  return new Date(start.getTime() + MS_PER_DAY);
}

@Injectable()
export class ReportService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async overview(query: ReportQuery): Promise<ReportResponse> {
    const start = vnStartOfDay(query.from);
    const end = vnEndExclusive(query.to);
    const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    // Kỳ trước liền kề, dài đúng bằng kỳ đang xem
    const previousStart = new Date(start.getTime() - days * MS_PER_DAY);
    const granularity: ReportGranularity = days <= 31 ? 'DAY' : days <= 120 ? 'WEEK' : 'MONTH';

    const completedIn = (fromDate: Date, toDate: Date): Prisma.OrderWhereInput => ({
      status: 'COMPLETED',
      completedAt: { gte: fromDate, lt: toDate },
    });

    const [completed, previous, placed, cancelled, processing, channels, staff] = await Promise.all([
      this.db.order.aggregate({ where: completedIn(start, end), _sum: { grandTotal: true, paidTotal: true }, _count: { _all: true } }),
      this.db.order.aggregate({ where: completedIn(previousStart, start), _sum: { grandTotal: true }, _count: { _all: true } }),
      this.db.order.count({ where: { placedAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } } }),
      this.db.order.count({ where: { placedAt: { gte: start, lt: end }, status: 'CANCELLED' } }),
      this.db.order.count({ where: { placedAt: { gte: start, lt: end }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      this.db.order.groupBy({ by: ['channel'], where: completedIn(start, end), _sum: { grandTotal: true }, _count: { _all: true } }),
      this.db.order.groupBy({ by: ['assignedStaffId'], where: completedIn(start, end), _sum: { grandTotal: true }, _count: { _all: true } }),
    ]);

    const revenue = toNumber(completed._sum.grandTotal);
    const summary: ReportSummary = {
      revenue,
      completedOrders: completed._count._all,
      averageOrder: completed._count._all > 0 ? Math.round(revenue / completed._count._all) : 0,
      newOrders: placed,
      processingOrders: processing,
      cancelledOrders: cancelled,
      unpaid: Math.max(0, revenue - toNumber(completed._sum.paidTotal)),
      previous: { revenue: toNumber(previous._sum.grandTotal), completedOrders: previous._count._all },
    };

    const [series, topProducts, staffNames] = await Promise.all([
      this.series(start, end, granularity),
      this.topProducts(start, end),
      this.staffNames(staff.map((row) => row.assignedStaffId).filter((id): id is string => Boolean(id))),
    ]);

    return {
      from: query.from,
      to: query.to,
      granularity,
      summary,
      series,
      byChannel: channels
        .map((row) => ({
          key: row.channel as SalesChannelValue,
          label: SALES_CHANNEL_LABEL[row.channel as SalesChannelValue] ?? row.channel,
          revenue: toNumber(row._sum.grandTotal),
          completedOrders: row._count._all,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      byStaff: staff
        .map((row): ReportBreakdownItem => ({
          key: row.assignedStaffId ?? 'UNASSIGNED',
          label: row.assignedStaffId ? (staffNames.get(row.assignedStaffId) ?? 'Nhân viên đã xóa') : 'Chưa giao ai phụ trách',
          revenue: toNumber(row._sum.grandTotal),
          completedOrders: row._count._all,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      topProducts,
    };
  }

  /**
   * Số liệu trang chủ. Nhân viên kinh doanh chỉ đếm việc của mình
   * (đơn mình phụ trách, báo giá mình lập) và không nhận phần doanh thu.
   */
  async dashboard(staffId: string, role: StaffRoleCode): Promise<DashboardResponse> {
    const canSeeMoney = roleHasPermission(role, 'report.view');
    const canModerateReviews = roleHasPermission(role, 'review.moderate');
    const canSeeActivity = roleHasPermission(role, 'audit.view');
    // Nhân viên kinh doanh: chỉ việc của mình; link sang danh sách cũng thêm mine=true
    const mineOnly = !canSeeMoney;
    const mineOrder = mineOnly ? { assignedStaffId: staffId } : {};
    const mineQuote = mineOnly ? { createdById: staffId } : {};
    const mineParam = mineOnly ? '&mine=true' : '';

    const today = new Date();
    const todayStart = vnStartOfDay(vnDateStringOf(today));
    const monthStart = vnStartOfDay(`${vnDateStringOf(today).slice(0, 7)}-01`);
    const previousMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, monthStart.getUTCDate()));
    const seriesStart = new Date(todayStart.getTime() - 29 * MS_PER_DAY);
    const tomorrow = new Date(todayStart.getTime() + MS_PER_DAY);
    // Báo giá sắp hết hạn trong 3 ngày tới (cột valid_until là ngày, không có giờ)
    const soon = new Date(todayStart.getTime() + 3 * MS_PER_DAY);

    const [pending, waitingGoods, fulfilling, unpaid, quotesPending, quotesExpiring, reviews] = await Promise.all([
      this.db.order.count({ where: { ...mineOrder, status: 'PENDING_CONFIRMATION' } }),
      this.db.order.count({ where: { ...mineOrder, status: 'ORDERED_FROM_BRAND' } }),
      this.db.order.count({ where: { ...mineOrder, status: 'FULFILLING' } }),
      this.db.order.count({ where: { ...mineOrder, status: 'COMPLETED', paidTotal: { lt: this.db.order.fields.grandTotal } } }),
      this.db.quote.count({ where: { ...mineQuote, status: 'PENDING_APPROVAL' } }),
      this.db.quote.count({ where: { ...mineQuote, status: { in: ['SENT', 'APPROVED'] }, validUntil: { gte: todayStart, lt: soon } } }),
      canModerateReviews ? this.db.productReview.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    ]);

    const tasks: DashboardTask[] = [
      { key: 'orders.pending', label: 'Đơn chờ xác nhận', count: pending, href: `/don-hang?status=PENDING_CONFIRMATION${mineParam}`, urgent: pending > 0, hint: 'Gọi khách xác nhận trong ngày' },
      { key: 'orders.waiting_goods', label: 'Đơn chờ hàng về', count: waitingGoods, href: `/don-hang?status=ORDERED_FROM_BRAND${mineParam}`, urgent: false, hint: 'Đã đặt hãng' },
      { key: 'orders.fulfilling', label: 'Đơn đang giao lắp', count: fulfilling, href: `/don-hang?status=FULFILLING${mineParam}`, urgent: false },
      { key: 'quotes.pending', label: 'Báo giá chờ duyệt', count: quotesPending, href: `/bao-gia?status=PENDING_APPROVAL${mineParam}`, urgent: quotesPending > 0 && canSeeMoney },
      { key: 'quotes.expiring', label: 'Báo giá sắp hết hạn', count: quotesExpiring, href: `/bao-gia?status=SENT${mineParam}`, urgent: quotesExpiring > 0, hint: 'Hết hạn trong 3 ngày tới' },
      { key: 'orders.unpaid', label: 'Đơn hoàn tất chưa thu đủ', count: unpaid, href: `/don-hang?status=COMPLETED${mineParam}`, urgent: unpaid > 0 },
    ];
    if (canModerateReviews) {
      tasks.push({ key: 'reviews.pending', label: 'Đánh giá chờ duyệt', count: reviews, href: '/danh-gia?status=PENDING', urgent: false });
    }

    const money = canSeeMoney
      ? await this.dashboardMoney(todayStart, tomorrow, monthStart, previousMonthStart, seriesStart)
      : null;
    const recentActivity = canSeeActivity ? await this.recentActivity() : null;
    return { tasks, money, recentActivity };
  }

  // ================= Nội bộ =================

  /**
   * Doanh thu theo cột biểu đồ. Dùng SQL thô vì Prisma không gom nhóm theo ngày/tuần/tháng được;
   * generate_series để ngày không có đơn vẫn có cột 0 (biểu đồ không bị đứt quãng).
   */
  private async series(start: Date, end: Date, granularity: ReportGranularity): Promise<ReportPoint[]> {
    const unit = granularity === 'DAY' ? 'day' : granularity === 'WEEK' ? 'week' : 'month';
    const rows = await this.db.$queryRaw<{ bucket: string; revenue: bigint | null; orders: bigint }[]>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${unit}, ${start}::timestamptz AT TIME ZONE ${TZ}),
          date_trunc(${unit}, (${end}::timestamptz - interval '1 millisecond') AT TIME ZONE ${TZ}),
          ('1 ' || ${unit})::interval
        ) AS bucket
      )
      -- Trả về dạng chuỗi: tránh trình điều khiển hiểu nhầm múi giờ khi đổi sang Date của JavaScript
      SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
             COALESCE(SUM(o."grand_total"), 0) AS revenue,
             COUNT(o."id") AS orders
      FROM buckets b
      LEFT JOIN "orders" o
        ON o."status" = 'COMPLETED'
       AND o."completed_at" >= ${start}
       AND o."completed_at" < ${end}
       AND date_trunc(${unit}, o."completed_at" AT TIME ZONE ${TZ}) = b.bucket
      GROUP BY b.bucket
      ORDER BY b.bucket
    `;
    return rows.map((row) => ({
      bucket: granularity === 'MONTH' ? row.bucket.slice(0, 7) : row.bucket,
      revenue: toNumber(row.revenue),
      completedOrders: Number(row.orders),
    }));
  }

  /** Bán chạy trong kỳ, tính theo dòng đơn của các đơn đã Hoàn tất */
  private async topProducts(start: Date, end: Date): Promise<ReportProductItem[]> {
    const rows = await this.db.$queryRaw<
      { product_id: string | null; name: string; sku: string | null; quantity: bigint; revenue: bigint | null }[]
    >`
      SELECT v."product_id",
             COALESCE(p."name", l."name") AS name,
             MIN(l."sku") AS sku,
             SUM(l."quantity") AS quantity,
             SUM(l."line_total") AS revenue
      FROM "order_lines" l
      JOIN "orders" o ON o."id" = l."order_id"
      LEFT JOIN "product_variants" v ON v."id" = l."variant_id"
      LEFT JOIN "products" p ON p."id" = v."product_id"
      WHERE o."status" = 'COMPLETED'
        AND o."completed_at" >= ${start}
        AND o."completed_at" < ${end}
        -- PRODUCT và BUNDLE (combo) là dòng có tiền; BUNDLE_COMPONENT, INSTALLATION, GIFT giá 0 nên bỏ
        AND l."line_type" IN ('PRODUCT', 'BUNDLE')
      GROUP BY v."product_id", COALESCE(p."name", l."name")
      ORDER BY revenue DESC NULLS LAST
      LIMIT 10
    `;
    return rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      sku: row.sku,
      quantity: Number(row.quantity),
      revenue: toNumber(row.revenue),
    }));
  }

  private async dashboardMoney(todayStart: Date, tomorrow: Date, monthStart: Date, previousMonthStart: Date, seriesStart: Date) {
    const sum = async (fromDate: Date, toDate: Date) =>
      toNumber((await this.db.order.aggregate({ where: { status: 'COMPLETED', completedAt: { gte: fromDate, lt: toDate } }, _sum: { grandTotal: true } }))._sum.grandTotal);

    const [todayRevenue, monthRevenue, previousMonthRevenue, series] = await Promise.all([
      sum(todayStart, tomorrow),
      sum(monthStart, tomorrow),
      sum(previousMonthStart, monthStart),
      this.series(seriesStart, tomorrow, 'DAY'),
    ]);
    return { todayRevenue, monthRevenue, previousMonthRevenue, series };
  }

  /** Vài dòng nhật ký mới nhất cho trang chủ (quản trị) */
  private async recentActivity() {
    const rows = await this.db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, staff: { select: { fullName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      action: auditActionLabel(row.action),
      entityType: row.entityType,
      entityId: row.entityId,
      entityName: null,
      staffName: row.staff?.fullName ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async staffNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.staff.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    return new Map(rows.map((row) => [row.id, row.fullName]));
  }
}
