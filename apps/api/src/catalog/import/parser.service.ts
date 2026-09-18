import { HttpStatus, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ErrorCode, IMPORT_MAX_ROWS, PRODUCT_IMPORT_COLUMNS } from '@ktm/shared';
import { AppException } from '../../common/errors/app.exception';

export interface RawImportRow {
  rowNumber: number;
  /** Giá trị các cột cố định, theo key trong PRODUCT_IMPORT_COLUMNS */
  fields: Record<string, string>;
  /** Giá trị các cột thông số, theo TÊN thông số hiển thị trên tiêu đề */
  specsByName: Record<string, string>;
}

/** Bỏ phần gợi ý trong ngoặc ở cuối tiêu đề cột thông số */
function cleanSpecHeader(header: string): string {
  return header.replace(/\s*\(nhiều giá trị[^)]*\)\s*$/u, '').trim();
}

/** Lấy nội dung ô dưới dạng chuỗi, xử lý cả công thức và chữ có định dạng */
function cellText(cell: ExcelJS.Cell): string {
  const value: unknown = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return String((value as { result: unknown }).result ?? '').trim();
    if ('richText' in value) {
      const parts = (value as { richText: { text: string }[] }).richText;
      return parts.map((part) => part.text).join('').trim();
    }
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

@Injectable()
export class ImportParserService {
  async parse(buffer: Buffer): Promise<RawImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(new Uint8Array(buffer) as never);
    } catch {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'Không đọc được file. Hãy dùng file Excel (.xlsx) tải từ hệ thống.',
      });
    }

    const sheet = workbook.getWorksheet('Sản phẩm') ?? workbook.worksheets[0];
    if (!sheet) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'File không có trang tính nào',
      });
    }

    // Đọc tiêu đề, phân biệt cột cố định và cột thông số
    const keyByColumn = new Map<number, string>();
    const specNameByColumn = new Map<number, string>();
    const headerByText = new Map(PRODUCT_IMPORT_COLUMNS.map((column) => [column.header, column.key]));

    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = cellText(cell);
      if (!header) return;
      const key = headerByText.get(header);
      if (key) keyByColumn.set(columnNumber, key);
      else specNameByColumn.set(columnNumber, cleanSpecHeader(header));
    });

    const missing = PRODUCT_IMPORT_COLUMNS.filter(
      (column) => column.required && ![...keyByColumn.values()].includes(column.key),
    );
    if (missing.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: `File thiếu cột bắt buộc: ${missing.map((column) => column.header).join(', ')}`,
      });
    }

    const rows: RawImportRow[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rows.length >= IMPORT_MAX_ROWS) return;

      const fields: Record<string, string> = {};
      const specsByName: Record<string, string> = {};

      for (const [columnNumber, key] of keyByColumn) {
        fields[key] = cellText(row.getCell(columnNumber));
      }
      for (const [columnNumber, specName] of specNameByColumn) {
        const value = cellText(row.getCell(columnNumber));
        if (value) specsByName[specName] = value;
      }

      // Bỏ dòng trống và hai dòng ví dụ trong file mẫu
      const hasData = Object.values(fields).some((value) => value.length > 0);
      const isSample =
        fields.productCode === 'VIDU-001' || fields.categoryCode?.startsWith('(');
      if (!hasData || isSample) return;

      rows.push({ rowNumber, fields, specsByName });
    });

    if (rows.length === 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'File không có dòng dữ liệu nào (đã bỏ qua dòng ví dụ)',
      });
    }
    return rows;
  }
}
