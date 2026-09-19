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
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  IN_USE: 'IN_USE',
  /** Bản ghi đã bị người khác sửa sau lúc mình tải về */
  EDIT_CONFLICT: 'EDIT_CONFLICT',

  // Xác thực và phân quyền
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  SESSION_REVOKED: 'SESSION_REVOKED',

  // Danh mục sản phẩm
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',

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
  ALREADY_EXISTS: 'Dữ liệu đã tồn tại.',
  IN_USE: 'Dữ liệu đang được sử dụng nên không thể xóa.',
  EDIT_CONFLICT: 'Dữ liệu vừa được người khác thay đổi. Vui lòng tải lại trang rồi sửa lại.',
  INTERNAL_ERROR: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.',
  VALIDATION_FAILED: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.',
  NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
  UNAUTHENTICATED: 'Vui lòng đăng nhập để tiếp tục.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn.',
  INVALID_STATUS_TRANSITION: 'Không thể chuyển sang trạng thái này.',
  OUT_OF_STOCK: 'Sản phẩm không đủ tồn kho.',
  PRICE_CHANGED: 'Giá sản phẩm vừa thay đổi, vui lòng kiểm tra lại giỏ hàng.',
  QUOTE_EXPIRED: 'Báo giá đã hết hiệu lực.',
  SERVICE_UNAVAILABLE: 'Hệ thống đang bảo trì hoặc quá tải, vui lòng thử lại sau.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_LOCKED: 'Tài khoản đang tạm khóa do nhập sai nhiều lần, vui lòng thử lại sau.',
  ACCOUNT_DISABLED: 'Tài khoản đã bị vô hiệu hóa.',
  SESSION_REVOKED: 'Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại.',
};