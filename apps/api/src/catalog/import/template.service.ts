import { Inject, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { PrismaClient } from '@ktm/database';
import { PRODUCT_IMPORT_COLUMNS, SPEC_COLUMN_PREFIX, type SpecOption } from '@ktm/shared';
import { PRISMA } from '../../database/database.module';
import { SpecDefinitionService } from '../spec-definition.service';

const HEADER_FILL = 'FF1F3864';
const REQUIRED_FILL = 'FFFFF2CC';

@Injectable()
export class ImportTemplateService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly specs: SpecDefinitionService,
  ) {}

  async build(categoryId?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Khóa Thông Minh Chính Hãng';
    workbook.created = new Date();

    const [brands, categories, specShapes] = await Promise.all([
      this.db.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.db.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      categoryId ? this.specs.getShapes(categoryId) : Promise.resolve([]),
    ]);

    this.buildGuideSheet(workbook, specShapes.length > 0);
    this.buildDataSheet(workbook, specShapes);
    this.buildReferenceSheet(workbook, brands, categories, specShapes);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private buildGuideSheet(workbook: ExcelJS.Workbook, hasSpecs: boolean) {
    const sheet = workbook.addWorksheet('Hướng dẫn');
    sheet.getColumn(1).width = 100;

    const lines: [string, 'title' | 'text'][] = [
      ['HƯỚNG DẪN NHẬP SẢN PHẨM', 'title'],
      ['', 'text'],
      ['1. Điền dữ liệu vào trang "Sản phẩm". Cột có dấu * là bắt buộc.', 'text'],
      ['2. MỖI DÒNG LÀ MỘT BIẾN THỂ. Sản phẩm nhiều màu thì điền nhiều dòng,', 'text'],
      ['   dùng chung "Mã sản phẩm" và lặp lại thông tin chung ở mọi dòng.', 'text'],
      ['', 'text'],
      ['Ví dụ khóa có 2 màu:', 'title'],
      ['   Dòng 1: KHOA-A | LOCK | Khóa vân tay X | ... | Đen  | mau=den  | 12500000', 'text'],
      ['   Dòng 2: KHOA-A | LOCK | Khóa vân tay X | ... | Vàng | mau=vang | 12900000', 'text'],
      ['', 'text'],
      ['3. Mã hãng và mã danh mục lấy ở trang "Tham chiếu".', 'text'],
      ['4. Giá nhập số nguyên, KHÔNG dùng dấu chấm hay phẩy. Vd: 12500000', 'text'],
      ['5. Nhập lại file có SKU đã tồn tại sẽ CẬP NHẬT sản phẩm đó, không tạo trùng.', 'text'],
      ['', 'text'],
      ['6. Sau khi tải file lên, hệ thống kiểm tra và hiển thị kết quả để bạn XEM TRƯỚC.', 'text'],
      ['   Dữ liệu chỉ được ghi khi bạn bấm xác nhận.', 'text'],
      ['', 'text'],
      [
        hasSpecs
          ? '7. Các cột sau cột "Cân nặng" là thông số kỹ thuật của danh mục đã chọn.'
          : '7. File này chưa có cột thông số kỹ thuật. Hãy tải file mẫu theo danh mục cụ thể để có sẵn các cột đó.',
        'text',
      ],
      ['   Thông số chọn nhiều giá trị: ngăn cách bằng dấu phẩy. Vd: van_tay, mat_ma', 'text'],
      ['', 'text'],
      ['8. Ảnh: đặt tên file theo SKU (vd: KHOA-A-DEN.jpg, KHOA-A-DEN_2.jpg)', 'text'],
      ['   rồi kéo cả thư mục vào màn hình nhập ảnh trong trang quản trị.', 'text'],
    ];

    for (const [text, kind] of lines) {
      const row = sheet.addRow([text]);
      if (kind === 'title') row.font = { bold: true, size: 12 };
    }
  }

  private buildDataSheet(
    workbook: ExcelJS.Workbook,
    specShapes: { code: string; name: string; dataType: string; options?: SpecOption[] | null }[],
  ) {
    const sheet = workbook.addWorksheet('Sản phẩm', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const columns = [
      ...PRODUCT_IMPORT_COLUMNS.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.width,
      })),
      ...specShapes.map((spec) => ({
        header: `${spec.name}${this.specUnitHint(spec)}`,
        key: `${SPEC_COLUMN_PREFIX}${spec.code}`,
        width: 24,
      })),
    ];
    sheet.columns = columns;

    // Định dạng dòng tiêu đề
    const header = sheet.getRow(1);
    header.height = 32;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.eachCell((cell, index) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      const column = PRODUCT_IMPORT_COLUMNS[index - 1];
      if (column?.note) cell.note = column.note;
      if (column?.required) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } };
      }
    });

    // Danh sách chọn sẵn cho các cột có options
    PRODUCT_IMPORT_COLUMNS.forEach((column, index) => {
      if (!column.options) return;
      const letter = sheet.getColumn(index + 1).letter;
      for (let row = 2; row <= 500; row += 1) {
        sheet.getCell(`${letter}${row}`).dataValidation = {
          type: 'list',
          allowBlank: !column.required,
          formulae: [`"${column.options.join(',')}"`],
        };
      }
    });

    // Danh sách chọn cho thông số dạng SELECT
    specShapes.forEach((spec, specIndex) => {
      if (spec.dataType !== 'SELECT' || !spec.options?.length) return;
      const letter = sheet.getColumn(PRODUCT_IMPORT_COLUMNS.length + specIndex + 1).letter;
      for (let row = 2; row <= 500; row += 1) {
        sheet.getCell(`${letter}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${spec.options.map((option) => option.value).join(',')}"`],
        };
      }
    });

    // Hai dòng ví dụ, tô vàng nhạt để người dùng biết cần xóa trước khi nhập thật
    const sampleSpecs: Record<string, string> = {};
    for (const spec of specShapes) {
      sampleSpecs[`${SPEC_COLUMN_PREFIX}${spec.code}`] =
        spec.dataType === 'MULTI_SELECT'
          ? (spec.options ?? []).slice(0, 2).map((option) => option.value).join(', ')
          : spec.dataType === 'SELECT'
            ? (spec.options?.[0]?.value ?? '')
            : spec.dataType === 'NUMBER'
              ? '12'
              : spec.dataType === 'BOOLEAN'
                ? 'Có'
                : 'Ví dụ';
    }

    for (const [index, sample] of [
      { variantName: 'Đen', optionValues: 'mau=den', price: 12500000, compareAtPrice: 14000000 },
      { variantName: 'Vàng đồng', optionValues: 'mau=vang', price: 12900000, compareAtPrice: null },
    ].entries()) {
      const row = sheet.addRow({
        productCode: 'VIDU-001',
        type: 'LOCK',
        name: 'Khóa vân tay Ví Dụ ABC',
        brandCode: '(xem trang Tham chiếu)',
        categoryCode: '(xem trang Tham chiếu)',
        manufacturerCode: 'ABC-123',
        warrantyMonths: 24,
        shortDescription: index === 0 ? 'Mô tả ngắn hiển thị ở danh sách sản phẩm' : '',
        variantName: sample.variantName,
        optionValues: sample.optionValues,
        price: sample.price,
        compareAtPrice: sample.compareAtPrice,
        ...sampleSpecs,
      });
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REQUIRED_FILL } };
      });
    }

    sheet.getColumn('price').numFmt = '#,##0';
    sheet.getColumn('compareAtPrice').numFmt = '#,##0';
  }

  private buildReferenceSheet(
    workbook: ExcelJS.Workbook,
    brands: { slug: string; name: string }[],
    categories: { slug: string; name: string }[],
    specShapes: { code: string; name: string; dataType: string; options?: SpecOption[] | null }[],
  ) {
    const sheet = workbook.addWorksheet('Tham chiếu');
    sheet.columns = [
      { header: 'Loại', key: 'kind', width: 16 },
      { header: 'Mã (điền vào file)', key: 'code', width: 30 },
      { header: 'Tên', key: 'name', width: 40 },
      { header: 'Ghi chú', key: 'note', width: 50 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });

    for (const brand of brands) {
      sheet.addRow({ kind: 'Hãng', code: brand.slug, name: brand.name });
    }
    for (const category of categories) {
      sheet.addRow({ kind: 'Danh mục', code: category.slug, name: category.name });
    }
    for (const spec of specShapes) {
      sheet.addRow({
        kind: 'Thông số',
        code: spec.code,
        name: spec.name,
        note:
          spec.options?.length
            ? `Giá trị: ${spec.options.map((option) => `${option.value} (${option.label})`).join(', ')}`
            : `Kiểu: ${spec.dataType}`,
      });
    }
  }

  private specUnitHint(spec: { dataType: string }): string {
    return spec.dataType === 'MULTI_SELECT' ? ' (nhiều giá trị, cách nhau bởi dấu phẩy)' : '';
  }
}
