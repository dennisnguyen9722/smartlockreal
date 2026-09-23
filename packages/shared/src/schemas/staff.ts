import { z } from 'zod';
import { checkPasswordStrength } from '../password-policy';
import { ExpectedUpdatedAtSchema } from './product';
import { normalizeVnPhone } from './order';
import type { StaffRoleCode } from '../permissions';

/**
 * NHÂN VIÊN (Bước 9): quản trị tạo tài khoản, đổi vai trò, khóa/mở, đặt lại mật khẩu, thu hồi phiên.
 * Không có xóa nhân viên: đơn hàng, báo giá, nhật ký... đều trỏ tới nhân viên (khóa ngoại Restrict) -> chỉ KHÓA.
 */

export const STAFF_ROLES = ['SUPER_ADMIN', 'SALE_STAFF'] as const satisfies readonly StaffRoleCode[];

export const STAFF_ROLE_LABEL: Record<StaffRoleCode, string> = {
  SUPER_ADMIN: 'Quản trị',
  SALE_STAFF: 'Nhân viên kinh doanh',
};

export const STAFF_ROLE_HINT: Record<StaffRoleCode, string> = {
  SUPER_ADMIN: 'Toàn quyền, gồm nhân viên, cấu hình, hủy đơn, duyệt báo giá, tạo phiên bản chính sách',
  SALE_STAFF: 'Đơn hàng, báo giá, khách hàng, sản phẩm, nội dung; không quản lý nhân viên và cấu hình',
};

const PhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const phone = normalizeVnPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ' });
      return z.NEVER;
    }
    return phone;
  })
  .nullable();

/** Mật khẩu do quản trị tự đặt (bỏ trống thì hệ thống tạo mật khẩu tạm ngẫu nhiên) */
export const StaffPasswordSchema = z.string().superRefine((value, ctx) => {
  const result = checkPasswordStrength(value);
  for (const message of result.errors) ctx.addIssue({ code: 'custom', message });
});

export const StaffCreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(200).pipe(z.email('Email không hợp lệ')),
    fullName: z.string().trim().min(2, 'Nhập họ tên').max(200),
    phone: PhoneSchema.optional(),
    role: z.enum(STAFF_ROLES, 'Chọn vai trò'),
    password: StaffPasswordSchema.optional(),
  })
  .strict();
export type StaffCreateInput = z.infer<typeof StaffCreateSchema>;

export const StaffUpdateSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(200).pipe(z.email('Email không hợp lệ')).optional(),
    fullName: z.string().trim().min(2, 'Nhập họ tên').max(200).optional(),
    phone: PhoneSchema.optional(),
    role: z.enum(STAFF_ROLES).optional(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type StaffUpdateInput = z.infer<typeof StaffUpdateSchema>;

export const StaffStatusActionSchema = z
  .object({
    action: z.enum(['DISABLE', 'ENABLE', 'UNLOCK']),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict();
export type StaffStatusActionInput = z.infer<typeof StaffStatusActionSchema>;

export const StaffResetPasswordSchema = z
  .object({
    /** Bỏ trống: hệ thống tạo mật khẩu tạm */
    password: StaffPasswordSchema.optional(),
  })
  .strict();
export type StaffResetPasswordInput = z.infer<typeof StaffResetPasswordSchema>;

export type StaffStatusValue = 'ACTIVE' | 'DISABLED';

export interface StaffListItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: StaffRoleCode;
  status: StaffStatusValue;
  /** Đang bị khóa tạm do nhập sai mật khẩu nhiều lần */
  lockedUntil: string | null;
  lastLoginAt: string | null;
  activeSessions: number;
  isSelf: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffSessionItem {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  /** Lần đăng nhập mở ra phiên này */
  signedInAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  /** Phiên của chính trình duyệt đang xem */
  isCurrent: boolean;
}

export interface StaffDetail extends StaffListItem {
  sessions: StaffSessionItem[];
  /** Số chứng từ đã tạo/phụ trách, để giải thích vì sao không xóa được */
  stats: { orders: number; quotes: number; customers: number };
}

/** Kết quả tạo tài khoản / đặt lại mật khẩu: mật khẩu tạm CHỈ trả về một lần */
export interface StaffPasswordResult {
  staff: StaffDetail;
  /** null nếu quản trị tự đặt mật khẩu */
  temporaryPassword: string | null;
}

/** "Chrome trên macOS" từ user-agent (đủ để nhận ra thiết bị, không cần thư viện) */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Không rõ thiết bị';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /CocCoc/.test(userAgent)
        ? 'Cốc Cốc'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Firefox\//.test(userAgent)
            ? 'Firefox'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : /curl\//.test(userAgent)
                ? 'curl'
                : 'Trình duyệt khác';
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iPhone/iPad'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os ? `${browser} trên ${os}` : browser;
}