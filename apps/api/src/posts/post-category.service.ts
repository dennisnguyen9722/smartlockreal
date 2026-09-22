import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  type PostCategoryCreateInput,
  type PostCategoryItem,
  type PostCategoryUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';

function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
}

/**
 * Chuyên mục bài viết (Tin tức, Hướng dẫn, So sánh...). Xóa được: bài trong chuyên mục
 * tự về "Chưa phân loại" (khóa ngoại SetNull), không mất bài.
 */
@Injectable()
export class PostCategoryService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<PostCategoryItem[]> {
    const rows = await this.db.postCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, sortOrder: true, _count: { select: { posts: true } } },
    });
    return rows.map(({ _count, ...row }) => ({ ...row, postCount: _count.posts }));
  }

  async create(input: PostCategoryCreateInput, staffId: string, ctx: AuditContext) {
    const slug = input.slug ?? (await generateUniqueSlug(input.name, (value) => this.slugTaken(value), 120));
    if (input.slug && (await this.slugTaken(input.slug))) this.slugConflict();

    try {
      const created = await this.db.postCategory.create({
        data: { name: input.name, slug, sortOrder: input.sortOrder ?? 0 },
        select: { id: true },
      });
      await this.audit.log({ staffId, action: 'post_category.create', entityType: 'POST_CATEGORY', entityId: created.id, changes: { after: input }, ctx });
    } catch (error) {
      rethrow(error);
    }
    return this.list();
  }

  async update(id: string, input: PostCategoryUpdateInput, staffId: string, ctx: AuditContext) {
    const current = await this.db.postCategory.findUnique({ where: { id } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (input.slug && input.slug !== current.slug && (await this.slugTaken(input.slug, id))) this.slugConflict();

    try {
      await this.db.postCategory.update({ where: { id }, data: input });
    } catch (error) {
      rethrow(error);
    }
    await this.audit.log({
      staffId,
      action: 'post_category.update',
      entityType: 'POST_CATEGORY',
      entityId: id,
      changes: { before: { name: current.name, slug: current.slug, sortOrder: current.sortOrder }, after: input },
      ctx,
    });
    return this.list();
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const current = await this.db.postCategory.findUnique({
      where: { id },
      select: { name: true, slug: true, _count: { select: { posts: true } } },
    });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    await this.db.postCategory.delete({ where: { id } });
    await this.audit.log({
      staffId,
      action: 'post_category.delete',
      entityType: 'POST_CATEGORY',
      entityId: id,
      changes: { before: { name: current.name, slug: current.slug, posts: current._count.posts } },
      ctx,
    });
  }

  private async slugTaken(slug: string, exceptId?: string) {
    const found = await this.db.postCategory.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  }

  private slugConflict(): never {
    throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [
      { field: 'slug', message: 'Đường dẫn này đã có chuyên mục khác dùng' },
    ]);
  }
}