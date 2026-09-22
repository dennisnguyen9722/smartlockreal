import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  bannerState,
  type BannerCreateInput,
  type BannerItem,
  type BannerPlacementValue,
  type BannerReorderInput,
  type BannerUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';

type FieldError = { field: string; message: string };

function invalid(details: FieldError[]): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, details);
}

function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
}

const MEDIA_SELECT = { id: true, url: true, width: true, height: true } satisfies Prisma.MediaAssetSelect;

const BANNER_SELECT = {
  id: true,
  title: true,
  placement: true,
  linkUrl: true,
  altText: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  sortOrder: true,
  updatedAt: true,
  desktopMedia: { select: MEDIA_SELECT },
  mobileMedia: { select: MEDIA_SELECT },
  category: { select: { id: true, name: true } },
} satisfies Prisma.BannerSelect;

type BannerRow = Prisma.BannerGetPayload<{ select: typeof BANNER_SELECT }>;

@Injectable()
export class BannerService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  /** Tất cả banner, theo vị trí rồi thứ tự (giao diện chia tab theo vị trí) */
  async list(): Promise<BannerItem[]> {
    const rows = await this.db.banner.findMany({
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: BANNER_SELECT,
    });
    const now = new Date();
    return rows.map((row) => this.toItem(row, now));
  }

  async create(input: BannerCreateInput, staffId: string, ctx: AuditContext): Promise<BannerItem> {
    await this.assertReferences(input);
    // Banner mới xếp cuối vị trí của nó
    const last = await this.db.banner.aggregate({ where: { placement: input.placement }, _max: { sortOrder: true } });

    let row: BannerRow;
    try {
      row = await this.db.banner.create({
        data: {
          title: input.title,
          placement: input.placement,
          desktopMediaId: input.desktopMediaId,
          mobileMediaId: input.mobileMediaId ?? null,
          linkUrl: input.linkUrl ?? null,
          altText: input.altText ?? null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive ?? true,
          categoryId: input.placement === 'CATEGORY_TOP' ? (input.categoryId ?? null) : null,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
        select: BANNER_SELECT,
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({ staffId, action: 'banner.create', entityType: 'BANNER', entityId: row.id, changes: { after: input }, ctx });
    return this.toItem(row);
  }

  async update(id: string, input: BannerUpdateInput, staffId: string, ctx: AuditContext): Promise<BannerItem> {
    const current = await this.db.banner.findUnique({
      where: { id },
      select: { placement: true, categoryId: true, startsAt: true, endsAt: true, updatedAt: true, title: true, isActive: true, linkUrl: true },
    });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
      throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    }
    await this.assertReferences(input);

    const placement = input.placement ?? current.placement;
    const startsAt = input.startsAt !== undefined ? input.startsAt : current.startsAt?.toISOString() ?? null;
    const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt?.toISOString() ?? null;
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      invalid([{ field: 'endsAt', message: 'Ngày kết thúc phải sau ngày bắt đầu' }]);
    }

    const data: Prisma.BannerUncheckedUpdateManyInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.desktopMediaId !== undefined) data.desktopMediaId = input.desktopMediaId;
    if (input.mobileMediaId !== undefined) data.mobileMediaId = input.mobileMediaId;
    if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl;
    if (input.altText !== undefined) data.altText = input.altText;
    if (input.startsAt !== undefined) data.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (input.endsAt !== undefined) data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;

    if (placement !== current.placement) {
      data.placement = placement;
      // Chuyển vị trí: xếp cuối vị trí mới
      const last = await this.db.banner.aggregate({ where: { placement }, _max: { sortOrder: true } });
      data.sortOrder = (last._max.sortOrder ?? -1) + 1;
    }
    // Không còn là banner danh mục thì bỏ danh mục (database cũng bắt buộc)
    if (placement !== 'CATEGORY_TOP') data.categoryId = null;

    try {
      // Khóa lạc quan: chỉ ghi khi chưa ai sửa kể từ lúc tải
      const result = await this.db.banner.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
      if (result.count === 0) throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    } catch (error) {
      rethrow(error);
    }

    const changes = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'expectedUpdatedAt'));
    await this.audit.log({
      staffId,
      action: 'banner.update',
      entityType: 'BANNER',
      entityId: id,
      changes: { before: current, after: changes },
      ctx,
    });
    const row = await this.db.banner.findUniqueOrThrow({ where: { id }, select: BANNER_SELECT });
    return this.toItem(row);
  }

  /** Sắp xếp lại một vị trí. Danh sách gửi lên phải đủ đúng các banner của vị trí đó */
  async reorder(input: BannerReorderInput, staffId: string, ctx: AuditContext): Promise<BannerItem[]> {
    const rows = await this.db.banner.findMany({ where: { placement: input.placement }, select: { id: true } });
    const existing = new Set(rows.map((row) => row.id));
    const sameSet = input.ids.length === existing.size && input.ids.every((id) => existing.has(id));
    if (!sameSet) {
      // Có người vừa thêm/xóa/chuyển banner ở vị trí này
      throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    }

    await this.db.$transaction(
      input.ids.map((id, index) => this.db.banner.update({ where: { id }, data: { sortOrder: index } })),
    );
    await this.audit.log({ staffId, action: 'banner.reorder', entityType: 'BANNER', changes: { after: input }, ctx });
    return this.list();
  }

  /** Banner không gắn với dữ liệu nào khác nên xóa được; ảnh vẫn còn trong Thư viện ảnh */
  async remove(id: string, staffId: string, ctx: AuditContext): Promise<void> {
    const current = await this.db.banner.findUnique({ where: { id }, select: { title: true, placement: true } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    await this.db.banner.delete({ where: { id } });
    await this.audit.log({ staffId, action: 'banner.delete', entityType: 'BANNER', entityId: id, changes: { before: current }, ctx });
  }

  // ================= Nội bộ =================

  private async assertReferences(input: { desktopMediaId?: string; mobileMediaId?: string | null; categoryId?: string | null }) {
    const errors: FieldError[] = [];
    const mediaIds = [input.desktopMediaId, input.mobileMediaId].filter((id): id is string => Boolean(id));
    if (mediaIds.length > 0) {
      const found = await this.db.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true } });
      const ids = new Set(found.map((item) => item.id));
      if (input.desktopMediaId && !ids.has(input.desktopMediaId)) errors.push({ field: 'desktopMediaId', message: 'Ảnh không còn trong Thư viện ảnh' });
      if (input.mobileMediaId && !ids.has(input.mobileMediaId)) errors.push({ field: 'mobileMediaId', message: 'Ảnh không còn trong Thư viện ảnh' });
    }
    if (input.categoryId) {
      const category = await this.db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
      if (!category) errors.push({ field: 'categoryId', message: 'Danh mục không tồn tại' });
    }
    if (errors.length > 0) invalid(errors);
  }

  private toItem(row: BannerRow, now = new Date()): BannerItem {
    return {
      id: row.id,
      title: row.title,
      placement: row.placement as BannerPlacementValue,
      desktop: row.desktopMedia,
      mobile: row.mobileMedia,
      linkUrl: row.linkUrl,
      altText: row.altText,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      isActive: row.isActive,
      state: bannerState(row, now),
      sortOrder: row.sortOrder,
      category: row.category,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}