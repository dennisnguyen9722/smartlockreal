import type { StaffRoleCode } from '@ktm/shared';

export interface AuthUser {
  id: string;
  role: StaffRoleCode;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Do AuthGuard gán sau khi kiểm tra token */
      staff?: AuthUser;
    }
  }
}
