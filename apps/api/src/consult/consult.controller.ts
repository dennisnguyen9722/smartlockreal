import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ConsultListQuerySchema,
  ConsultSubmitSchema,
  ConsultUpdateSchema,
  ErrorCode,
  Permission,
} from '@ktm/shared';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import type { AuthUser } from '../common/types/express';
import { ConsultService } from './consult.service';

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
 * Khách gửi form trên website. Không đăng nhập nên phải tự giữ mình:
 *  - @RateLimit: tối đa 5 lần/giờ/IP. Khách thật hỏi 1-2 lần là cùng.
 *  - Bẫy bot (trường `website` phải rỗng) nằm trong ConsultSubmitSchema.
 *  - Gửi trùng trong 10 phút thì dùng lại bản ghi cũ (xử lý trong service).
 * Trả về đúng một id — không trả lại nội dung khách vừa gửi, để endpoint công
 * khai này không thành chỗ đọc ngược dữ liệu ra.
 */
@Controller('shop/consult')
export class ShopConsultController {
  constructor(private readonly consult: ConsultService) {}

  @Post()
  @Public()
  @RateLimit({ name: 'shop-consult', limit: 5, windowSeconds: 3600 })
  @HttpCode(HttpStatus.CREATED)
  submit(@Body() body: unknown) {
    return this.consult.submit(parse(ConsultSubmitSchema, body));
  }
}

/** Hộp thư yêu cầu tư vấn trong trang quản trị */
@Controller('consult-requests')
export class ConsultController {
  constructor(private readonly consult: ConsultService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_VIEW)
  list(@Query() query: unknown) {
    return this.consult.list(parse(ConsultListQuerySchema, query));
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMER_VIEW)
  getById(@Param('id') id: string) {
    return this.consult.getById(parse(IdSchema, id));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOMER_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.consult.update(
      parse(IdSchema, id),
      parse(ConsultUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }
}
