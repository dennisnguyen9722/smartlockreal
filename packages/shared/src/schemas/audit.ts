import { z } from 'zod';

/**
 * NHẬT KÝ (Bước 9): xem bảng audit_logs. Chỉ ĐỌC — nhật ký không sửa, không xóa qua API.
 * Mọi thao tác quan trọng đều gọi AuditService.log() với `action` dạng "<đối tượng>.<việc>".
 * Thêm hành động mới ở API thì thêm nhãn tiếng Việt vào AUDIT_ACTION_LABEL bên dưới;
 * thiếu nhãn thì giao diện hiện nguyên mã hành động (không vỡ, chỉ khó đọc).
 */

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  // Đơn hàng, báo giá, khách hàng
  'order.create': 'Tạo đơn hàng',
  'order.update': 'Sửa đơn hàng',
  'order.lines_replace': 'Sửa sản phẩm trong đơn',
  'order.serials': 'Ghi serial máy',
  'order.status_change': 'Đổi trạng thái đơn',
  'payment.cancel': 'Hủy thanh toán',
  'quote.create': 'Tạo báo giá',
  'quote.update': 'Sửa báo giá',
  'quote.lines_replace': 'Sửa sản phẩm trong báo giá',
  'quote.revise': 'Tạo bản sửa báo giá',
  'quote.convert': 'Chuyển báo giá thành đơn',
  'quote.submit': 'Gửi duyệt báo giá',
  'quote.approve': 'Duyệt báo giá',
  'quote.reject': 'Từ chối báo giá',
  'quote.send': 'Gửi báo giá cho khách',
  'quote.accept': 'Khách đồng ý báo giá',
  'quote.decline': 'Khách từ chối báo giá',
  'quote.cancel': 'Hủy báo giá',
  'customer.create': 'Thêm khách hàng',
  'customer.update': 'Sửa khách hàng',
  'customer.contact_add': 'Thêm người liên hệ',
  'customer.contact_update': 'Sửa người liên hệ',
  'customer.contact_delete': 'Xóa người liên hệ',

  // Sản phẩm
  'product.create': 'Thêm sản phẩm',
  'product.update': 'Sửa sản phẩm',
  'product.delete': 'Xóa sản phẩm',
  'product.status_change': 'Đổi trạng thái sản phẩm',
  'product.import': 'Nhập sản phẩm từ Excel',
  'product_media.attach': 'Gắn ảnh sản phẩm',
  'product_media.detach': 'Gỡ ảnh sản phẩm',
  'product_media.reorder': 'Sắp xếp ảnh sản phẩm',
  'product_option.add': 'Thêm tùy chọn sản phẩm',
  'product_option.value_add': 'Thêm giá trị tùy chọn',
  'product_option.value_update': 'Sửa giá trị tùy chọn',
  'product_option.value_delete': 'Xóa giá trị tùy chọn',
  'variant.create': 'Thêm biến thể',
  'variant.delete': 'Xóa biến thể',
  'category.create': 'Thêm danh mục',
  'category.update': 'Sửa danh mục',
  'category.delete': 'Xóa danh mục',
  'brand.create': 'Thêm hãng',
  'brand.update': 'Sửa hãng',
  'brand.delete': 'Xóa hãng',
  'spec_definition.create': 'Thêm thông số kỹ thuật',
  'spec_definition.update': 'Sửa thông số kỹ thuật',
  'spec_definition.delete': 'Xóa thông số kỹ thuật',

  // Nội dung
  'post.create': 'Tạo bài viết',
  'post.update': 'Sửa bài viết',
  'post.delete': 'Xóa bài viết',
  'post.publish': 'Đăng bài viết',
  'post.unpublish': 'Gỡ bài viết về nháp',
  'post.archive': 'Lưu trữ bài viết',
  'post.restore': 'Khôi phục bài viết',
  'post_category.create': 'Thêm chuyên mục',
  'post_category.update': 'Sửa chuyên mục',
  'post_category.delete': 'Xóa chuyên mục',
  'page.create': 'Tạo trang tĩnh',
  'page.update': 'Sửa trang tĩnh',
  'page.delete': 'Xóa trang tĩnh',
  'page.publish': 'Đăng trang tĩnh',
  'page.unpublish': 'Gỡ trang tĩnh về nháp',
  'page.archive': 'Lưu trữ trang tĩnh',
  'page.restore': 'Khôi phục trang tĩnh',
  'policy.create_version': 'Tạo phiên bản chính sách',
  'faq.create': 'Thêm câu hỏi',
  'faq.update': 'Sửa câu hỏi',
  'faq.delete': 'Xóa câu hỏi',
  'faq.reorder': 'Sắp xếp câu hỏi',
  'banner.create': 'Thêm banner',
  'banner.update': 'Sửa banner',
  'banner.delete': 'Xóa banner',
  'banner.reorder': 'Sắp xếp banner',
  'showroom.create': 'Thêm showroom',
  'showroom.update': 'Sửa showroom',
  'showroom.delete': 'Xóa showroom',
  'review.approve': 'Duyệt đánh giá',
  'review.reject': 'Từ chối đánh giá',
  'review.reply': 'Trả lời đánh giá',

  // Hệ thống
  'setting.update': 'Đổi cấu hình',
  'staff.create': 'Tạo tài khoản nhân viên',
  'staff.update': 'Sửa nhân viên',
  'staff.delete': 'Xóa tài khoản nhân viên',
  'staff.disable': 'Khóa tài khoản',
  'staff.enable': 'Mở lại tài khoản',
  'staff.unlock': 'Gỡ khóa tạm',
  'staff.password_reset': 'Đặt lại mật khẩu cho nhân viên',
  'staff.password_changed': 'Tự đổi mật khẩu',
  'staff.password_change_failed': 'Đổi mật khẩu thất bại',
  'staff.session_revoke': 'Đăng xuất một phiên',
  'staff.sessions_revoke_all': 'Đăng xuất nhân viên khỏi mọi máy',
  'staff.sessions_revoke_others': 'Đăng xuất các máy khác',
  'staff.session_reuse_detected': 'Phát hiện dùng lại token (nghi bị đánh cắp)',
  'staff.login': 'Đăng nhập',
  'staff.logout': 'Đăng xuất',
  'staff.login_failed': 'Đăng nhập sai mật khẩu',
  'staff.locked': 'Khóa tạm do sai mật khẩu nhiều lần',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

/** Nhóm hành động để lọc nhanh: phần trước dấu chấm */
export const AUDIT_ACTION_GROUPS: { value: string; label: string }[] = [
  { value: 'order', label: 'Đơn hàng' },
  { value: 'quote', label: 'Báo giá' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'product', label: 'Sản phẩm' },
  { value: 'variant', label: 'Biến thể' },
  { value: 'category', label: 'Danh mục' },
  { value: 'brand', label: 'Hãng' },
  { value: 'post', label: 'Bài viết' },
  { value: 'page', label: 'Trang tĩnh' },
  { value: 'policy', label: 'Chính sách' },
  { value: 'faq', label: 'Câu hỏi thường gặp' },
  { value: 'banner', label: 'Banner' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'review', label: 'Đánh giá' },
  { value: 'setting', label: 'Cấu hình' },
  { value: 'staff', label: 'Tài khoản và đăng nhập' },
];

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  ORDER: 'Đơn hàng',
  QUOTE: 'Báo giá',
  CUSTOMER: 'Khách hàng',
  PRODUCT: 'Sản phẩm',
  PRODUCT_VARIANT: 'Biến thể',
  CATEGORY: 'Danh mục',
  BRAND: 'Hãng',
  SPEC_DEFINITION: 'Thông số kỹ thuật',
  POST: 'Bài viết',
  POST_CATEGORY: 'Chuyên mục bài viết',
  PAGE: 'Trang tĩnh',
  POLICY_VERSION: 'Phiên bản chính sách',
  FAQ: 'Câu hỏi thường gặp',
  BANNER: 'Banner',
  LOCATION: 'Showroom',
  REVIEW: 'Đánh giá',
  SETTING: 'Cấu hình',
  STAFF: 'Nhân viên',
  STAFF_SESSION: 'Phiên đăng nhập',
  MEDIA: 'Ảnh',
};

/** Đường dẫn trong CMS tới đối tượng của dòng nhật ký (null = không có trang riêng) */
export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case 'ORDER':
      return `/don-hang/${entityId}`;
    case 'QUOTE':
      return `/bao-gia/${entityId}`;
    case 'CUSTOMER':
      return `/khach-hang/${entityId}`;
    case 'PRODUCT':
      return `/san-pham/${entityId}`;
    case 'POST':
      return `/bai-viet/${entityId}`;
    case 'PAGE':
      return `/trang/${entityId}`;
    case 'LOCATION':
      return `/showroom/${entityId}`;
    case 'STAFF':
      return `/nhan-vien/${entityId}`;
    default:
      return null;
  }
}

export const AuditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  /** Người thực hiện */
  staffId: z.uuid().optional(),
  /** Nhóm hành động, vd "order" */
  group: z.string().trim().max(40).optional(),
  /** Một hành động cụ thể, vd "order.status_change" */
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(40).optional(),
  /** Xem toàn bộ lịch sử của một đối tượng */
  entityId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;

export interface AuditLogItem {
  id: string;
  staff: { id: string; fullName: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  /** Tên dễ đọc của đối tượng (mã đơn, tên sản phẩm...), null nếu đã bị xóa */
  entityName: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  traceId: string | null;
  createdAt: string;
}

/** Người từng có thao tác trong nhật ký (cho ô lọc) */
export interface AuditActorItem {
  id: string;
  fullName: string;
}
