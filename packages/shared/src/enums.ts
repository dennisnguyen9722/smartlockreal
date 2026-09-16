/** Kênh phát sinh đơn hàng */
export const SalesChannel = {
  WEBSITE: 'WEBSITE', // Khách tự đặt trên website
  ZALO: 'ZALO', // Nhân viên tạo đơn từ tin nhắn Zalo
  STORE: 'STORE', // Bán trực tiếp tại cửa hàng
  PROJECT: 'PROJECT', // Đơn công trình (từ báo giá)
} as const;
export type SalesChannel = (typeof SalesChannel)[keyof typeof SalesChannel];

/** Loại điểm tồn kho */
export const LocationType = {
  WAREHOUSE: 'WAREHOUSE', // Kho tổng TP.HCM
  STORE: 'STORE', // 3 cửa hàng (2 HCM, 1 Hà Nội)
} as const;
export type LocationType = (typeof LocationType)[keyof typeof LocationType];

/** Khu vực, dùng để chọn điểm xuất hàng và xếp lịch kỹ thuật viên */
export const Region = {
  HCM: 'HCM',
  HN: 'HN',
} as const;
export type Region = (typeof Region)[keyof typeof Region];

/**
 * Tên sự kiện realtime (Socket.IO).
 * Backend phát và frontend lắng nghe đều dùng hằng số này,
 * nên không bao giờ bị lệch tên.
 */
export const RealtimeEvent = {
  NOTIFICATION_NEW: 'notification:new',
  ORDER_CREATED: 'order:created',
  QUOTE_REQUESTED: 'quote:requested',
  STOCK_LOW: 'stock:low',
  INSTALL_JOB_ASSIGNED: 'install:job-assigned',
} as const;
export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];