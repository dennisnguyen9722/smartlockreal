import type { PrismaClient } from '@ktm/database';

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
function vnToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/**
 * Báo giá đã gửi khách mà quá ngày hiệu lực -> Hết hạn.
 * Chỉ đụng báo giá "Đã gửi": khách đã đồng ý thì giữ nguyên để còn tạo đơn.
 * Tăng version để màn hình nào đang mở báo giá đó sẽ nhận EDIT_CONFLICT và tải lại.
 */
export async function expireQuotes(db: PrismaClient) {
  const today = vnToday();
  const result = await db.quote.updateMany({
    where: { status: 'SENT', validUntil: { lt: new Date(`${today}T00:00:00Z`) } },
    data: { status: 'EXPIRED', version: { increment: 1 } },
  });
  return { today, expired: result.count };
}