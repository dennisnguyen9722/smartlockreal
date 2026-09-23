import type { Permission } from './permissions';

/** Một mục trong menu CMS */
export interface NavItem {
  label: string;
  href: string;
  /** Tên biểu tượng của lucide-react */
  icon: string;
  /** Không có quyền này thì mục bị ẩn */
  permission: Permission;
  /** Trang đã xây dựng xong chưa; chưa thì hiển thị mờ kèm nhãn "Sắp có" */
  ready?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Menu của trang quản trị. Mục nào nhân viên không có quyền sẽ tự động bị ẩn.
 * Các trang chưa làm vẫn để sẵn để thấy toàn cảnh hệ thống.
 *
 * Không có nhóm Kho và Dịch vụ: công ty không giữ kho, lắp đặt và bảo hành do hãng làm
 * (quyết định ở Bước 6). Công ty chỉ TRA CỨU bảo hành (đơn, serial, ngày giao) để báo hãng.
 * Không có Giá và khuyến mãi (chốt ở Bước 9): giá sau chiết khấu nhập thẳng vào giá niêm yết,
 * giảm giá hiển thị bằng giá gạch ngang (compareAtPrice).
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Bán hàng',
    items: [
      { label: 'Đơn hàng', href: '/don-hang', icon: 'ShoppingCart', permission: 'order.view', ready: true },
      { label: 'Báo giá công trình', href: '/bao-gia', icon: 'FileText', permission: 'quote.view', ready: true },
      { label: 'Khách hàng', href: '/khach-hang', icon: 'Users', permission: 'customer.view', ready: true },
      { label: 'Tra cứu bảo hành', href: '/bao-hanh', icon: 'ShieldCheck', permission: 'warranty.view', ready: true },
    ],
  },
  {
    label: 'Sản phẩm',
    items: [
      { label: 'Danh sách sản phẩm', href: '/san-pham', icon: 'Package', permission: 'catalog.view', ready: true },
      { label: 'Danh mục', href: '/danh-muc', icon: 'FolderTree', permission: 'catalog.view', ready: true },
      { label: 'Hãng', href: '/hang', icon: 'Building2', permission: 'catalog.view', ready: true },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      { label: 'Thư viện ảnh', href: '/thu-vien-anh', icon: 'Images', permission: 'content.view', ready: true },
      { label: 'Showroom', href: '/showroom', icon: 'Store', permission: 'content.view', ready: true },
      { label: 'Bài viết', href: '/bai-viet', icon: 'Newspaper', permission: 'content.view', ready: true },
      { label: 'Banner', href: '/banner', icon: 'GalleryHorizontal', permission: 'content.view', ready: true },
      { label: 'Trang tĩnh', href: '/trang', icon: 'StickyNote', permission: 'content.view', ready: true },
      { label: 'Chính sách', href: '/chinh-sach', icon: 'Scale', permission: 'content.view', ready: true },
      { label: 'Câu hỏi thường gặp', href: '/cau-hoi', icon: 'CircleHelp', permission: 'content.view', ready: true },
      { label: 'Đánh giá', href: '/danh-gia', icon: 'Star', permission: 'review.moderate', ready: true },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { label: 'Báo cáo', href: '/bao-cao', icon: 'ChartColumn', permission: 'report.view', ready: true },
      { label: 'Nhân viên', href: '/nhan-vien', icon: 'UserCog', permission: 'staff.manage', ready: true },
      { label: 'Cấu hình', href: '/cau-hinh', icon: 'Settings', permission: 'setting.manage', ready: true },
      { label: 'Nhật ký', href: '/nhat-ky', icon: 'ScrollText', permission: 'audit.view', ready: true },
    ],
  },
];
