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
  ErrorCode,
  Permission,
  ProductCreateSchema,
  ProductListQuerySchema,
  ProductUpdateSchema,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { ProductService } from './product.service';

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

@Controller('catalog/products')
export class ProductController {
  constructor(private readonly products: ProductService) {}

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  list(@Query() query: unknown) {
    return this.products.list(parse(ProductListQuerySchema, query));
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  getById(@Param('id') id: string) {
    return this.products.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.create(parse(ProductCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.update(
      parse(IdSchema, id),
      parse(ProductUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.archive(parse(IdSchema, id), user.id, auditContext(req));
  }
}
