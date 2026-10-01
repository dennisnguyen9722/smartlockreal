import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  ErrorCode,
  StorefrontListQuerySchema,
  StorefrontSlugSchema,
} from '@ktm/shared';
import { Public } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { StorefrontService } from './storefront.service';

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

/**
 * API cho website bán hàng. Toàn bộ là @Public: không đăng nhập, chỉ đọc.
 * Không endpoint nào ở đây trả về giá vốn, tồn kho hay thông tin khách hàng.
 */
@Controller('public')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  /** Một lần gọi đủ dữ liệu cho trang chủ */
  @Public()
  @Get('home')
  home() {
    return this.storefront.home();
  }

  @Public()
  @Get('door-types')
  doorTypes() {
    return this.storefront.listDoorTypes();
  }

  @Public()
  @Get('products')
  products(@Query() query: unknown) {
    return this.storefront.listProducts(parse(StorefrontListQuerySchema, query));
  }

  @Public()
  @Get('products/:slug')
  product(@Param() params: unknown) {
    const { slug } = parse(StorefrontSlugSchema, params);
    return this.storefront.getProduct(slug);
  }
}
