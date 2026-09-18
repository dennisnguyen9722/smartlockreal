/**
 * Định nghĩa cột của file Excel nhập sản phẩm.
 * Dùng chung giữa nơi XUẤT file mẫu và nơi ĐỌC file, để hai bên không bao giờ lệch nhau.
 */
export interface ImportColumn {
  /** Tiêu đề hiển thị trong file Excel */
  header: string;
  /** Tên trường khi đọc vào code */
  key: string;
  width: number;
  required?: boolean;
  note?: string;
  /** Danh sách chọn sẵn trong Excel */
  options?: string[];
}

export const PRODUCT_IMPORT_COLUMNS: ImportColumn[] = [
  {
    header: 'Mã sản phẩm *',
    key: 'productCode',
    width: 22,
    required: true,
    note: 'Các dòng cùng mã này gộp thành MỘT sản phẩm nhiều biến thể',
  },
  {
    header: 'Loại *',
    key: 'type',
    width: 12,
    required: true,
    options: ['LOCK', 'ACCESSORY', 'SERVICE', 'BUNDLE'],
    note: 'LOCK: khóa | ACCESSORY: phụ kiện | SERVICE: dịch vụ | BUNDLE: combo',
  },
  { header: 'Tên sản phẩm *', key: 'name', width: 38, required: true },
  {
    header: 'Mã hãng',
    key: 'brandCode',
    width: 18,
    note: 'Lấy ở trang Tham chiếu. Bắt buộc với loại LOCK',
  },
  { header: 'Mã danh mục *', key: 'categoryCode', width: 22, required: true, note: 'Lấy ở trang Tham chiếu' },
  { header: 'Mã model của hãng', key: 'manufacturerCode', width: 20 },
  { header: 'Bảo hành (tháng)', key: 'warrantyMonths', width: 16, note: 'Số nguyên, vd: 24' },
  { header: 'Mô tả ngắn', key: 'shortDescription', width: 40 },
  {
    header: 'SKU',
    key: 'sku',
    width: 26,
    note: 'Để trống thì hệ thống tự sinh. Chữ IN HOA, số, gạch ngang',
  },
  { header: 'Tên biến thể *', key: 'variantName', width: 20, required: true, note: 'vd: Đen, Vàng đồng' },
  {
    header: 'Tùy chọn',
    key: 'optionValues',
    width: 26,
    note: 'Dạng mã=giá_trị:Tên hiển thị, cách nhau bởi |. Vd: mau=den:Đen|phien-ban=wifi:Có Wi-Fi',
  },
  { header: 'Giá bán (VND) *', key: 'price', width: 16, required: true, note: 'Số nguyên, chưa VAT' },
  { header: 'Giá gạch ngang', key: 'compareAtPrice', width: 16, note: 'Phải lớn hơn giá bán' },
  { header: 'Thuế VAT (%)', key: 'vatRate', width: 14, note: 'Để trống = 10' },
  {
    header: 'Quản lý serial',
    key: 'trackSerial',
    width: 15,
    options: ['Có', 'Không'],
    note: 'Để trống: khóa = Có, loại khác = Không',
  },
  { header: 'Cân nặng (gram)', key: 'weightGrams', width: 16 },
];

/** Tiền tố của cột thông số kỹ thuật, để phân biệt với cột cố định */
export const SPEC_COLUMN_PREFIX = 'spec:';

export const IMPORT_MAX_ROWS = 2000;

/** Trạng thái của một dòng sau khi kiểm tra */
export type ImportRowStatus = 'CREATE' | 'UPDATE' | 'ERROR';

export interface ImportRowIssue {
  column: string;
  message: string;
}

export interface ImportPreviewRow {
  /** Số dòng trong file Excel, để người dùng tìm đúng chỗ cần sửa */
  rowNumber: number;
  productCode: string;
  productName: string;
  sku: string;
  variantName: string;
  status: ImportRowStatus;
  issues: ImportRowIssue[];
}

export interface ImportPreviewResult {
  /** Mã phiên để xác nhận ghi; hết hạn sau 30 phút */
  sessionId: string;
  totalRows: number;
  productsToCreate: number;
  productsToUpdate: number;
  variantsToCreate: number;
  variantsToUpdate: number;
  errorCount: number;
  rows: ImportPreviewRow[];
}

/**
 * Đọc chuỗi tùy chọn: "mau=den:Đen|phien-ban=wifi"
 * Trả về { values: { mau: 'den' }, labels: { 'mau:den': 'Đen' } }
 */
export function parseOptionValues(raw: string): {
  values: Record<string, string>;
  labels: Record<string, string>;
  errors: string[];
} {
  const values: Record<string, string> = {};
  const labels: Record<string, string> = {};
  const errors: string[] = [];

  for (const part of raw.split('|').map((item) => item.trim()).filter(Boolean)) {
    const [left, right] = part.split('=');
    if (!left || !right) {
      errors.push(`"${part}" không đúng dạng mã=giá_trị`);
      continue;
    }
    const optionCode = left.trim();
    const [rawValue, label] = right.split(':');
    const valueCode = (rawValue ?? '').trim();

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(optionCode) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(valueCode)) {
      errors.push(`"${part}": mã chỉ gồm chữ thường, số và gạch ngang`);
      continue;
    }
    values[optionCode] = valueCode;
    if (label?.trim()) labels[`${optionCode}:${valueCode}`] = label.trim();
  }
  return { values, labels, errors };
}
