import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  htmlPlainText,
  type FaqCreateInput,
  type FaqGroupCode,
  type FaqItem,
  type FaqListQuery,
  type FaqReorderInput,
  type FaqUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { sanitizeRichHtml } from '../common/rich-text';
import { PRISMA } from '../database/database.module';

function invalid(field: string, message: string): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [{ field, message }]);
}

function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
}

const FAQ_SELECT = {
  id: true,
  groupCode: true,
  question: true,
  answerHtml: true,
  sortOrder: true,
  isPublished: true,
  updatedAt: true,
  product: { select: { id: true, name: true } },
} satisfies Prisma.FaqSelect;

type FaqRow = Prisma.FaqGetPayload<{ select: typeof FAQ_SELECT }>;

/** Phạm vi sắp xếp: câu hỏi chung theo nhóm, câu hỏi sản phẩm theo từng sản phẩm */
function scopeWhere(scope: { groupCode?: string; productId?: string | null }): Prisma.FaqWhereInput {
  return scope.productId ? { productId: scope.productId } : { productId: null, groupCode: scope.groupCode };
}

/**
 * Câu hỏi thường gặp. Câu chung hiện ở trang FAQ; câu gắn sản phẩm hiện ở trang sản phẩm.
 * Storefront dựng dữ liệu schema.org FAQPage từ đây (Bước 9).
 */
@Injectable()
export class FaqService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(query: FaqListQuery): Promise<FaqItem[]> {
    const where: Prisma.FaqWhereInput = {
      ...(query.groupCode ? { groupCode: query.groupCode } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.scope === 'GENERAL' ? { productId: null } : query.scope === 'PRODUCT' ? { productId: { not: null } } : {}),
      ...(query.search ? { question: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const rows = await this.db.faq.findMany({
      where,
      orderBy: [{ productId: { sort: 'asc', nulls: 'first' } }, { groupCode: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: FAQ_SELECT,
    });
    return rows.map((row) => this.toItem(row));
  }

  async create(input: FaqCreateInput, staffId: string, ctx: AuditContext): Promise<FaqItem> {
    const answerHtml = this.cleanAnswer(input.answer);
    await this.assertProduct(input.productId);
    const scope = { groupCode: input.groupCode, productId: input.productId ?? null };
    // Câu hỏi mới xếp cuối phạm vi của nó
    const last = await this.db.faq.aggregate({ where: scopeWhere(scope), _max: { sortOrder: true } });

    let row: FaqRow;
    try {
      row = await this.db.faq.create({
        data: {
          groupCode: input.groupCode,
          question: input.question,
          answerHtml,
          productId: input.productId ?? null,
          isPublished: input.isPublished ?? true,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
        select: FAQ_SELECT,
      });
    } catch (error) {
      rethrow(error);
    }
    await this.audit.log({ staffId, action: 'faq.create', entityType: 'FAQ', entityId: row.id, changes: { after: { question: input.question, groupCode: input.groupCode } }, ctx });
    return this.toItem(row);
  }

  async update(id: string, input: FaqUpdateInput, staffId: string, ctx: AuditContext): Promise<FaqItem> {
    const current = await this.db.faq.findUnique({ where: { id }, select: { groupCode: true, productId: true, question: true, isPublished: true, updatedAt: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
      throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    }
    if (input.productId) await this.assertProduct(input.productId);

    const data: Prisma.FaqUncheckedUpdateManyInput = {};
    if (input.question !== undefined) data.question = input.question;
    if (input.answer !== undefined) data.answerHtml = this.cleanAnswer(input.answer);
    if (input.isPublished !== undefined) data.isPublished = input.isPublished;
    if (input.groupCode !== undefined) data.groupCode = input.groupCode;
    if (input.productId !== undefined) data.productId = input.productId;

    // Đổi nhóm/sản phẩm: xếp cuối phạm vi mới
    const nextScope = { groupCode: input.groupCode ?? current.groupCode, productId: input.productId !== undefined ? input.productId : current.productId };
    const scopeChanged = nextScope.groupCode !== current.groupCode || nextScope.productId !== current.productId;
    if (scopeChanged) {
      const last = await this.db.faq.aggregate({ where: scopeWhere(nextScope), _max: { sortOrder: true } });
      data.sortOrder = (last._max.sortOrder ?? -1) + 1;
    }

    try {
      const result = await this.db.faq.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
      if (result.count === 0) throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    } catch (error) {
      rethrow(error);
    }

    const logged = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'answer' && key !== 'expectedUpdatedAt'));
    await this.audit.log({
      staffId,
      action: 'faq.update',
      entityType: 'FAQ',
      entityId: id,
      changes: { before: current, after: { ...logged, answerChanged: input.answer !== undefined } },
      ctx,
    });
    const row = await this.db.faq.findUniqueOrThrow({ where: { id }, select: FAQ_SELECT });
    return this.toItem(row);
  }

  /** Danh sách gửi lên phải đủ đúng các câu hỏi của phạm vi đó */
  async reorder(input: FaqReorderInput, staffId: string, ctx: AuditContext): Promise<FaqItem[]> {
    const where = scopeWhere({ groupCode: input.groupCode, productId: input.productId });
    const rows = await this.db.faq.findMany({ where, select: { id: true } });
    const existing = new Set(rows.map((row) => row.id));
    if (input.ids.length !== existing.size || !input.ids.every((id) => existing.has(id))) {
      throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    }
    await this.db.$transaction(input.ids.map((id, index) => this.db.faq.update({ where: { id }, data: { sortOrder: index } })));
    await this.audit.log({ staffId, action: 'faq.reorder', entityType: 'FAQ', changes: { after: input }, ctx });
    return this.list({ scope: 'ALL', ...(input.productId ? { productId: input.productId } : { groupCode: input.groupCode }) });
  }

  async remove(id: string, staffId: string, ctx: AuditContext): Promise<void> {
    const current = await this.db.faq.findUnique({ where: { id }, select: { question: true, groupCode: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    await this.db.faq.delete({ where: { id } });
    await this.audit.log({ staffId, action: 'faq.delete', entityType: 'FAQ', entityId: id, changes: { before: current }, ctx });
  }

  // ================= Nội bộ =================

  private cleanAnswer(answer: string): string {
    const html = sanitizeRichHtml(answer);
    if (!htmlPlainText(html)) invalid('answer', 'Chưa nhập câu trả lời');
    return html;
  }

  private async assertProduct(productId: string | null | undefined) {
    if (!productId) return;
    const found = await this.db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!found) invalid('productId', 'Sản phẩm không tồn tại');
  }

  private toItem(row: FaqRow): FaqItem {
    return {
      id: row.id,
      groupCode: row.groupCode as FaqGroupCode,
      question: row.question,
      answer: row.answerHtml,
      product: row.product,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}