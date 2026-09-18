/** Access token sống ngắn; hết hạn thì admin tự gọi /auth/refresh */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Refresh token trong cookie HttpOnly */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const JWT_ISSUER = 'ktm-api';
/** Token của nhân viên; khách hàng không đăng nhập nên không có audience khác */
export const JWT_AUDIENCE_STAFF = 'ktm-staff';
export const JWT_ALGORITHM = 'HS256';

/** Tên cookie chứa refresh token */
export const REFRESH_COOKIE_NAME = 'ktm_rt';
/** Cookie chỉ được gửi tới các đường dẫn đăng nhập, không kèm theo mọi request */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Khóa tạm tài khoản sau khi nhập sai nhiều lần */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MINUTES = 15;
