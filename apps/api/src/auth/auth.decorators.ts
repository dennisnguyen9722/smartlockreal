import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission } from '@ktm/shared';
import type { AuthUser } from '../common/types/express';

export const PUBLIC_KEY = 'ktm:public';
export const PERMISSIONS_KEY = 'ktm:permissions';

/** Endpoint không cần đăng nhập (mặc định MỌI endpoint đều cần) */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Yêu cầu nhân viên có TẤT CẢ các quyền liệt kê */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Lấy nhân viên đang đăng nhập: @CurrentUser() staff: AuthUser */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (!request.staff) {
    throw new Error('CurrentUser dùng trên endpoint công khai: không có thông tin nhân viên');
  }
  return request.staff;
});
