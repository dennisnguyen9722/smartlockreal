import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ErrorCode,
  Permission,
  PostCategoryCreateSchema,
  PostCategoryUpdateSchema,
  PostCreateSchema,
  PostListQuerySchema,
  PostStatusActionSchema,
  PostUpdateSchema,
} from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { PostCategoryService } from './post-category.service';
import { PostService } from './post.service';

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

/** Chuyên mục bài viết. Tách đường dẫn riêng để không đụng /posts/:id */
@Controller('post-categories')
export class PostCategoryController {
  constructor(private readonly categories: PostCategoryService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  list() {
    return this.categories.list();
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.create(parse(PostCategoryCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.update(parse(IdSchema, id), parse(PostCategoryUpdateSchema, body), user.id, auditContext(req));
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}

@Controller('posts')
export class PostController {
  constructor(private readonly posts: PostService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  list(@Query() query: unknown) {
    return this.posts.list(parse(PostListQuerySchema, query));
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTENT_VIEW)
  getById(@Param('id') id: string) {
    return this.posts.getById(parse(IdSchema, id));
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.posts.create(parse(PostCreateSchema, body), user.id, auditContext(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.posts.update(parse(IdSchema, id), parse(PostUpdateSchema, body), user.id, auditContext(req));
  }

  /** Đăng (ngay hoặc hẹn giờ), gỡ về Nháp, lưu trữ, khôi phục */
  @Post(':id/status')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.OK)
  changeStatus(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.posts.changeStatus(parse(IdSchema, id), parse(PostStatusActionSchema, body), user.id, auditContext(req));
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.posts.remove(parse(IdSchema, id), user.id, auditContext(req));
  }
}