import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  DoorTypeAssignQuerySchema,
  DoorTypeCreateSchema,
  DoorTypeUpdateSchema,
  ErrorCode,
  Permission,
  ProductDoorTypeBulkSchema,
  ProductDoorTypeSetSchema,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { DoorTypeService } from './door-type.service';

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

@Controller('catalog/door-types')
export class DoorTypeController {
  constructor(private readonly doorTypes: DoorTypeService) {}

  /**
   * Hai route tĩnh dưới đây phải đứng TRƯỚC ':id',
   * không thì Nest sẽ coi "products" và "bulk" là một id.
   */

  @Get('products')
  @RequirePermissions(Permission.CATALOG_VIEW)
  listProducts(@Query() query: unknown) {
    return this.doorTypes.listProducts(parse(DoorTypeAssignQuerySchema, query));
  }

  @Post('products/bulk')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.OK)
  bulkAssign(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.doorTypes.bulkAssign(
      parse(ProductDoorTypeBulkSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Put('products/:productId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  setForProduct(
    @Param('productId') productId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const { doorTypeIds } = parse(ProductDoorTypeSetSchema, body);
    return this.doorTypes.setForProduct(
      parse(IdSchema, productId),
      doorTypeIds,
      user.id,
      auditContext(req),
    );
  }

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  list(@Query('includeInactive') includeInactive?: string) {
    return this.doorTypes.list(includeInactive === 'true' || includeInactive === '1');
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.doorTypes.create(parse(DoorTypeCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.doorTypes.update(
      parse(IdSchema, id),
      parse(DoorTypeUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.doorTypes.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}
