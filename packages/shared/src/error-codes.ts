/**
 * Mã lỗi dùng chung giữa backend và frontend.
 * Frontend dựa vào `code` để quyết định hiển thị gì, KHÔNG dựa vào `message`.
 */
export const ErrorCode = {
  // Chung
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Xác thực và phân quyền
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Kho và đơn hàng
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PRICE_CHANGED: 'PRICE_CHANGED',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',

} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Định dạng lỗi chuẩn mà API luôn trả về */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
  traceId: string;
}

/** Thông báo tiếng Việt mặc định cho từng mã lỗi */
export const ErrorMessageVi: Record<ErrorCode, string> = {
  INTERNAL_ERROR: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.',
  VALIDATION_FAILED: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.',
  NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
  UNAUTHENTICATED: 'Vui lòng đăng nhập để tiếp tục.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn.',
  OUT_OF_STOCK: 'Sản phẩm không đủ tồn kho.',
  PRICE_CHANGED: 'Giá sản phẩm vừa thay đổi, vui lòng kiểm tra lại giỏ hàng.',
  QUOTE_EXPIRED: 'Báo giá đã hết hiệu lực.',
  SERVICE_UNAVAILABLE: 'Hệ thống đang bảo trì hoặc quá tải, vui lòng thử lại sau.',
};