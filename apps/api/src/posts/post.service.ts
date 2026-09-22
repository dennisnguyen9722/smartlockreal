import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  htmlPlainText,
  postPath,
  type Paginated,
  type PostCreateInput,
  type PostDetail,
  type PostListItem,
  type PostListQuery,
  type PostStatusActionInput,
  type PostStatusCounts,
  type PostStatusValue,
  type PostUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';
import { sanitizeRichHtml } from '../common/rich-text';

type Tx = Prisma.TransactionClient;
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

const LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  coverMedia: { select: { url: true } },
  author: { select: { id: true, fullName: true } },
} satisfies Prisma.PostSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  excerpt: true,
  contentHtml: true,
  categoryId: true,
  coverMediaId: true,
  seoTitle: true,
  seoDescription: true,
  products: {
    orderBy: { sortOrder: 'asc' },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          media: { where: { variantId: null }, orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        },
      },
    },
  },
} satisfies Prisma.PostSelect;

type ListRow = Prisma.PostGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.PostGetPayload<{ select: typeof DETAIL_SELECT }>;

/** Điều kiện BẮT BUỘC để đăng. Ảnh bìa, tóm tắt, mô tả SEO là nên có (giao diện nhắc) */
function missingForPublish(row: { title: string; contentHtml: string }): string[] {
  const missing: string[] = [];
  if (!row.title.trim()) missing.push('Tiêu đề');
  if (!htmlPlainText(row.contentHtml)) missing.push('Nội dung');
  return missing;
}

@Injectable()
export class PostService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  // ================= Đọc =================

  async list(query: PostListQuery): Promise<Paginated<PostListItem> & { statusCounts: PostStatusCounts }> {
    const now = new Date();
    const baseWhere: Prisma.PostWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const byStatus: Record<PostListQuery['status'], Prisma.PostWhereInput> = {
      ALL: {},
      DRAFT: { status: 'DRAFT' },
      // Đã đăng = website đang hiện; Hẹn giờ = đã bấm đăng nhưng chưa tới giờ
      PUBLISHED: { status: 'PUBLISHED', publishedAt: { lte: now } },
      SCHEDULED: { status: 'PUBLISHED', publishedAt: { gt: now } },
      ARCHIVED: { status: 'ARCHIVED' },
    };
    const where = { ...baseWhere, ...byStatus[query.status] };

    const statuses = Object.keys(byStatus) as PostListQuery['status'][];
    const [rows, total] = await this.db.$transaction([
      this.db.post.findMany({
        where,
        // Bài mới sửa lên đầu: người viết hay quay lại bài đang làm dở
        orderBy: [{ updatedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: LIST_SELECT,
      }),
      this.db.post.count({ where }),
    ]);
    // Số đếm từng tab (cùng bộ lọc tìm kiếm, chuyên mục)
    const counts = await Promise.all(
      statuses.map((status) => this.db.post.count({ where: { ...baseWhere, ...byStatus[status] } })),
    );

    return {
      items: rows.map((row) => this.toListItem(row, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts: Object.fromEntries(statuses.map((status, index) => [status, counts[index] ?? 0])) as PostStatusCounts,
    };
  }

  async getById(id: string): Promise<PostDetail> {
    const row = await this.db.post.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.toDetail(row);
  }

  // ================= Ghi =================

  async create(input: PostCreateInput, staffId: string, ctx: AuditContext): Promise<PostDetail> {
    await this.assertReferences(input);
    const slug = input.slug ?? (await generateUniqueSlug(input.title, (value) => this.slugTaken(value)));
    if (input.slug && (await this.slugTaken(input.slug))) this.slugConflict();

    const contentHtml = sanitizeRichHtml(input.content ?? '');

    let id: string;
    try {
      id = await this.db.$transaction(async (tx) => {
        const created = await tx.post.create({
          data: {
            title: input.title,
            slug,
            excerpt: input.excerpt ?? null,
            contentHtml,
            categoryId: input.categoryId ?? null,
            coverMediaId: input.coverMediaId ?? null,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            authorId: staffId,
          },
          select: { id: true },
        });
        if (input.productIds?.length) await this.replaceProductsInTx(tx, created.id, input.productIds);
        return created.id;
      });
    } catch (error) {
      rethrow(error);
    }

    // Không ghi nội dung bài vào nhật ký (có thể rất dài)
    await this.audit.log({ staffId, action: 'post.create', entityType: 'POST', entityId: id, changes: { after: { title: input.title, slug } }, ctx });
    return this.getById(id);
  }

  async update(id: string, input: PostUpdateInput, staffId: string, ctx: AuditContext): Promise<PostDetail> {
    const current = await this.db.post.findUnique({
      where: { id },
      select: { slug: true, title: true, status: true, publishedAt: true, updatedAt: true, contentHtml: true },
    });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) editConflict();
    await this.assertReferences(input);

    const data: Prisma.PostUncheckedUpdateManyInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.excerpt !== undefined) data.excerpt = input.excerpt;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.coverMediaId !== undefined) data.coverMediaId = input.coverMediaId;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
    // Luôn lọc lại ở máy chủ, kể cả khi trình soạn thảo đã lọc
    const contentHtml = input.content !== undefined ? sanitizeRichHtml(input.content) : undefined;
    if (contentHtml !== undefined) data.contentHtml = contentHtml;

    const slugChanged = input.slug !== undefined && input.slug !== current.slug;
    if (slugChanged) {
      if (await this.slugTaken(input.slug as string, id)) this.slugConflict();
      data.slug = input.slug;
    }

    // Bài đang đăng không được sửa thành trống (bài trên website sẽ trắng trang)
    if (current.status === 'PUBLISHED') {
      const missing = missingForPublish({
        title: input.title ?? current.title,
        contentHtml: contentHtml ?? current.contentHtml,
      });
      if (missing.length > 0) invalid([{ field: 'content', message: `Bài đang đăng không được để trống: ${missing.join(', ')}` }]);
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Khóa lạc quan: chỉ ghi khi chưa ai sửa kể từ lúc tải
        const result = await tx.post.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
        if (result.count === 0) editConflict();
        if (input.productIds !== undefined) await this.replaceProductsInTx(tx, id, input.productIds);
        // Bài đã từng lên website: link cũ chuyển 301 sang link mới
        if (slugChanged && current.publishedAt && current.publishedAt <= new Date()) {
          await this.redirectSlug(tx, current.slug, input.slug as string, staffId);
        }
      });
    } catch (error) {
      rethrow(error);
    }

    // Không ghi nội dung bài vào nhật ký (có thể rất dài), chỉ ghi là có đổi
    const logged = Object.fromEntries(
      Object.entries(input).filter(([key]) => key !== 'content' && key !== 'expectedUpdatedAt'),
    );
    await this.audit.log({
      staffId,
      action: 'post.update',
      entityType: 'POST',
      entityId: id,
      changes: { after: { ...logged, contentChanged: input.content !== undefined } },
      ctx,
    });
    return this.getById(id);
  }

  async changeStatus(id: string, input: PostStatusActionInput, staffId: string, ctx: AuditContext): Promise<PostDetail> {
    const current = await this.db.post.findUnique({
      where: { id },
      select: { title: true, contentHtml: true, status: true, publishedAt: true, updatedAt: true },
    });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) editConflict();

    const now = new Date();
    const wrongStatus = (message: string): never => {
      throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, { hint: message });
    };

    let status: PostStatusValue;
    let publishedAt = current.publishedAt;

    switch (input.action) {
      case 'PUBLISH': {
        if (current.status === 'ARCHIVED') wrongStatus('Bài đang lưu trữ: khôi phục về Nháp trước');
        const missing = missingForPublish(current);
        if (missing.length > 0) invalid([{ field: 'status', message: `Chưa đăng được, còn thiếu: ${missing.join(', ')}` }]);
        status = 'PUBLISHED';
        if (input.publishAt) {
          publishedAt = new Date(input.publishAt);
        } else if (!current.publishedAt || current.publishedAt > now) {
          // Đăng ngay (kể cả bài đang hẹn giờ). Bài từng đăng rồi gỡ thì giữ ngày đăng gốc
          publishedAt = now;
        }
        break;
      }
      case 'UNPUBLISH':
        if (current.status !== 'PUBLISHED') wrongStatus('Bài chưa đăng');
        status = 'DRAFT';
        // Gỡ bài đang hẹn giờ: bài chưa từng lên website, xóa mốc để không bị coi là "đã đăng"
        if (current.publishedAt && current.publishedAt > now) publishedAt = null;
        break;
      case 'ARCHIVE':
        if (current.status === 'ARCHIVED') wrongStatus('Bài đã ở Lưu trữ');
        status = 'ARCHIVED';
        if (current.publishedAt && current.publishedAt > now) publishedAt = null;
        break;
      case 'RESTORE':
        if (current.status !== 'ARCHIVED') wrongStatus('Chỉ khôi phục bài đang lưu trữ');
        status = 'DRAFT';
        break;
    }

    const result = await this.db.post.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data: { status, publishedAt },
    });
    if (result.count === 0) editConflict();

    await this.audit.log({
      staffId,
      action: `post.${input.action.toLowerCase()}`,
      entityType: 'POST',
      entityId: id,
      changes: {
        before: { status: current.status, publishedAt: current.publishedAt },
        after: { status, publishedAt },
      },
      ctx,
    });
    return this.getById(id);
  }

  /** Chỉ xóa bài CHƯA TỪNG lên website. Bài đã đăng có thể đã được Google, Zalo lưu link: lưu trữ thay thế */
  async remove(id: string, staffId: string, ctx: AuditContext): Promise<void> {
    const current = await this.db.post.findUnique({ where: { id }, select: { title: true, slug: true, publishedAt: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.publishedAt && current.publishedAt <= new Date()) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        hint: 'Bài đã từng đăng lên website nên không xóa được. Chuyển vào Lưu trữ thay thế.',
      });
    }
    // post_products tự xóa theo (Cascade)
    await this.db.post.delete({ where: { id } });
    await this.audit.log({ staffId, action: 'post.delete', entityType: 'POST', entityId: id, changes: { before: { title: current.title, slug: current.slug } }, ctx });
  }

  // ================= Nội bộ =================

  private async assertReferences(input: { categoryId?: string | null; coverMediaId?: string | null; productIds?: string[] }) {
    const errors: FieldError[] = [];
    if (input.categoryId) {
      const found = await this.db.postCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } });
      if (!found) errors.push({ field: 'categoryId', message: 'Chuyên mục không tồn tại' });
    }
    if (input.coverMediaId) {
      const found = await this.db.mediaAsset.findUnique({ where: { id: input.coverMediaId }, select: { id: true } });
      if (!found) errors.push({ field: 'coverMediaId', message: 'Ảnh bìa không còn trong Thư viện ảnh' });
    }
    if (input.productIds?.length) {
      const count = await this.db.product.count({ where: { id: { in: input.productIds } } });
      if (count !== input.productIds.length) errors.push({ field: 'productIds', message: 'Có sản phẩm không tồn tại' });
    }
    if (errors.length > 0) invalid(errors);
  }

  private async replaceProductsInTx(tx: Tx, postId: string, productIds: string[]) {
    await tx.postProduct.deleteMany({ where: { postId } });
    if (productIds.length > 0) {
      await tx.postProduct.createMany({
        data: productIds.map((productId, index) => ({ postId, productId, sortOrder: index })),
      });
    }
  }

  private async slugTaken(slug: string, exceptId?: string) {
    const found = await this.db.post.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  }

  private slugConflict(): never {
    invalid([{ field: 'slug', message: 'Đường dẫn này đã có bài khác dùng' }]);
  }

  /** Cùng quy tắc với sản phẩm và showroom: không tạo chuỗi A→B→C, không vòng lặp */
  private async redirectSlug(tx: Tx, oldSlug: string, newSlug: string, staffId: string) {
    const fromPath = postPath(oldSlug);
    const toPath = postPath(newSlug);
    await tx.urlRedirect.deleteMany({ where: { fromPath: toPath } });
    await tx.urlRedirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
    await tx.urlRedirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 301, createdById: staffId },
      update: { toPath },
    });
  }

  private toListItem(row: ListRow, now = new Date()): PostListItem {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      scheduled: row.status === 'PUBLISHED' && Boolean(row.publishedAt && row.publishedAt > now),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      category: row.category,
      coverUrl: row.coverMedia?.url ?? null,
      author: row.author,
    };
  }

  private toDetail(row: DetailRow): PostDetail {
    const text = htmlPlainText(row.contentHtml);
    return {
      ...this.toListItem(row),
      excerpt: row.excerpt,
      content: row.contentHtml,
      categoryId: row.categoryId,
      coverMediaId: row.coverMediaId,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      products: row.products.map(({ product }) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        status: product.status,
        coverUrl: product.media[0]?.url ?? null,
      })),
      missing: missingForPublish({ title: row.title, contentHtml: row.contentHtml }),
      wordCount: text ? text.split(' ').length : 0,
    };
  }
}