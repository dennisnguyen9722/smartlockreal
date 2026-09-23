import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ErrorCode,
  Permission,
  StaffCreateSchema,
  StaffResetPasswordSchema,
  StaffStatusActionSchema,
  StaffUpdateSchema,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { StaffService } from './staff.service';

const IdSchema = z.uuid('ID không hợp lệ');

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppException(
      ErrorCode.VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

function auditContext(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    traceId: req.get('x-request-id') ?? undefined,
  };
}

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  // ----- Của chính mình (mọi nhân viên đã đăng nhập). Khai báo TRƯỚC ':id' -----

  @Get('me/sessions')
  mySessions(@CurrentUser() user: AuthUser) {
    return this.staff.mySessions(user.id, user.sessionId);
  }

  /** Đăng xuất mọi phiên khác, giữ phiên đang dùng */
  @Delete('me/sessions')
  async revokeMyOtherSessions(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return { revoked: await this.staff.revokeOtherSessions(user.id, user.sessionId, auditContext(req)) };
  }

  @Delete('me/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeMySession(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.revokeSession(parse(IdSchema, sessionId), user.id, auditContext(req), user.id);
  }

  // ----- Quản trị -----

  @Get()
  @RequirePermissions(Permission.STAFF_MANAGE)
  list(@CurrentUser() user: AuthUser) {
    return this.staff.list(user.id);
  }

  @Delete('sessions/:sessionId')
  @RequirePermissions(Permission.STAFF_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.revokeSession(parse(IdSchema, sessionId), user.id, auditContext(req));
  }

  @Get(':id')
  @RequirePermissions(Permission.STAFF_MANAGE)
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.staff.getById(parse(IdSchema, id), user.id, user.sessionId);
  }

  /** Trả kèm mật khẩu tạm MỘT lần (khi không tự đặt mật khẩu) */
  @Post()
  @RequirePermissions(Permission.STAFF_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.create(parse(StaffCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.STAFF_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.update(parse(IdSchema, id), parse(StaffUpdateSchema, body), user.id, auditContext(req));
  }

  /** DISABLE (khóa, thu hồi mọi phiên), ENABLE, UNLOCK (gỡ khóa tạm do nhập sai mật khẩu) */
  @Post(':id/status')
  @RequirePermissions(Permission.STAFF_MANAGE)
  @HttpCode(HttpStatus.OK)
  changeStatus(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.changeStatus(parse(IdSchema, id), parse(StaffStatusActionSchema, body), user.id, auditContext(req));
  }

  /** Chỉ xóa được tài khoản chưa từng dùng; còn lại phải khóa */
  @Delete(':id')
  @RequirePermissions(Permission.STAFF_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.remove(parse(IdSchema, id), user.id, auditContext(req));
  }

  @Post(':id/revoke-sessions')
  @RequirePermissions(Permission.STAFF_MANAGE)
  @HttpCode(HttpStatus.OK)
  revokeAllSessions(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.revokeAllSessions(parse(IdSchema, id), user.id, auditContext(req));
  }

  @Post(':id/reset-password')
  @RequirePermissions(Permission.STAFF_MANAGE)
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const input = parse(StaffResetPasswordSchema, body ?? {});
    return this.staff.resetPassword(parse(IdSchema, id), input.password, user.id, auditContext(req));
  }
}