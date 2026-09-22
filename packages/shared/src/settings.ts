import { z } from 'zod';
import { TaxCodeSchema } from './schemas/customer';

/**
 * DANH SÁCH CẤU HÌNH ĐƯỢC PHÉP SỬA (registry).
 *
 * Bảng system_settings lưu giá trị dạng JSON không có kiểu, nên mọi khóa phải khai báo ở đây
 * kèm schema Zod. API chỉ đọc/ghi các khóa có trong danh sách này.
 *
 * Khóa di sản không còn dùng (checkout.hold_minutes, payment.vnpay_session_minutes,
 * inventory.transfer_stale_days, vendor_return.stale_days, warranty.exchange_window_days...)
 * KHÔNG khai báo nên tự ẩn khỏi trang Cấu hình. Dữ liệu trong database để nguyên.
 *
 * Khóa chưa có trong database (vd: seo.*) dùng `defaultValue`; lần lưu đầu tiên sẽ tự tạo dòng.
 *
 * Thêm khóa mới: khai báo ở đây -> build shared -> dùng `SettingsService` ở API.
 * Không cần migration.
 */

/** Kiểu ô nhập trên trang Cấu hình */
export type SettingInput =
  | 'text'
  | 'textarea'
  | 'email'
  | 'image'
  /** Lưu phần vạn (1000 = 10%), hiển thị % */
  | 'percent'
  | 'integer';

export interface SettingDefinition {
  key: string;
  label: string;
  /** Dòng gợi ý dưới ô nhập */
  hint?: string;
  input: SettingInput;
  /** Đơn vị hiển thị sau ô số, vd "ngày" */
  unit?: string;
  placeholder?: string;
  /** Kết quả sau khi kiểm tra luôn là chuỗi hoặc số (khớp defaultValue) */
  schema: z.ZodType<string | number>;
  defaultValue: string | number;
}

export interface SettingSectionDefinition {
  /** Tiêu đề thẻ trên giao diện */
  label: string;
  items: SettingDefinition[];
}

export interface SettingGroupDefinition {
  code: SettingGroupCode;
  /** Tên tab */
  label: string;
  description: string;
  sections: SettingSectionDefinition[];
}

export const SETTING_GROUP_CODES = ['company', 'seo', 'sales'] as const;
export type SettingGroupCode = (typeof SETTING_GROUP_CODES)[number];

// ---------- Schema dùng lại ----------

const Text = (max: number, message = `Tối đa ${max} ký tự`) => z.string().trim().max(max, message);
const RequiredText = (max: number, label: string) =>
  z.string().trim().min(1, `Chưa nhập ${label}`).max(max, `Tối đa ${max} ký tự`);
const OptionalEmail = z.union([z.literal(''), z.email('Email không hợp lệ')]);
/** Chấp nhận cả đường dẫn tương đối của thư viện ảnh (/media/...) lẫn link đầy đủ */
const ImageUrl = z
  .string()
  .trim()
  .max(500, 'Đường dẫn quá dài')
  .refine((value) => value === '' || value.startsWith('/') || /^https?:\/\//.test(value), 'Đường dẫn ảnh không hợp lệ');
const Bps = (min: number, max: number) =>
  z
    .number('Phải là số')
    .int('Phải là số nguyên')
    .min(min, `Tối thiểu ${min / 100}%`)
    .max(max, `Tối đa ${max / 100}%`);

/**
 * Mã xác minh Google Search Console. Người dùng hay dán nguyên thẻ
 * <meta name="google-site-verification" content="abc..." />, nên tự lấy phần content.
 */
const GoogleVerification = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const match = value.match(/content\s*=\s*["']([^"']+)["']/i);
    return (match?.[1] ?? value).trim();
  },
  z.string().max(100, 'Mã quá dài').regex(/^[A-Za-z0-9_-]*$/, 'Chỉ dán mã xác minh (chữ, số, gạch ngang, gạch dưới)'),
);

// ---------- Danh sách ----------

export const SETTING_GROUPS: readonly SettingGroupDefinition[] = [
  {
    code: 'company',
    label: 'Thông tin công ty',
    description: 'In trên báo giá, hóa đơn và hiển thị ở chân trang website.',
    sections: [
      {
        label: 'Thông tin chung',
        items: [
          {
            key: 'company.name',
            label: 'Tên công ty',
            hint: 'Tên pháp lý theo giấy phép kinh doanh, in trên báo giá',
            input: 'text',
            schema: RequiredText(255, 'tên công ty'),
            defaultValue: '',
          },
          {
            key: 'company.brand_name',
            label: 'Tên thương hiệu',
            hint: 'Tên hiển thị trên website',
            input: 'text',
            schema: Text(120),
            defaultValue: '',
          },
          {
            key: 'company.tax_code',
            label: 'Mã số thuế',
            input: 'text',
            placeholder: '0312345678',
            schema: z.union([z.literal(''), TaxCodeSchema]),
            defaultValue: '',
          },
          {
            key: 'company.address',
            label: 'Địa chỉ trụ sở',
            input: 'textarea',
            schema: Text(500),
            defaultValue: '',
          },
          {
            key: 'company.logo_url',
            label: 'Logo',
            hint: 'Để trống thì báo giá chỉ in tên công ty',
            input: 'image',
            schema: ImageUrl,
            defaultValue: '',
          },
        ],
      },
      {
        label: 'Liên hệ',
        items: [
          {
            key: 'company.hotline',
            label: 'Hotline',
            input: 'text',
            placeholder: '1900 1234 hoặc 0901 234 567',
            schema: Text(40),
            defaultValue: '',
          },
          { key: 'company.email', label: 'Email', input: 'email', schema: OptionalEmail, defaultValue: '' },
          {
            key: 'company.website',
            label: 'Website',
            input: 'text',
            placeholder: 'khoathongminhchinhhang.vn',
            schema: Text(120),
            defaultValue: '',
          },
        ],
      },
      {
        label: 'Tài khoản nhận chuyển khoản',
        items: [
          { key: 'company.bank_name', label: 'Ngân hàng', input: 'text', placeholder: 'Vietcombank - CN TP.HCM', schema: Text(120), defaultValue: '' },
          { key: 'company.bank_account', label: 'Số tài khoản', input: 'text', schema: Text(40), defaultValue: '' },
          {
            key: 'company.bank_account_name',
            label: 'Chủ tài khoản',
            hint: 'Viết hoa không dấu đúng như trên ngân hàng',
            input: 'text',
            schema: Text(120),
            defaultValue: '',
          },
        ],
      },
    ],
  },
  {
    code: 'seo',
    label: 'SEO chung',
    description: 'Giá trị mặc định cho các trang website chưa khai báo SEO riêng.',
    sections: [
      {
        label: 'Tiêu đề và mô tả',
        items: [
          {
            key: 'seo.site_title',
            label: 'Tiêu đề trang chủ',
            hint: 'Nên dưới 60 ký tự để Google không cắt bớt',
            input: 'text',
            schema: Text(70),
            defaultValue: 'Khóa Thông Minh Chính Hãng',
          },
          {
            key: 'seo.title_template',
            label: 'Mẫu tiêu đề các trang',
            hint: '%s là tên trang, vd: "Khóa vân tay X | Khóa Thông Minh Chính Hãng"',
            input: 'text',
            schema: Text(70).refine((value) => value === '' || value.includes('%s'), 'Mẫu phải có %s (chỗ đặt tên trang)'),
            defaultValue: '%s | Khóa Thông Minh Chính Hãng',
          },
          {
            key: 'seo.default_description',
            label: 'Mô tả mặc định',
            hint: 'Hiện dưới tiêu đề trên Google. Nên 120–160 ký tự',
            input: 'textarea',
            schema: Text(300),
            defaultValue: '',
          },
        ],
      },
      {
        label: 'Chia sẻ và xác minh',
        items: [
          {
            key: 'seo.share_image_url',
            label: 'Ảnh khi chia sẻ link',
            hint: 'Hiện khi gửi link qua Zalo, Facebook. Nên 1200 × 630',
            input: 'image',
            schema: ImageUrl,
            defaultValue: '',
          },
          {
            key: 'seo.google_site_verification',
            label: 'Mã xác minh Google Search Console',
            hint: 'Dán nguyên thẻ meta Google đưa cũng được, hệ thống tự lấy mã',
            input: 'text',
            schema: GoogleVerification,
            defaultValue: '',
          },
        ],
      },
    ],
  },
  {
    code: 'sales',
    label: 'Quy tắc bán hàng',
    description: 'Áp dụng cho báo giá lập hoặc gửi duyệt SAU khi lưu. Báo giá đã có giữ nguyên.',
    sections: [
      {
        label: 'Báo giá công trình',
        items: [
          {
            key: 'quote.approval_threshold_bps',
            label: 'Giảm quá mức này cần quản trị duyệt',
            hint: 'So với giá niêm yết, tính theo dòng giảm nhiều nhất. Đúng bằng mức này thì không cần duyệt',
            input: 'percent',
            schema: Bps(0, 10000),
            defaultValue: 1000,
          },
          {
            key: 'quote.default_valid_days',
            label: 'Hiệu lực mặc định',
            hint: 'Nhân viên vẫn sửa được ngày hết hạn từng báo giá',
            input: 'integer',
            unit: 'ngày',
            schema: z.number('Phải là số').int('Phải là số nguyên').min(1, 'Tối thiểu 1 ngày').max(365, 'Tối đa 365 ngày'),
            defaultValue: 15,
          },
        ],
      },
    ],
  },
];

// ---------- Tra cứu ----------

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = SETTING_GROUPS.flatMap((group) =>
  group.sections.flatMap((section) => section.items),
);

const DEFINITION_BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export function settingDefinition(key: string): SettingDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function settingGroup(code: SettingGroupCode): SettingGroupDefinition {
  const group = SETTING_GROUPS.find((item) => item.code === code);
  if (!group) throw new Error(`Không có nhóm cấu hình "${code}"`);
  return group;
}

export function settingKeysOf(code: SettingGroupCode): string[] {
  return settingGroup(code).sections.flatMap((section) => section.items.map((item) => item.key));
}

/**
 * Đọc giá trị đã lưu một cách an toàn:
 * - Đúng schema -> dùng.
 * - Sai schema nhưng cùng là chuỗi (vd MST "Chưa cập nhật" từ dữ liệu mẫu) -> giữ nguyên để người dùng thấy và sửa.
 * - Còn lại (số ngoài khoảng, sai kiểu, chưa có) -> giá trị mặc định.
 */
export function readSettingValue(definition: SettingDefinition, raw: unknown): string | number {
  if (raw === undefined) return definition.defaultValue;
  const parsed = definition.schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (typeof definition.defaultValue === 'string' && typeof raw === 'string') return raw;
  return definition.defaultValue;
}

// ---------- API ----------

export type SettingValues = Record<string, string | number>;

export interface SettingGroupData {
  code: SettingGroupCode;
  values: SettingValues;
  /** Lần sửa gần nhất của nhóm (null = chưa từng lưu). Gửi lại khi lưu để chống ghi đè */
  updatedAt: string | null;
  updatedBy: { id: string; fullName: string } | null;
}

export interface SettingsResponse {
  groups: SettingGroupData[];
}

export const SettingGroupCodeSchema = z.enum(SETTING_GROUP_CODES, 'Nhóm cấu hình không hợp lệ');

export interface SettingsUpdateInput {
  expectedUpdatedAt: string | null;
  /** Chỉ các khóa đã đổi */
  values: Partial<SettingValues>;
}

/**
 * Body của PATCH /settings/:group: chỉ các khóa thuộc nhóm, chỉ gửi khóa đã đổi.
 * Khai báo rõ kiểu trả về vì shape dựng động từ registry, TypeScript không tự suy ra được kiểu của values.
 */
export function settingsUpdateSchema(code: SettingGroupCode): z.ZodType<SettingsUpdateInput> {
  const shape = Object.fromEntries(
    settingGroup(code)
      .sections.flatMap((section) => section.items)
      .map((item) => [item.key, item.schema.optional()]),
  );
  return z
    .object({
      expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
      values: z.object(shape).strict(),
    })
    .strict();
}