import { Body, Controller, Get, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { ErrorCode, Permission, SettingGroupCodeSchema, settingsUpdateSchema } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { SettingsService } from './settings.service';

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

/**
 * Trang Cấu hình. Chỉ quản trị (setting.manage).
 * Storefront sau này đọc qua endpoint công khai riêng, chỉ trả phần được phép công khai.
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(Permission.SETTING_MANAGE)
  list() {
    return this.settings.listGroups();
  }

  /** Lưu một tab. Chỉ gửi khóa đã đổi, kèm expectedUpdatedAt nhận được lúc tải trang */
  @Patch(':group')
  @RequirePermissions(Permission.SETTING_MANAGE)
  update(@Param('group') group: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const code = parse(SettingGroupCodeSchema, group);
    return this.settings.updateGroup(code, parse(settingsUpdateSchema(code), body), user.id, auditContext(req));
  }
}