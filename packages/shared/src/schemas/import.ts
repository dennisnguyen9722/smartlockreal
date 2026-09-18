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
    note: 'Dạng mã=giá_trị, cách nhau bởi |. Vd: mau=den|phien-ban=wifi',
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
