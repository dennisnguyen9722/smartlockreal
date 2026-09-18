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
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Bán hàng',
    items: [
      { label: 'Đơn hàng', href: '/don-hang', icon: 'ShoppingCart', permission: 'order.view' },
      { label: 'Báo giá công trình', href: '/bao-gia', icon: 'FileText', permission: 'quote.view' },
      { label: 'Khách hàng', href: '/khach-hang', icon: 'Users', permission: 'customer.view' },
    ],
  },
  {
    label: 'Sản phẩm',
    items: [
      { label: 'Danh sách sản phẩm', href: '/san-pham', icon: 'Package', permission: 'catalog.view' , ready: true },
      { label: 'Danh mục', href: '/danh-muc', icon: 'FolderTree', permission: 'catalog.view' , ready: true },
      { label: 'Hãng', href: '/hang', icon: 'Building2', permission: 'catalog.view' , ready: true },
    ],
  },
  {
    label: 'Kho',
    items: [
      { label: 'Tồn kho', href: '/ton-kho', icon: 'Boxes', permission: 'inventory.view' },
      { label: 'Nhập hàng', href: '/nhap-hang', icon: 'PackagePlus', permission: 'inventory.view' },
      { label: 'Chuyển kho', href: '/chuyen-kho', icon: 'ArrowLeftRight', permission: 'inventory.view' },
      { label: 'Kiểm kê', href: '/kiem-ke', icon: 'ClipboardCheck', permission: 'inventory.view' },
    ],
  },
  {
    label: 'Dịch vụ',
    items: [
      { label: 'Lịch lắp đặt', href: '/lap-dat', icon: 'Wrench', permission: 'service.view' },
      { label: 'Bảo hành', href: '/bao-hanh', icon: 'ShieldCheck', permission: 'warranty.view' },
    ],
  },
    {
    label: 'Nội dung',
    items: [
      { label: 'Thư viện ảnh', href: '/thu-vien-anh', icon: 'Images', permission: 'content.view', ready: true },
      { label: 'Bài viết', href: '/bai-viet', icon: 'Newspaper', permission: 'content.view' },
      { label: 'Đánh giá', href: '/danh-gia', icon: 'Star', permission: 'review.moderate' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { label: 'Giá và khuyến mãi', href: '/gia-khuyen-mai', icon: 'Tags', permission: 'pricing.view' },
      { label: 'Báo cáo', href: '/bao-cao', icon: 'ChartColumn', permission: 'report.view' },
      { label: 'Nhân viên', href: '/nhan-vien', icon: 'UserCog', permission: 'staff.manage' },
      { label: 'Cấu hình', href: '/cau-hinh', icon: 'Settings', permission: 'setting.manage' },
      { label: 'Nhật ký', href: '/nhat-ky', icon: 'ScrollText', permission: 'audit.view' },
    ],
  },
];
