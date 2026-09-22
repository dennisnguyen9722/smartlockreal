import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  type Paginated,
  type ReviewItem,
  type ReviewListQuery,
  type ReviewRejectInput,
  type ReviewReplyInput,
  type ReviewStatusCounts,
  type ReviewStatusValue,
  type ReviewSubmitInput,
  type ReviewSubmitResult,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';
import { ReviewPhotoService, type StoredReviewPhoto } from './review-photo.service';

function invalid(field: string, message: string): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [{ field, message }]);
}

function editConflict(): never {
  throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
}

const REVIEW_SELECT = {
  id: true,
  reviewerName: true,
  reviewerPhone: true,
  rating: true,
  content: true,
  photos: true,
  status: true,
  verifiedPurchase: true,
  rejectReason: true,
  replyContent: true,
  repliedAt: true,
  moderatedAt: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, name: true, slug: true } },
  customer: { select: { id: true, fullName: true } },
  moderatedBy: { select: { id: true, fullName: true } },
  orderLine: { select: { order: { select: { id: true, code: true } } } },
} satisfies Prisma.ProductReviewSelect;

type ReviewRow = Prisma.ProductReviewGetPayload<{ select: typeof REVIEW_SELECT }>;

@Injectable()
export class ReviewService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly photos: ReviewPhotoService,
  ) {}

  // ================= Khách gửi (công khai) =================

  async submit(input: ReviewSubmitInput, files: { buffer: Buffer; size: number }[]): Promise<ReviewSubmitResult> {
    const product = await this.db.product.findUnique({ where: { id: input.productId }, select: { status: true } });
    if (!product || product.status !== 'ACTIVE') invalid('productId', 'Sản phẩm không tồn tại hoặc đã ngừng bán');

    // Xử lý ảnh trước (chậm), ngoài transaction; lỗi lưu database thì dọn ảnh
    const stored = await this.photos.saveAll(files);

    try {
      return await this.db.$transaction(async (tx) => {
        // Hai lần bấm gửi cùng lúc với cùng số điện thoại: lần sau phải chờ rồi bị chặn trùng
        await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`review:${input.productId}:${input.phone}`}))`;

        const existing = await tx.productReview.findFirst({
          where: { productId: input.productId, reviewerPhone: input.phone, status: { not: 'REJECTED' } },
          select: { status: true },
        });
        if (existing) {
          throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, [
            {
              field: 'phone',
              message:
                existing.status === 'PENDING'
                  ? 'Bạn đã gửi đánh giá cho sản phẩm này, đánh giá đang chờ duyệt'
                  : 'Số điện thoại này đã đánh giá sản phẩm này rồi',
            },
          ]);
        }

        // "Đã mua hàng": đơn Hoàn tất có sản phẩm này, số điện thoại khớp người đặt/người nhận/khách hàng,
        // và dòng đơn đó chưa được dùng cho đánh giá khác
        const line = await tx.orderLine.findFirst({
          where: {
            lineType: { in: ['PRODUCT', 'BUNDLE'] },
            variant: { productId: input.productId },
            review: null,
            order: {
              status: 'COMPLETED',
              OR: [{ customerPhone: input.phone }, { shipRecipientPhone: input.phone }, { customer: { phone: input.phone } }],
            },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, order: { select: { customerId: true } } },
        });
        const customer = line?.order.customerId
          ? { id: line.order.customerId }
          : await tx.customer.findFirst({ where: { phone: input.phone }, select: { id: true } });

        const created = await tx.productReview.create({
          data: {
            productId: input.productId,
            orderLineId: line?.id ?? null,
            verifiedPurchase: Boolean(line),
            customerId: customer?.id ?? null,
            reviewerName: input.reviewerName,
            reviewerPhone: input.phone,
            rating: input.rating,
            content: input.content,
            photos: stored as unknown as Prisma.InputJsonValue,
          },
          select: { id: true, verifiedPurchase: true },
        });
        return { id: created.id, status: 'PENDING' as const, verifiedPurchase: created.verifiedPurchase };
      });
    } catch (error) {
      await this.photos.removeAll(stored);
      if (error instanceof AppException) throw error;
      mapPrismaError(error);
    }
  }

  // ================= Duyệt (nhân viên) =================

  async list(query: ReviewListQuery): Promise<Paginated<ReviewItem> & { statusCounts: ReviewStatusCounts }> {
    const baseWhere: Prisma.ProductReviewWhereInput = {
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.verified ? { verifiedPurchase: query.verified === 'true' } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.search
        ? {
            OR: [
              { reviewerName: { contains: query.search, mode: 'insensitive' } },
              { reviewerPhone: { contains: query.search.replace(/\D/g, '').replace(/^0/, '') || query.search } },
              { content: { contains: query.search, mode: 'insensitive' } },
              { product: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const where = { ...baseWhere, status: query.status };

    const [rows, total] = await this.db.$transaction([
      this.db.productReview.findMany({
        where,
        // Chờ duyệt: cũ nhất trước (xử lý theo thứ tự đến); đã xử lý: mới nhất trước
        orderBy: { createdAt: query.status === 'PENDING' ? 'asc' : 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: REVIEW_SELECT,
      }),
      this.db.productReview.count({ where }),
    ]);
    const grouped = await this.db.productReview.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } });
    const statusCounts: ReviewStatusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of grouped) statusCounts[row.status as ReviewStatusValue] = row._count._all;

    return { items: rows.map((row) => this.toItem(row)), total, page: query.page, pageSize: query.pageSize, statusCounts };
  }

  /** Duyệt: hiện lên website. Điểm trung bình của sản phẩm do trigger database tự tính lại */
  async approve(id: string, expectedUpdatedAt: string, staffId: string, ctx: AuditContext): Promise<ReviewItem> {
    const current = await this.load(id, expectedUpdatedAt);
    if (current.status === 'APPROVED') throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, { hint: 'Đánh giá đã được duyệt' });
    await this.write(id, current.updatedAt, { status: 'APPROVED', moderatedById: staffId, moderatedAt: new Date(), rejectReason: null });
    await this.audit.log({ staffId, action: 'review.approve', entityType: 'REVIEW', entityId: id, changes: { before: { status: current.status } }, ctx });
    return this.getById(id);
  }

  /** Từ chối (kể cả đánh giá đã duyệt, vd phát hiện sau là đánh giá ảo). Ảnh bị xóa luôn */
  async reject(id: string, input: ReviewRejectInput, staffId: string, ctx: AuditContext): Promise<ReviewItem> {
    const current = await this.load(id, input.expectedUpdatedAt);
    if (current.status === 'REJECTED') throw new AppException(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT, { hint: 'Đánh giá đã bị từ chối' });

    await this.write(id, current.updatedAt, {
      status: 'REJECTED',
      moderatedById: staffId,
      moderatedAt: new Date(),
      rejectReason: input.reason,
      photos: [],
    });
    // Xóa file SAU khi ghi database thành công: lỡ lỗi thì chỉ còn file thừa, không mất dữ liệu
    await this.photos.removeAll(Array.isArray(current.photos) ? (current.photos as unknown as StoredReviewPhoto[]) : []);
    await this.audit.log({
      staffId,
      action: 'review.reject',
      entityType: 'REVIEW',
      entityId: id,
      changes: { before: { status: current.status }, after: { reason: input.reason } },
      ctx,
    });
    return this.getById(id);
  }

  async reply(id: string, input: ReviewReplyInput, staffId: string, ctx: AuditContext): Promise<ReviewItem> {
    const current = await this.load(id, input.expectedUpdatedAt);
    await this.write(id, current.updatedAt, { replyContent: input.content, repliedAt: input.content ? new Date() : null });
    await this.audit.log({ staffId, action: 'review.reply', entityType: 'REVIEW', entityId: id, changes: { after: { reply: input.content } }, ctx });
    return this.getById(id);
  }

  // ================= Nội bộ =================

  private async getById(id: string): Promise<ReviewItem> {
    const row = await this.db.productReview.findUniqueOrThrow({ where: { id }, select: REVIEW_SELECT });
    return this.toItem(row);
  }

  private async load(id: string, expectedUpdatedAt: string) {
    const current = await this.db.productReview.findUnique({ where: { id }, select: { status: true, photos: true, updatedAt: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) editConflict();
    return current;
  }

  /** Khóa lạc quan: chỉ ghi khi chưa ai xử lý kể từ lúc tải */
  private async write(id: string, updatedAt: Date, data: Prisma.ProductReviewUncheckedUpdateManyInput) {
    try {
      const result = await this.db.productReview.updateMany({ where: { id, updatedAt }, data });
      if (result.count === 0) editConflict();
    } catch (error) {
      if (error instanceof AppException) throw error;
      mapPrismaError(error);
    }
  }

  private toItem(row: ReviewRow): ReviewItem {
    return {
      id: row.id,
      product: row.product,
      reviewerName: row.reviewerName,
      reviewerPhone: row.reviewerPhone,
      rating: row.rating,
      content: row.content,
      photos: ReviewPhotoService.toPublic(row.photos),
      status: row.status as ReviewStatusValue,
      verifiedPurchase: row.verifiedPurchase,
      order: row.orderLine?.order ?? null,
      customer: row.customer,
      rejectReason: row.rejectReason,
      reply: row.replyContent,
      repliedAt: row.repliedAt?.toISOString() ?? null,
      moderatedBy: row.moderatedBy,
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}