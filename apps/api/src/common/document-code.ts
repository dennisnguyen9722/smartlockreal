import type { Prisma } from '@ktm/database';

type Tx = Prisma.TransactionClient;

/** Tiền tố mã chứng từ. Database yêu cầu mã dạng ^[A-Z]+-[A-Z0-9-]+$ */
export const DOCUMENT_PREFIX = {
  ORDER: 'DH',
  QUOTE: 'BG',
} as const;

const PERIOD_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
});

/** Kỳ đánh số theo ngày giờ Việt Nam: 22/09/2026 -> "260922" */
export function documentPeriod(date: Date = new Date()): string {
  const parts = Object.fromEntries(PERIOD_FORMAT.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

/**
 * Mã chứng từ kế tiếp: DH-260922-0001.
 * Gọi BÊN TRONG transaction tạo chứng từ: transaction lỗi thì số cũng được trả lại (không nhảy số),
 * và hai người tạo cùng lúc sẽ xếp hàng ở dòng document_sequences thay vì trùng số.
 */
export async function nextDocumentCode(tx: Tx, prefix: string, date: Date = new Date()): Promise<string> {
  const period = documentPeriod(date);
  const rows = await tx.$queryRaw<{ value: number }[]>`
    SELECT next_document_number(${prefix}, ${period}) AS value
  `;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('next_document_number không trả về giá trị');
  return `${prefix}-${period}-${String(value).padStart(4, '0')}`;
}