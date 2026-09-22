import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
import {
  normalizeOrderCodeSearch,
  normalizeSerialSearch,
  normalizeVnPhone,
  type OrderStatusValue,
  type WarrantyDevice,
  type WarrantyLookupResult,
  type WarrantyMatch,
  type WarrantyOrder,
  type WarrantyState,
} from '@ktm/shared';
import { PRISMA } from '../database/database.module';

/** Nhiều hơn số này thì báo "nên tìm cụ thể hơn" */
const MAX_ORDERS = 50;

/** Dòng không phải máy: công lắp đặt, dòng cha của combo (máy nằm ở các dòng thành phần) */
const NON_DEVICE_LINE_TYPES = ['INSTALLATION', 'BUNDLE'] as const;

const VN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày theo giờ Việt Nam, dạng yyyy-mm-dd */
function vnDate(date: Date): string {
  return VN_DATE.format(date);
}

/** Cộng tháng, giữ ngày cuối tháng hợp lệ: 31/01 + 1 tháng = 28/02 (không nhảy sang 03/03) */
function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  const targetMonthIndex = month - 1 + months;
  const lastDay = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(year, targetMonthIndex, Math.min(day, lastDay)));
  return result.toISOString().slice(0, 10);
}

/** Thoát ký tự đặc biệt của LIKE: serial được phép chứa "_" (vốn là ký tự đại diện) */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class WarrantyService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  /**
   * Tìm theo số điện thoại, serial (gõ một phần cũng được) hoặc mã đơn — cùng lúc cả ba,
   * vì có serial chỉ gồm chữ số trông như số điện thoại.
   */
  async lookup(rawQuery: string): Promise<WarrantyLookupResult> {
    const phone = normalizeVnPhone(rawQuery);
    const serial = normalizeSerialSearch(rawQuery);
    const orderCode = normalizeOrderCodeSearch(rawQuery);
    const interpretedAs = { phone, serial, orderCode };

    if (!phone && !serial && !orderCode) {
      return { query: rawQuery, interpretedAs, orders: [], truncated: false };
    }

    const serialLike = serial ? `%${escapeLike(serial)}%` : null;

    // SQL thô vì Prisma không lọc được "một phần tử trong mảng chứa chuỗi con".
    // Không dùng chỉ mục GIN: GIN chỉ tìm được serial khớp ĐÚNG cả chuỗi, trong khi nhân viên hay gõ vài số cuối.
    // Với số đơn của công ty (vài nghìn/năm) quét bảng vẫn dưới vài chục mili giây.
    const matches = await this.db.$queryRaw<{ id: string; by_phone: boolean; by_serial: boolean; by_code: boolean }[]>`
      SELECT id, by_phone, by_serial, by_code
      FROM (
        SELECT o.id, o.placed_at,
          (${phone}::text IS NOT NULL AND (
            o.customer_phone = ${phone}
            OR o.ship_recipient_phone = ${phone}
            OR c.phone = ${phone}
            OR EXISTS (SELECT 1 FROM customer_contacts cc WHERE cc.customer_id = o.customer_id AND cc.phone = ${phone})
          )) AS by_phone,
          (${serialLike}::text IS NOT NULL AND EXISTS (
            SELECT 1 FROM order_lines l, unnest(l.serial_numbers) AS s
            WHERE l.order_id = o.id AND s LIKE ${serialLike}
          )) AS by_serial,
          (${orderCode}::text IS NOT NULL AND o.code = ${orderCode}) AS by_code
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.status <> 'CANCELLED'
      ) AS matched
      WHERE by_phone OR by_serial OR by_code
      ORDER BY placed_at DESC
      LIMIT ${MAX_ORDERS + 1}
    `;

    const truncated = matches.length > MAX_ORDERS;
    const kept = matches.slice(0, MAX_ORDERS);
    if (kept.length === 0) return { query: rawQuery, interpretedAs, orders: [], truncated: false };

    const orders = await this.db.order.findMany({
      where: { id: { in: kept.map((row) => row.id) } },
      orderBy: { placedAt: 'desc' },
      select: {
        id: true,
        code: true,
        status: true,
        placedAt: true,
        completedAt: true,
        customerName: true,
        customerPhone: true,
        shipStreet: true,
        shipWardName: true,
        shipProvinceName: true,
        shipAddressRaw: true,
        brandTechnicianNote: true,
        customer: { select: { id: true, fullName: true, companyName: true, phone: true } },
        lines: {
          where: { lineType: { notIn: [...NON_DEVICE_LINE_TYPES] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            serialNumbers: true,
            variant: {
              select: { product: { select: { warrantyMonths: true, brand: { select: { name: true } } } } },
            },
          },
        },
      },
    });

    const today = vnDate(new Date());
    const matchById = new Map(kept.map((row) => [row.id, row]));

    return {
      query: rawQuery,
      interpretedAs,
      truncated,
      orders: orders.map((order): WarrantyOrder => {
        const match = matchById.get(order.id);
        const matchedBy: WarrantyMatch[] = [];
        if (match?.by_phone) matchedBy.push('PHONE');
        if (match?.by_serial) matchedBy.push('SERIAL');
        if (match?.by_code) matchedBy.push('ORDER_CODE');

        // Bắt đầu tính bảo hành từ ngày hoàn tất (đã giao lắp và thu đủ tiền)
        const startsOn = order.status === 'COMPLETED' && order.completedAt ? vnDate(order.completedAt) : null;
        const standardAddress = [order.shipStreet, order.shipWardName, order.shipProvinceName].filter(Boolean).join(', ');

        return {
          orderId: order.id,
          orderCode: order.code,
          status: order.status as OrderStatusValue,
          matchedBy,
          placedAt: order.placedAt.toISOString(),
          completedAt: order.completedAt?.toISOString() ?? null,
          completedOn: order.completedAt ? vnDate(order.completedAt) : null,
          customer: {
            id: order.customer?.id ?? null,
            name: order.customerName ?? order.customer?.fullName ?? 'Khách lẻ',
            companyName: order.customer?.companyName ?? null,
            phone: order.customerPhone ?? order.customer?.phone ?? null,
          },
          address: standardAddress || order.shipAddressRaw || null,
          brandTechnicianNote: order.brandTechnicianNote,
          devices: order.lines.map((line): WarrantyDevice => {
            const months = line.variant?.product.warrantyMonths ?? 0;
            const endsOn = startsOn && months > 0 ? addMonths(startsOn, months) : null;
            let state: WarrantyState;
            if (!startsOn) state = 'NOT_DELIVERED';
            else if (!endsOn) state = 'UNKNOWN';
            // Còn hạn đến hết ngày endsOn
            else state = today <= endsOn ? 'ACTIVE' : 'EXPIRED';

            return {
              lineId: line.id,
              name: line.name,
              sku: line.sku,
              brandName: line.variant?.product.brand?.name ?? null,
              quantity: line.quantity,
              serialNumbers: line.serialNumbers,
              matchedSerials: serial ? line.serialNumbers.filter((item) => item.includes(serial)) : [],
              warrantyMonths: months,
              startsOn,
              endsOn,
              state,
            };
          }),
        };
      }),
    };
  }
}