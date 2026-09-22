import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { BannerCreateSchema, BannerReorderSchema, BannerUpdateSchema, ErrorCode, Permission } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { BannerService } from './banner.service';

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

/** Banner trên website (nhóm Nội dung). Storefront đọc banner đang chạy ở Bước 9 */
@Controller('banners')
export class BannerController {
  constructor(private readonly banners: BannerService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  list() {
    return this.banners.list();
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.banners.create(parse(BannerCreateSchema, body), user.id, auditContext(req));
  }

  /** Đặt trước ':id' để "reorder" không bị hiểu là id */
  @Post('reorder')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.OK)
  reorder(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.banners.reorder(parse(BannerReorderSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.banners.update(parse(IdSchema, id), parse(BannerUpdateSchema, body), user.id, auditContext(req));
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.banners.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}