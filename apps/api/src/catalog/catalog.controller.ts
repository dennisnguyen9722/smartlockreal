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
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  BrandCreateSchema,
  BrandUpdateSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  ErrorCode,
  ListQuerySchema,
  Permission,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { SpecDefinitionCreateSchema, SpecDefinitionUpdateSchema } from '@ktm/shared';
import { SpecDefinitionService } from './spec-definition.service';

const IdSchema = z.uuid('ID không hợp lệ');

/** Kiểm tra dữ liệu vào, lỗi trả về đúng định dạng chuẩn */
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

@Controller('catalog/brands')
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  list(@Query() query: unknown) {
    return this.brands.list(parse(ListQuerySchema, query));
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  getById(@Param('id') id: string) {
    return this.brands.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.brands.create(parse(BrandCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.brands.update(
      parse(IdSchema, id),
      parse(BrandUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.brands.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}

@Controller('catalog/categories')
export class CategoryController {
  constructor(
    private readonly categories: CategoryService,
    private readonly specs: SpecDefinitionService,
  ) {}

  @Get(':id/specs')
  @RequirePermissions(Permission.CATALOG_VIEW)
  listSpecs(@Param('id') id: string) {
    return this.specs.listByCategory(parse(IdSchema, id));
  }

  /** Khuôn thông số đầy đủ, gồm cả kế thừa từ danh mục cha */
  @Get(':id/specs/shapes')
  @RequirePermissions(Permission.CATALOG_VIEW)
  specShapes(@Param('id') id: string) {
    return this.specs.getShapes(parse(IdSchema, id));
  }

  @Post(':id/specs')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  createSpec(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.specs.create(
      parse(IdSchema, id),
      parse(SpecDefinitionCreateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Patch('specs/:specId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updateSpec(
    @Param('specId') specId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.specs.update(
      parse(IdSchema, specId),
      parse(SpecDefinitionUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete('specs/:specId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSpec(@Param('specId') specId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.specs.remove(parse(IdSchema, specId), user.id, auditContext(req));
  }

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  list(@Query() query: unknown) {
    return this.categories.list(parse(ListQuerySchema, query));
  }

  @Get('tree')
  @RequirePermissions(Permission.CATALOG_VIEW)
  tree(@Query('includeInactive') includeInactive?: string) {
    return this.categories.tree(includeInactive === 'true');
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  getById(@Param('id') id: string) {
    return this.categories.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.create(parse(CategoryCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.categories.update(
      parse(IdSchema, id),
      parse(CategoryUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}
