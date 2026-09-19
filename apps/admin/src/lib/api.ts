import type { ApiErrorBody, ErrorCode, Permission, StaffRoleCode } from '@ktm/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface StaffProfile {
  id: string;
  email: string;
  fullName: string;
  role: StaffRoleCode;
  lastLoginAt?: string | null;
  permissions?: Permission[];
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  staff: StaffProfile;
}

/** Lỗi từ API, giữ nguyên mã lỗi để giao diện xử lý theo từng trường hợp */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = options;

  // Gửi file (FormData) thì để trình duyệt tự đặt content-type kèm boundary
  const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      // Luôn gửi cookie để refresh token đi kèm
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'content-type': 'application/json' }),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0, 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng.');
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body as ApiErrorBody | null;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      response.status,
      error?.message ?? 'Đã có lỗi xảy ra.',
      error?.details,
    );
  }
  return body as T;
}