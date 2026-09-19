import { z } from 'zod';

/** Khớp enum spec_data_type trong database */
export const SpecDataTypeSchema = z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT']);
export type SpecDataTypeValue = z.infer<typeof SpecDataTypeSchema>;

/** Một lựa chọn của thông số dạng SELECT/MULTI_SELECT */
export const SpecOptionSchema = z.object({
  value: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Mã lựa chọn: chữ thường, số, gạch dưới').max(40),
  label: z.string().trim().min(1).max(120),
});
export type SpecOption = z.infer<typeof SpecOptionSchema>;

const SpecDefinitionBase = z.object({
  /** Khóa trong products.specs, vd: unlock_methods */
  code: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Mã thông số: chữ thường, số, gạch dưới').max(64),
  name: z.string().trim().min(1, 'Chưa nhập tên thông số').max(120),
  /// Nhóm hiển thị, vd: Vận hành, Kích thước cửa
  groupName: z.string().trim().max(80).optional(),
  dataType: SpecDataTypeSchema,
  /** Đơn vị hiển thị: mm, tháng, kg... */
  unit: z.string().trim().max(20).optional(),
  options: z.array(SpecOptionSchema).max(50).optional(),
  isFilterable: z.boolean().default(false),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

/** SELECT/MULTI_SELECT bắt buộc có danh sách lựa chọn; kiểu khác thì không được có */
function checkOptions(data: { dataType: SpecDataTypeValue; options?: SpecOption[] }, ctx: z.RefinementCtx) {
  const needsOptions = data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT';

  if (needsOptions && (!data.options || data.options.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Kiểu chọn phải có ít nhất một lựa chọn' });
  }
  if (!needsOptions && data.options && data.options.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Kiểu này không dùng danh sách lựa chọn' });
  }
  if (data.options) {
    const codes = data.options.map((option) => option.value);
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mã lựa chọn bị trùng' });
    }
  }
}

export const SpecDefinitionCreateSchema = SpecDefinitionBase.superRefine(checkOptions);
export const SpecDefinitionUpdateSchema = SpecDefinitionBase.omit({ code: true })
  .partial()
  .superRefine((data, ctx) => {
    if (data.dataType) checkOptions(data as { dataType: SpecDataTypeValue; options?: SpecOption[] }, ctx);
  });

export type SpecDefinitionCreateInput = z.infer<typeof SpecDefinitionCreateSchema>;
export type SpecDefinitionUpdateInput = z.infer<typeof SpecDefinitionUpdateSchema>;

/** Khuôn thông số dùng để kiểm tra giá trị của sản phẩm */
export interface SpecDefinitionShape {
  code: string;
  name: string;
  groupName?: string | null;
  dataType: SpecDataTypeValue;
  options?: SpecOption[] | null;
  isRequired: boolean;
}

export interface SpecValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
  /** Giá trị đã được chuẩn hóa (số dạng chuỗi -> số, bỏ khoảng trắng thừa) */
  value: Record<string, unknown>;
}

/**
 * Kiểm tra và chuẩn hóa thông số của sản phẩm theo khuôn của danh mục.
 * Dùng chung cho API, nhập Excel và form trong trang quản trị.
 */
export function validateSpecs(
  definitions: SpecDefinitionShape[],
  input: Record<string, unknown>,
): SpecValidationResult {
  const errors: { field: string; message: string }[] = [];
  const value: Record<string, unknown> = {};
  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));

  for (const code of Object.keys(input)) {
    if (!byCode.has(code)) {
      errors.push({ field: `specs.${code}`, message: 'Thông số không có trong danh mục này' });
    }
  }

  for (const definition of definitions) {
    const raw = input[definition.code];
    const empty = raw === undefined || raw === null || raw === '';

    if (empty) {
      if (definition.isRequired) {
        errors.push({ field: `specs.${definition.code}`, message: `${definition.name}: bắt buộc nhập` });
      }
      continue;
    }

    const field = `specs.${definition.code}`;
    const allowed = new Set((definition.options ?? []).map((option) => option.value));

    switch (definition.dataType) {
      case 'TEXT': {
        if (typeof raw !== 'string') {
          errors.push({ field, message: `${definition.name}: phải là chữ` });
        } else if (raw.length > 500) {
          errors.push({ field, message: `${definition.name}: tối đa 500 ký tự` });
        } else {
          value[definition.code] = raw.trim();
        }
        break;
      }
      case 'NUMBER': {
        const num = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
        if (!Number.isFinite(num)) {
          errors.push({ field, message: `${definition.name}: phải là số` });
        } else if (num < 0) {
          errors.push({ field, message: `${definition.name}: không được âm` });
        } else {
          value[definition.code] = num;
        }
        break;
      }
      case 'BOOLEAN': {
        if (typeof raw === 'boolean') {
          value[definition.code] = raw;
        } else if (['true', 'false', 'có', 'không', '1', '0'].includes(String(raw).toLowerCase())) {
          value[definition.code] = ['true', 'có', '1'].includes(String(raw).toLowerCase());
        } else {
          errors.push({ field, message: `${definition.name}: phải là Có hoặc Không` });
        }
        break;
      }
      case 'SELECT': {
        if (typeof raw !== 'string' || !allowed.has(raw)) {
          errors.push({ field, message: `${definition.name}: giá trị không hợp lệ (${[...allowed].join(', ')})` });
        } else {
          value[definition.code] = raw;
        }
        break;
      }
      case 'MULTI_SELECT': {
        const list = Array.isArray(raw) ? raw : String(raw).split(',').map((item) => item.trim());
        const invalid = list.filter((item) => typeof item !== 'string' || !allowed.has(item));
        if (list.length === 0) {
          errors.push({ field, message: `${definition.name}: chọn ít nhất một giá trị` });
        } else if (invalid.length > 0) {
          errors.push({ field, message: `${definition.name}: giá trị không hợp lệ (${invalid.join(', ')})` });
        } else {
          // Bỏ trùng, giữ thứ tự như khai báo để hiển thị nhất quán
          const order = (definition.options ?? []).map((option) => option.value);
          value[definition.code] = [...new Set(list)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        }
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors, value };
}

/** Một nhóm điểm nổi bật của sản phẩm */
export const HighlightGroupSchema = z.object({
  title: z.string().trim().min(1, 'Chưa nhập tên nhóm').max(80),
  items: z.array(z.string().trim().min(1).max(500)).min(1, 'Nhóm phải có ít nhất một dòng').max(20),
});

export const HighlightsSchema = z.array(HighlightGroupSchema).max(10);

export type HighlightGroup = z.infer<typeof HighlightGroupSchema>;
