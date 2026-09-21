import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ErrorCode, OrderCreateSchema, OrderListQuerySchema, Permission } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { OrderService } from './order.service';

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

@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @RequirePermissions(Permission.ORDER_VIEW)
  list(@Query() query: unknown, @CurrentUser() user: AuthUser) {
    return this.orders.list(parse(OrderListQuerySchema, query), user.id);
  }

  /** Nhân viên tạo đơn (khách nhắn Zalo, mua tại showroom) */
  @Post()
  @RequirePermissions(Permission.ORDER_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.orders.create(parse(OrderCreateSchema, body), user.id, auditContext(req));
  }
}