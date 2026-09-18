import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@ktm/database';
import { ErrorCode, type ProductMediaAttachInput } from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PRISMA } from '../database/database.module';

const MAX_MEDIA_PER_PRODUCT = 20;

@Injectable()
export class ProductMediaService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  list(productId: string) {
    return this.db.productMedia.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      include: { variant: { select: { id: true, sku: true, name: true } } },
    });
  }

  async attach(productId: string, input: ProductMediaAttachInput, staffId: string, ctx: AuditContext) {
    const [product, asset, count] = await Promise.all([
      this.db.product.findUnique({ where: { id: productId }, select: { id: true } }),
      this.db.mediaAsset.findUnique({ where: { id: input.mediaAssetId } }),
      this.db.productMedia.count({ where: { productId } }),
    ]);

    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!asset) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'mediaAssetId',
        message: 'Ảnh không tồn tại trong thư viện',
      });
    }
    if (count >= MAX_MEDIA_PER_PRODUCT) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        message: `Mỗi sản phẩm tối đa ${MAX_MEDIA_PER_PRODUCT} ảnh`,
      });
    }

    // Biến thể phải thuộc chính sản phẩm này
    if (input.variantId) {
      const variant = await this.db.productVariant.findUnique({
        where: { id: input.variantId },
        select: { productId: true },
      });
      if (!variant || variant.productId !== productId) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
          field: 'variantId',
          message: 'Biến thể không thuộc sản phẩm này',
        });
      }
    }

    // Cùng một ảnh không gắn hai lần cho cùng sản phẩm và biến thể
    const duplicate = await this.db.productMedia.findFirst({
      where: { productId, url: asset.url, variantId: input.variantId ?? null },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppException(ErrorCode.ALREADY_EXISTS, HttpStatus.CONFLICT, {
        message: 'Ảnh này đã được gắn',
      });
    }

    const media = await this.db.productMedia.create({
      data: {
        productId,
        variantId: input.variantId ?? null,
        type: 'IMAGE',
        url: asset.url,
        altText: input.altText ?? asset.altText,
        sortOrder: count,
      },
    });

    await this.audit.log({
      staffId,
      action: 'product_media.attach',
      entityType: 'PRODUCT',
      entityId: productId,
      changes: { after: { mediaId: media.id, url: asset.url, variantId: input.variantId ?? null } },
      ctx,
    });
    return media;
  }

  async reorder(productId: string, mediaIds: string[], staffId: string, ctx: AuditContext) {
    const existing = await this.db.productMedia.findMany({
      where: { productId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((item) => item.id));

    if (mediaIds.length !== existing.length || mediaIds.some((id) => !existingIds.has(id))) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'mediaIds',
        message: 'Danh sách phải gồm đúng và đủ các ảnh hiện có của sản phẩm',
      });
    }

    await this.db.$transaction(
      mediaIds.map((id, index) =>
        this.db.productMedia.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    await this.audit.log({
      staffId,
      action: 'product_media.reorder',
      entityType: 'PRODUCT',
      entityId: productId,
      ctx,
    });
    return this.list(productId);
  }

  async detach(mediaId: string, staffId: string, ctx: AuditContext) {
    const media = await this.db.productMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    await this.db.productMedia.delete({ where: { id: mediaId } });

    // Gỡ khỏi sản phẩm KHÔNG xóa file gốc, vì ảnh có thể đang dùng ở nơi khác
    await this.audit.log({
      staffId,
      action: 'product_media.detach',
      entityType: 'PRODUCT',
      entityId: media.productId,
      changes: { before: { mediaId, url: media.url } },
      ctx,
    });
  }
}
