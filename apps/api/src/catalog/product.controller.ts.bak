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
  ErrorCode,
  OptionValueCreateSchema,
  OptionValueUpdateSchema,
  Permission,
  ProductBulkDeleteSchema,
  ProductCreateSchema,
  ProductListQuerySchema,
  ProductMediaAttachSchema,
  ProductMediaReorderSchema,
  ProductOptionAddSchema,
  ProductStatusChangeSchema,
  ProductUpdateSchema,
  VariantBatchCreateSchema,
  VariantCreateSchema,
  VariantQuickCreateSchema,
  VariantUpdateSchema,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { ProductMediaService } from './product-media.service';
import { ProductOptionService } from './product-option.service';
import { ProductService } from './product.service';
import { VariantService } from './variant.service';

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
  constructor(
    private readonly products: ProductService,
    private readonly variants: VariantService,
    private readonly options: ProductOptionService,
    private readonly media: ProductMediaService,
  ) {}

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  list(@Query() query: unknown) {
    return this.products.list(parse(ProductListQuerySchema, query));
  }

  // ---------- Biến thể ----------

  @Post(':id/variants')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  createVariant(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.variants.create(
      parse(IdSchema, id),
      parse(VariantCreateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  /** Thêm biến thể theo nhãn ("Màu sắc: Rose Gold, App: TTLock"); tự tạo thuộc tính/giá trị còn thiếu */
  @Post(':id/variants/quick')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  quickCreateVariant(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.variants.quickCreate(
      parse(IdSchema, id),
      parse(VariantQuickCreateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  /** Tạo nhiều biến thể trong một transaction (vd: tạo nhanh các tổ hợp còn thiếu) */
  @Post(':id/variants/batch')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  createVariants(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const { variants } = parse(VariantBatchCreateSchema, body);
    return this.variants.createMany(parse(IdSchema, id), variants, user.id, auditContext(req));
  }

  @Patch('variants/:variantId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updateVariant(
    @Param('variantId') variantId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.variants.update(
      parse(IdSchema, variantId),
      parse(VariantUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete('variants/:variantId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVariant(
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.variants.remove(parse(IdSchema, variantId), user.id, auditContext(req));
  }

  // ---------- Thuộc tính và giá trị ----------

  /** Thêm thuộc tính mới; biến thể đang có được gán vào giá trị mặc định */
  @Post(':id/options')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  addOption(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.options.addOption(
      parse(IdSchema, id),
      parse(ProductOptionAddSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Post(':id/options/:optionId/values')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  addOptionValue(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.options.addValue(
      parse(IdSchema, id),
      parse(IdSchema, optionId),
      parse(OptionValueCreateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Patch('options/values/:valueId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updateOptionValue(
    @Param('valueId') valueId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.options.updateValue(
      parse(IdSchema, valueId),
      parse(OptionValueUpdateSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Delete('options/values/:valueId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOptionValue(
    @Param('valueId') valueId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.options.removeValue(parse(IdSchema, valueId), user.id, auditContext(req));
  }

  // ---------- Ảnh ----------

  @Get(':id/media')
  @RequirePermissions(Permission.CATALOG_VIEW)
  listMedia(@Param('id') id: string) {
    return this.media.list(parse(IdSchema, id));
  }

  @Post(':id/media')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  attachMedia(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.media.attach(
      parse(IdSchema, id),
      parse(ProductMediaAttachSchema, body),
      user.id,
      auditContext(req),
    );
  }

  @Patch(':id/media/order')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  reorderMedia(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const { mediaIds } = parse(ProductMediaReorderSchema, body);
    return this.media.reorder(parse(IdSchema, id), mediaIds, user.id, auditContext(req));
  }

  @Delete('media/:mediaId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  detachMedia(@Param('mediaId') mediaId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.media.detach(parse(IdSchema, mediaId), user.id, auditContext(req));
  }

  // ---------- Sản phẩm ----------

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

  /** Đổi trạng thái có kiểm tra điều kiện (xem ALLOWED_TRANSITIONS trong ProductService) */
  @Post(':id/status')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.OK)
  changeStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.changeStatus(
      parse(IdSchema, id),
      parse(ProductStatusChangeSchema, body),
      user.id,
      auditContext(req),
    );
  }

  /** Xóa hẳn; chỉ được khi chưa từng phát sinh giao dịch. Còn lại dùng lưu trữ. */
  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.remove(parse(IdSchema, id), user.id, auditContext(req));
  }

  /** Xóa nhiều; trả về danh sách đã xóa và danh sách bỏ qua kèm lý do */
  @Post('bulk-delete')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.OK)
  removeMany(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { ids } = parse(ProductBulkDeleteSchema, body);
    return this.products.removeMany(ids, user.id, auditContext(req));
  }

  /** Giữ cho tương thích; tương đương POST /:id/status { status: 'ARCHIVED' } */
  @Post(':id/archive')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.archive(parse(IdSchema, id), user.id, auditContext(req));
  }
}