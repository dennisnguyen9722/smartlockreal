import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ErrorCode, ShopOrderCreateSchema } from '@ktm/shared';
import { Public } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
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

/** Endpoint công khai cho website (storefront). Không cần đăng nhập. */
@Controller('shop/orders')
export class ShopOrderController {
  constructor(private readonly orders: OrderService) {}

  /**
   * Khách đặt hàng. Tối đa 5 lần / 10 phút / IP (đủ cho khách thật, chặn spam).
   * Gửi lại cùng idempotencyKey thì nhận lại đúng đơn cũ.
   */
  @Post()
  @Public()
  @RateLimit({ name: 'shop-order', limit: 5, windowSeconds: 600 })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @Req() req: Request) {
    return this.orders.createFromShop(parse(ShopOrderCreateSchema, body), {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }
}