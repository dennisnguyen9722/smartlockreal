import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  PAGE_RESERVED_SLUGS,
  htmlPlainText,
  pagePath,
  type PageCreateInput,
  type PageDetail,
  type PageListItem,
  type PageStatusActionInput,
  type PageUpdateInput,
  type PostStatusValue,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { sanitizeRichHtml } from '../common/rich-text';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';

type FieldError = { field: string; message: string };

function invalid(details: FieldError[]): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, details);
}

function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
}

function editConflict(): never {
  throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
}

const PAGE_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  contentHtml: true,
  seoTitle: true,
  seoDescription: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PageSelect;

type PageRow = Prisma.PageGetPayload<{ select: typeof PAGE_SELECT }>;

function missingForPublish(row: { title: string; contentHtml: string }): string[] {
  const missing: string[] = [];
  if (!row.title.trim()) missing.push('Tiêu đề');
  if (!htmlPlainText(row.contentHtml)) missing.push('Nội dung');
  return missing;
}

/**
 * Trang tĩnh (Giới thiệu, Liên hệ...). Giống bài viết nhưng đơn giản hơn: không chuyên mục, không hẹn giờ.
 * Đường dẫn nằm ngay dưới tên miền nên chặn trùng PAGE_RESERVED_SLUGS.
 */
@Injectable()
export class PageService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<PageListItem[]> {
    const rows = await this.db.page.findMany({ orderBy: [{ title: 'asc' }], select: PAGE_SELECT });
    return rows.map((row) => this.toListItem(row));
  }

  async getById(id: string): Promise<PageDetail> {
    const row = await this.db.page.findUnique({ where: { id }, select: PAGE_SELECT });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.toDetail(row);
  }

  async create(input: PageCreateInput, staffId: string, ctx: AuditContext): Promise<PageDetail> {
    const slug = input.slug ?? (await generateUniqueSlug(input.title, (value) => this.slugUnavailable(value)));
    if (input.slug && (await this.slugUnavailable(input.slug))) this.slugConflict();

    let row: PageRow;
    try {
      row = await this.db.page.create({
        data: {
          title: input.title,
          slug,
          contentHtml: sanitizeRichHtml(input.content ?? ''),
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          updatedById: staffId,
        },
        select: PAGE_SELECT,
      });
    } catch (error) {
      rethrow(error);
    }
    await this.audit.log({ staffId, action: 'page.create', entityType: 'PAGE', entityId: row.id, changes: { after: { title: input.title, slug } }, ctx });
    return this.toDetail(row);
  }

  async update(id: string, input: PageUpdateInput, staffId: string, ctx: AuditContext): Promise<PageDetail> {
    const current = await this.db.page.findUnique({ where: { id }, select: PAGE_SELECT });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) editConflict();

    const data: Prisma.PageUncheckedUpdateManyInput = { updatedById: staffId };
    if (input.title !== undefined) data.title = input.title;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
    const contentHtml = input.content !== undefined ? sanitizeRichHtml(input.content) : undefined;
    if (contentHtml !== undefined) data.contentHtml = contentHtml;

    const slugChanged = input.slug !== undefined && input.slug !== current.slug;
    if (slugChanged) {
      if (await this.slugUnavailable(input.slug as string, id)) this.slugConflict();
      data.slug = input.slug;
    }

    if (current.status === 'PUBLISHED') {
      const missing = missingForPublish({ title: input.title ?? current.title, contentHtml: contentHtml ?? current.contentHtml });
      if (missing.length > 0) invalid([{ field: 'content', message: `Trang đang hiện không được để trống: ${missing.join(', ')}` }]);
    }

    try {
      await this.db.$transaction(async (tx) => {
        const result = await tx.page.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
        if (result.count === 0) editConflict();
        // Trang đã từng lên website: link cũ chuyển 301 sang link mới (cùng quy tắc với sản phẩm, bài viết)
        if (slugChanged && current.publishedAt) {
          const fromPath = pagePath(current.slug);
          const toPath = pagePath(input.slug as string);
          await tx.urlRedirect.deleteMany({ where: { fromPath: toPath } });
          await tx.urlRedirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
          await tx.urlRedirect.upsert({
            where: { fromPath },
            create: { fromPath, toPath, statusCode: 301, createdById: staffId },
            update: { toPath },
          });
        }
      });
    } catch (error) {
      rethrow(error);
    }

    const logged = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'content' && key !== 'expectedUpdatedAt'));
    await this.audit.log({
      staffId,
      action: 'page.update',
      entityType: 'PAGE',
      entityId: id,
      changes: { after: { ...logged, contentChanged: input.content !== undefined } },
      ctx,
    });
    return this.getById(id);
  }

  async changeStatus(id: string, input: PageStatusActionInput, staffId: string, ctx: AuditContext): Promise<PageDetail> {
    const current = await this.db.page.findUnique({ where: { id }, select: PAGE_SELECT });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) editConflict();

    const wrong = (hint: string): never => {
      throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, { hint });
    };
    let status: PostStatusValue;
    let publishedAt = current.publishedAt;
    switch (input.action) {
      case 'PUBLISH': {
        if (current.status === 'ARCHIVED') wrong('Trang đang lưu trữ: khôi phục về Nháp trước');
        if (current.status === 'PUBLISHED') wrong('Trang đang hiện trên website');
        const missing = missingForPublish(current);
        if (missing.length > 0) invalid([{ field: 'status', message: `Chưa đăng được, còn thiếu: ${missing.join(', ')}` }]);
        status = 'PUBLISHED';
        // Giữ ngày đăng gốc nếu trang từng đăng rồi gỡ
        publishedAt = current.publishedAt ?? new Date();
        break;
      }
      case 'UNPUBLISH':
        if (current.status !== 'PUBLISHED') wrong('Trang chưa đăng');
        status = 'DRAFT';
        break;
      case 'ARCHIVE':
        if (current.status === 'ARCHIVED') wrong('Trang đã ở Lưu trữ');
        status = 'ARCHIVED';
        break;
      case 'RESTORE':
        if (current.status !== 'ARCHIVED') wrong('Chỉ khôi phục trang đang lưu trữ');
        status = 'DRAFT';
        break;
    }

    const result = await this.db.page.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data: { status, publishedAt, updatedById: staffId },
    });
    if (result.count === 0) editConflict();
    await this.audit.log({
      staffId,
      action: `page.${input.action.toLowerCase()}`,
      entityType: 'PAGE',
      entityId: id,
      changes: { before: { status: current.status }, after: { status } },
      ctx,
    });
    return this.getById(id);
  }

  /** Chỉ xóa trang chưa từng lên website; đã đăng thì lưu trữ (link có thể đã được chia sẻ) */
  async remove(id: string, staffId: string, ctx: AuditContext): Promise<void> {
    const current = await this.db.page.findUnique({ where: { id }, select: { title: true, slug: true, publishedAt: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.publishedAt) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        hint: 'Trang đã từng đăng lên website nên không xóa được. Chuyển vào Lưu trữ thay thế.',
      });
    }
    await this.db.page.delete({ where: { id } });
    await this.audit.log({ staffId, action: 'page.delete', entityType: 'PAGE', entityId: id, changes: { before: current }, ctx });
  }

  // ================= Nội bộ =================

  /** Trùng trang khác hoặc trùng đường dẫn dành riêng */
  private async slugUnavailable(slug: string, exceptId?: string): Promise<boolean> {
    if ((PAGE_RESERVED_SLUGS as readonly string[]).includes(slug)) return true;
    const found = await this.db.page.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  }

  private slugConflict(): never {
    invalid([{ field: 'slug', message: 'Đường dẫn này đã có trang khác dùng hoặc dành cho khu vực khác của website' }]);
  }

  private toListItem(row: PageRow): PageListItem {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  }

  private toDetail(row: PageRow): PageDetail {
    const text = htmlPlainText(row.contentHtml);
    return {
      ...this.toListItem(row),
      content: row.contentHtml,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      missing: missingForPublish(row),
      wordCount: text ? text.split(' ').length : 0,
    };
  }
}