/**
 * MỌI quan hệ tham chiếu tới biến thể bằng khóa ngoại onDelete: Restrict.
 * Khi thêm bảng mới có khóa ngoại tới product_variants với Restrict,
 * PHẢI thêm vào đây, nếu không API sẽ cho xóa rồi database mới chặn.
 *
 * Dùng trực tiếp trong `_count: { select: VARIANT_USAGE_COUNT }` của Prisma.
 */
export const VARIANT_USAGE_COUNT = {
  // Chứng từ và tồn kho: đã có thì khóa SKU và cách quản lý serial
  orderLines: true,
  quoteLines: true,
  receiptLines: true,
  transferLines: true,
  stocktakeLines: true,
  stockLevels: true,
  serialUnits: true,
  // Tham chiếu từ khuyến mãi và combo: chỉ chặn xóa
  saleItems: true,
  giftItems: true,
  usedInBundles: true,
} as const;

export type VariantUsageCounts = { [K in keyof typeof VARIANT_USAGE_COUNT]: number };

export interface VariantUsage {
  orderLines: number;
  quoteLines: number;
  receiptLines: number;
  transferLines: number;
  stocktakeLines: number;
  stockLevels: number;
  serialUnits: number;
  saleItems: number;
  giftItems: number;
  usedInBundles: number;
  /** Tổng chứng từ và dòng tồn kho */
  documents: number;
  /** Tổng tham chiếu từ khuyến mãi và combo */
  references: number;
  /** true = không đổi được SKU và trackSerial */
  locked: boolean;
  /** true = xóa hẳn được; false = chỉ tắt */
  deletable: boolean;
}

export function summarizeUsage(counts: VariantUsageCounts): VariantUsage {
  const documents =
    counts.orderLines +
    counts.quoteLines +
    counts.receiptLines +
    counts.transferLines +
    counts.stocktakeLines +
    counts.stockLevels +
    counts.serialUnits;
  const references = counts.saleItems + counts.giftItems + counts.usedInBundles;

  return {
    orderLines: counts.orderLines,
    quoteLines: counts.quoteLines,
    receiptLines: counts.receiptLines,
    transferLines: counts.transferLines,
    stocktakeLines: counts.stocktakeLines,
    stockLevels: counts.stockLevels,
    serialUnits: counts.serialUnits,
    saleItems: counts.saleItems,
    giftItems: counts.giftItems,
    usedInBundles: counts.usedInBundles,
    documents,
    references,
    locked: documents > 0,
    deletable: documents + references === 0,
  };
}