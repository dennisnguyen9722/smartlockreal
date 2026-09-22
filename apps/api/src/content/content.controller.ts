import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ErrorCode,
  FaqCreateSchema,
  FaqListQuerySchema,
  FaqReorderSchema,
  FaqUpdateSchema,
  POLICY_CODES,
  PageCreateSchema,
  PageStatusActionSchema,
  PageUpdateSchema,
  Permission,
  PolicyVersionCreateSchema,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { FaqService } from './faq.service';
import { PageService } from './page.service';
import { PolicyService } from './policy.service';

const IdSchema = z.uuid('ID không hợp lệ');
const PolicyCodeSchema = z.enum(POLICY_CODES, 'Loại chính sách không hợp lệ');

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

@Controller('pages')
export class PageController {
  constructor(private readonly pages: PageService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  list() {
    return this.pages.list();
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTENT_VIEW)
  getById(@Param('id') id: string) {
    return this.pages.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.pages.create(parse(PageCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.pages.update(parse(IdSchema, id), parse(PageUpdateSchema, body), user.id, auditContext(req));
  }

  @Post(':id/status')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.OK)
  changeStatus(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.pages.changeStatus(parse(IdSchema, id), parse(PageStatusActionSchema, body), user.id, auditContext(req));
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.pages.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}

/**
 * Chính sách: chỉ đọc và TẠO PHIÊN BẢN MỚI. Không có sửa/xóa (database chặn).
 * Tạo phiên bản là việc có hệ quả pháp lý nên chỉ quản trị (setting.manage).
 */
@Controller('policies')
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  summary() {
    return this.policies.summary();
  }

  @Get('versions/:id')
  @RequirePermissions(Permission.CONTENT_VIEW)
  getVersion(@Param('id') id: string) {
    return this.policies.getById(parse(IdSchema, id));
  }

  @Get(':code/versions')
  @RequirePermissions(Permission.CONTENT_VIEW)
  versions(@Param('code') code: string) {
    return this.policies.versions(parse(PolicyCodeSchema, code));
  }

  @Post('versions')
  @RequirePermissions(Permission.SETTING_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.policies.create(parse(PolicyVersionCreateSchema, body), user.id, auditContext(req));
  }
}

@Controller('faqs')
export class FaqController {
  constructor(private readonly faqs: FaqService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  list(@Query() query: unknown) {
    return this.faqs.list(parse(FaqListQuerySchema, query));
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.faqs.create(parse(FaqCreateSchema, body), user.id, auditContext(req));
  }

  /** Đặt trước ':id' để "reorder" không bị hiểu là id */
  @Post('reorder')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.OK)
  reorder(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.faqs.reorder(parse(FaqReorderSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.faqs.update(parse(IdSchema, id), parse(FaqUpdateSchema, body), user.id, auditContext(req));
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.faqs.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}