import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ErrorCode, Permission, ShowroomCreateSchema, ShowroomUpdateSchema } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { ShowroomService } from './showroom.service';

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

/**
 * Showroom trong CMS (nhóm Nội dung). Chỉ xóa được showroom chưa từng dùng;
 * đã gắn đơn "nhận tại showroom" thì TẮT (isActive = false). Storefront đọc danh sách công khai ở Bước 9.
 */
@Controller('showrooms')
export class ShowroomController {
  constructor(private readonly showrooms: ShowroomService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  list() {
    return this.showrooms.list();
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTENT_VIEW)
  getById(@Param('id') id: string) {
    return this.showrooms.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.showrooms.create(parse(ShowroomCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.showrooms.update(parse(IdSchema, id), parse(ShowroomUpdateSchema, body), user.id, auditContext(req));
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.showrooms.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}