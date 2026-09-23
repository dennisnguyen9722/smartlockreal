import { z } from 'zod';
import type { SalesChannelValue } from './order';

/**
 * BÁO CÁO (Bước 9). Quy ước tính số, chốt cùng công ty:
 * - DOANH THU ghi nhận khi đơn **Hoàn tất** (đã giao lắp và thu tiền), tính theo `completed_at`.
 *   Đơn đang xử lý chưa tính là doanh thu, để không báo lố khi đơn bị hủy giữa chừng.
 * - Mọi mốc thời gian gom nhóm theo **giờ Việt Nam**.
 * - Số tiền là VNĐ (số nguyên đồng).
 */

export const REPORT_PRESETS = ['TODAY', 'LAST_7_DAYS', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export const REPORT_PRESET_LABEL: Record<ReportPreset, string> = {
  TODAY: 'Hôm nay',
  LAST_7_DAYS: '7 ngày qua',
  THIS_MONTH: 'Tháng này',
  LAST_MONTH: 'Tháng trước',
  THIS_YEAR: 'Năm nay',
  CUSTOM: 'Tự chọn',
};

/** Gom nhóm cột biểu đồ; API tự chọn theo độ dài khoảng thời gian */
export type ReportGranularity = 'DAY' | 'WEEK' | 'MONTH';

export const ReportQuerySchema = z
  .object({
    /** yyyy-mm-dd theo giờ Việt Nam, tính từ 00:00 ngày from đến hết 23:59 ngày to */
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  })
  .strict()
  .refine((data) => data.from <= data.to, { message: 'Ngày bắt đầu phải trước ngày kết thúc', path: ['from'] });
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export interface ReportSummary {
  /** Doanh thu đơn Hoàn tất trong kỳ */
  revenue: number;
  completedOrders: number;
  /** Doanh thu / số đơn hoàn tất */
  averageOrder: number;
  /** Đơn được đặt trong kỳ (mọi trạng thái, trừ đã hủy) */
  newOrders: number;
  /** Đơn đặt trong kỳ còn đang xử lý */
  processingOrders: number;
  cancelledOrders: number;
  /** Tiền còn phải thu của các đơn đã hoàn tất trong kỳ */
  unpaid: number;
  /** Cùng chỉ số ở kỳ trước liền kề, để so sánh tăng giảm */
  previous: { revenue: number; completedOrders: number };
}

export interface ReportPoint {
  /** yyyy-mm-dd (ngày/tuần bắt đầu) hoặc yyyy-mm (tháng) */
  bucket: string;
  revenue: number;
  completedOrders: number;
}

export interface ReportBreakdownItem {
  key: string;
  label: string;
  revenue: number;
  completedOrders: number;
}

export interface ReportProductItem {
  productId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  revenue: number;
}

export interface ReportResponse {
  from: string;
  to: string;
  granularity: ReportGranularity;
  summary: ReportSummary;
  series: ReportPoint[];
  byChannel: (ReportBreakdownItem & { key: SalesChannelValue })[];
  byStaff: ReportBreakdownItem[];
  topProducts: ReportProductItem[];
}

/** yyyy-mm-dd theo giờ Việt Nam */
export function vnDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Khoảng ngày của một lựa chọn nhanh, tính theo giờ Việt Nam */
export function presetRange(preset: Exclude<ReportPreset, 'CUSTOM'>, now = new Date()): { from: string; to: string } {
  const today = vnDateString(now);
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  const shift = (days: number) => vnDateString(new Date(Date.UTC(year, month - 1, day - days)));
  switch (preset) {
    case 'TODAY':
      return { from: today, to: today };
    case 'LAST_7_DAYS':
      return { from: shift(6), to: today };
    case 'THIS_MONTH':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'LAST_MONTH': {
      const first = new Date(Date.UTC(year, month - 2, 1));
      const last = new Date(Date.UTC(year, month - 1, 0));
      return { from: vnDateString(first), to: vnDateString(last) };
    }
    case 'THIS_YEAR':
      return { from: `${year}-01-01`, to: today };
  }
}

/** "22/09/2026" từ yyyy-mm-dd; "09/2026" từ yyyy-mm */
export function formatBucket(bucket: string, granularity: ReportGranularity): string {
  const parts = bucket.split('-');
  if (granularity === 'MONTH') return `${parts[1]}/${parts[0]}`;
  const text = `${parts[2]}/${parts[1]}`;
  return granularity === 'WEEK' ? `Tuần ${text}` : text;
}

/** Tăng giảm so với kỳ trước, làm tròn 1 chữ số; null khi kỳ trước bằng 0 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// =====================================================================
// TRANG TỔNG QUAN (trang chủ CMS)
// =====================================================================

/**
 * Trang chủ trả lời "hôm nay phải làm gì", nên phần việc cần làm đứng trước số liệu.
 * Nhân viên kinh doanh chỉ thấy việc của mình và KHÔNG thấy doanh thu (chốt ở Bước 9).
 */
export interface DashboardTask {
  key: string;
  label: string;
  count: number;
  /** Đường dẫn CMS đã lọc sẵn, vd /don-hang?status=PENDING_CONFIRMATION */
  href: string;
  /** Cần xử lý gấp: hiện màu nổi */
  urgent: boolean;
  hint?: string;
}

export interface DashboardResponse {
  tasks: DashboardTask[];
  /** Chỉ người có quyền report.view; null với nhân viên kinh doanh */
  money: {
    todayRevenue: number;
    monthRevenue: number;
    previousMonthRevenue: number;
    /** 30 ngày gần nhất, để vẽ biểu đồ nhỏ */
    series: ReportPoint[];
  } | null;
  /** Chỉ người có quyền audit.view */
  recentActivity:
    | {
        id: string;
        action: string;
        entityType: string;
        entityId: string | null;
        entityName: string | null;
        staffName: string | null;
        createdAt: string;
      }[]
    | null;
}
