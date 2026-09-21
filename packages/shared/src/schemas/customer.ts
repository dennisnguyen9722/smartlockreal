import { z } from 'zod';
import { VnPhoneSchema } from './order';

export type CustomerTypeValue = 'INDIVIDUAL' | 'BUSINESS';
export type CustomerSourceValue = 'WEBSITE' | 'ZALO' | 'STORE' | 'REFERRAL' | 'OTHER';

export const CUSTOMER_TYPE_LABEL: Record<CustomerTypeValue, string> = {
  INDIVIDUAL: 'Cá nhân',
  BUSINESS: 'Doanh nghiệp',
};

export const CUSTOMER_SOURCE_LABEL: Record<CustomerSourceValue, string> = {
  WEBSITE: 'Website',
  ZALO: 'Zalo',
  STORE: 'Tại showroom',
  REFERRAL: 'Giới thiệu',
  OTHER: 'Khác',
};

/** Khớp CHECK customers_tax_code_format: doanh nghiệp 10 số, chi nhánh 10-3, hộ kinh doanh 12 số (CCCD) */
export const TaxCodeSchema = z
  .string()
  .trim()
  .regex(/^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/, 'Mã số thuế gồm 10 số, 10-3 số (chi nhánh) hoặc 12 số');

const OptionalText = (max: number) => z.string().trim().min(1).max(max).optional();
const NullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

export const CustomerCreateSchema = z
  .object({
    type: z.enum(['INDIVIDUAL', 'BUSINESS']),
    /** Tên khách lẻ, hoặc tên thường gọi của doanh nghiệp */
    fullName: z.string().trim().min(1, 'Chưa nhập tên').max(200),
    phone: VnPhoneSchema.optional(),
    email: z.email('Email không hợp lệ').toLowerCase().max(200).optional(),
    companyName: OptionalText(255),
    taxCode: TaxCodeSchema.optional(),
    invoiceAddress: OptionalText(500),
    groupId: z.uuid().optional(),
    assignedStaffId: z.uuid().optional(),
    source: z.enum(['WEBSITE', 'ZALO', 'STORE', 'REFERRAL', 'OTHER']).default('OTHER'),
    note: OptionalText(2000),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'INDIVIDUAL' && !data.phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Khách cá nhân phải có số điện thoại' });
    }
    if (data.type === 'BUSINESS' && !data.companyName) {
      ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Khách doanh nghiệp phải có tên công ty' });
    }
  });
export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;

/** Không đổi được loại khách (cá nhân ↔ doanh nghiệp) sau khi tạo */
export const CustomerUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  phone: VnPhoneSchema.nullable().optional(),
  email: z.email('Email không hợp lệ').toLowerCase().max(200).nullable().optional(),
  companyName: NullableText(255),
  taxCode: TaxCodeSchema.nullable().optional(),
  invoiceAddress: NullableText(500),
  groupId: z.uuid().optional(),
  assignedStaffId: z.uuid().nullable().optional(),
  source: z.enum(['WEBSITE', 'ZALO', 'STORE', 'REFERRAL', 'OTHER']).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});
export type CustomerUpdateInput = z.infer<typeof CustomerUpdateSchema>;

export const CustomerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** Tên, số điện thoại, tên công ty hoặc mã số thuế */
  search: z.string().trim().max(200).optional(),
  type: z.enum(['INDIVIDUAL', 'BUSINESS']).optional(),
  groupId: z.uuid().optional(),
  mine: z.enum(['true', 'false']).optional(),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

// ---------- Người liên hệ (khách doanh nghiệp) ----------

export const CustomerContactSchema = z.object({
  fullName: z.string().trim().min(1, 'Chưa nhập tên người liên hệ').max(200),
  phone: VnPhoneSchema.optional(),
  email: z.email('Email không hợp lệ').toLowerCase().max(200).optional(),
  position: OptionalText(120),
  isPrimary: z.boolean().optional(),
  note: OptionalText(1000),
});
export type CustomerContactInput = z.infer<typeof CustomerContactSchema>;

export const CustomerContactUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  phone: VnPhoneSchema.nullable().optional(),
  email: z.email('Email không hợp lệ').toLowerCase().max(200).nullable().optional(),
  position: NullableText(120),
  isPrimary: z.boolean().optional(),
  note: NullableText(1000),
});
export type CustomerContactUpdateInput = z.infer<typeof CustomerContactUpdateSchema>;