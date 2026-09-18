/**
 * Quyền trong hệ thống. Guard của API kiểm tra theo QUYỀN, không theo vai trò,
 * để sau này thêm vai trò mới mà không phải sửa từng API.
 */
export const Permission = {
  // Danh mục sản phẩm
  CATALOG_VIEW: 'catalog.view',
  CATALOG_MANAGE: 'catalog.manage',

  // Tồn kho
  INVENTORY_VIEW: 'inventory.view',
  /// Tạo và chốt phiếu nhập, phiếu chuyển
  INVENTORY_MANAGE: 'inventory.manage',
  /// Chốt kiểm kê, điều chỉnh tồn kho (chỉ quản trị)
  INVENTORY_ADJUST: 'inventory.adjust',

  // Khách hàng
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_MANAGE: 'customer.manage',
  /// Xuất danh sách khách kèm dữ liệu cá nhân (chỉ quản trị)
  CUSTOMER_EXPORT: 'customer.export',

  // Đơn hàng
  ORDER_VIEW: 'order.view',
  ORDER_MANAGE: 'order.manage',
  /// Hủy đơn đã xác nhận (chỉ quản trị)
  ORDER_CANCEL: 'order.cancel',

  // Thanh toán
  PAYMENT_VIEW: 'payment.view',
  /// Xác nhận đã thu tiền, đối chiếu chuyển khoản
  PAYMENT_RECORD: 'payment.record',
  /// Hoàn tiền (chỉ quản trị)
  PAYMENT_REFUND: 'payment.refund',

  // Giá và khuyến mãi
  PRICING_VIEW: 'pricing.view',
  /// Sửa giá, bảng giá nhóm, flash sale, voucher (chỉ quản trị)
  PRICING_MANAGE: 'pricing.manage',

  // Báo giá công trình
  QUOTE_VIEW: 'quote.view',
  QUOTE_MANAGE: 'quote.manage',
  /// Duyệt báo giá vượt ngưỡng chiết khấu (chỉ quản trị)
  QUOTE_APPROVE: 'quote.approve',

  // Lắp đặt và bảo hành
  SERVICE_VIEW: 'service.view',
  SERVICE_MANAGE: 'service.manage',
  WARRANTY_VIEW: 'warranty.view',
  WARRANTY_MANAGE: 'warranty.manage',

  // Nội dung website
  CONTENT_VIEW: 'content.view',
  CONTENT_MANAGE: 'content.manage',
  /// Duyệt đánh giá của khách
  REVIEW_MODERATE: 'review.moderate',

  // Báo cáo
  REPORT_VIEW: 'report.view',
  /// Báo cáo doanh thu (chỉ quản trị)
  REPORT_REVENUE: 'report.revenue',

  // Quản trị hệ thống (chỉ quản trị)
  STAFF_MANAGE: 'staff.manage',
  SETTING_MANAGE: 'setting.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/** Quyền của nhân viên kinh doanh */
const SALE_STAFF_PERMISSIONS: readonly Permission[] = [
  Permission.CATALOG_VIEW,
  Permission.CATALOG_MANAGE,
  Permission.INVENTORY_VIEW,
  Permission.INVENTORY_MANAGE,
  Permission.CUSTOMER_VIEW,
  Permission.CUSTOMER_MANAGE,
  Permission.ORDER_VIEW,
  Permission.ORDER_MANAGE,
  Permission.PAYMENT_VIEW,
  Permission.PAYMENT_RECORD,
  Permission.PRICING_VIEW,
  Permission.QUOTE_VIEW,
  Permission.QUOTE_MANAGE,
  Permission.SERVICE_VIEW,
  Permission.SERVICE_MANAGE,
  Permission.WARRANTY_VIEW,
  Permission.WARRANTY_MANAGE,
  Permission.CONTENT_VIEW,
  Permission.CONTENT_MANAGE,
  Permission.REVIEW_MODERATE,
  Permission.REPORT_VIEW,
];

/** Quản trị hệ thống có toàn bộ quyền */
const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const RolePermissions = {
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
  SALE_STAFF: SALE_STAFF_PERMISSIONS,
} as const;

export type StaffRoleCode = keyof typeof RolePermissions;

export function roleHasPermission(role: StaffRoleCode, permission: Permission): boolean {
  return RolePermissions[role].includes(permission);
}
