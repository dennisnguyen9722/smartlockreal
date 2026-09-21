import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ErrorCode,
  Permission,
  QuoteActionSchema,
  QuoteConvertSchema,
  QuoteCreateSchema,
  QuoteLinesReplaceSchema,
  QuoteListQuerySchema,
  QuoteReviseSchema,
  QuoteUpdateSchema,
  roleHasPermission,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { QuoteService } from './quote.service';

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

@Controller('quotes')
export class QuoteController {
  constructor(private readonly quotes: QuoteService) {}

  @Get()
  @RequirePermissions(Permission.QUOTE_VIEW)
  list(@Query() query: unknown, @CurrentUser() user: AuthUser) {
    return this.quotes.list(parse(QuoteListQuerySchema, query), user.id);
  }

  /** Trang in: báo giá + thông tin công ty mới nhất */
  @Get(':id/print')
  @RequirePermissions(Permission.QUOTE_VIEW)
  printData(@Param('id') id: string) {
    return this.quotes.printData(parse(IdSchema, id));
  }

  @Get(':id')
  @RequirePermissions(Permission.QUOTE_VIEW)
  getById(@Param('id') id: string) {
    return this.quotes.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.QUOTE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.quotes.create(parse(QuoteCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.QUOTE_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.quotes.update(parse(IdSchema, id), parse(QuoteUpdateSchema, body), user.id, auditContext(req));
  }

  @Put(':id/lines')
  @RequirePermissions(Permission.QUOTE_MANAGE)
  replaceLines(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.quotes.replaceLines(parse(IdSchema, id), parse(QuoteLinesReplaceSchema, body), user.id, auditContext(req));
  }

  /** Khách muốn sửa sau khi đã gửi: tạo phiên bản mới (trả về bản mới) */
  @Post(':id/revise')
  @RequirePermissions(Permission.QUOTE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  revise(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { expectedVersion } = parse(QuoteReviseSchema, body);
    return this.quotes.revise(parse(IdSchema, id), expectedVersion, user.id, auditContext(req));
  }

  /** Khách đồng ý: tạo đơn kênh Công trình với đúng giá đã báo */
  @Post(':id/convert')
  @RequirePermissions(Permission.QUOTE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  convert(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    // Tạo đơn nên cần cả quyền quản lý đơn
    if (!roleHasPermission(user.role, Permission.ORDER_MANAGE)) {
      throw new AppException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, { hint: 'Bạn không có quyền tạo đơn hàng' });
    }
    return this.quotes.convert(parse(IdSchema, id), parse(QuoteConvertSchema, body), user.id, auditContext(req));
  }

  /** Gửi duyệt, rút lại, duyệt, trả lại, mở lại, hủy, đã gửi, khách đồng ý/từ chối */
  @Post(':id/actions')
  @RequirePermissions(Permission.QUOTE_MANAGE)
  @HttpCode(HttpStatus.OK)
  act(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const input = parse(QuoteActionSchema, body);
    // Duyệt và trả lại cần quyền riêng (quote.approve, hiện chỉ quản trị)
    if ((input.action === 'APPROVE' || input.action === 'RETURN') && !roleHasPermission(user.role, Permission.QUOTE_APPROVE)) {
      throw new AppException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, { hint: 'Bạn không có quyền duyệt báo giá' });
    }
    return this.quotes.act(parse(IdSchema, id), input, user.id, auditContext(req));
  }
}