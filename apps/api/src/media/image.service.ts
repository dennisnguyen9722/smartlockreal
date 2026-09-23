import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { PrismaClient } from '@ktm/database';
import { ErrorCode, SETTING_DEFINITIONS } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { PRISMA } from '../database/database.module';
import { StorageService } from './storage.service';

/** Ba kích thước: danh sách, trang sản phẩm, xem chi tiết */
const SIZES = [
  { suffix: '_sm', width: 400 },
  { suffix: '_md', width: 900 },
  { suffix: '', width: 1600 },
] as const;

const MAX_DIMENSION = 6000;

/** Các khóa cấu hình lưu đường dẫn ảnh (logo, ảnh chia sẻ...) */
const IMAGE_SETTING_KEYS = SETTING_DEFINITIONS.filter((definition) => definition.input === 'image').map(
  (definition) => definition.key,
);

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly storage: StorageService,
  ) {}

  /**
   * Kiểm tra byte đầu file. Không tin vào đuôi file hay content-type do
   * trình duyệt gửi lên, vì cả hai đều có thể bị làm giả.
   */
  private assertIsImage(buffer: Buffer): void {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp =
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP',
      });
    }
  }

  async upload(buffer: Buffer, altText: string | undefined, staffId: string) {
    this.assertIsImage(buffer);

    // Ảnh giống hệt nhau thì dùng lại, không lưu hai lần
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.db.mediaAsset.findFirst({ where: { checksumSha256: checksum } });
    if (existing) return existing;

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'Không đọc được nội dung ảnh',
      });
    }

    if (!metadata.width || !metadata.height) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'Ảnh không hợp lệ',
      });
    }
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: `Ảnh tối đa ${MAX_DIMENSION}x${MAX_DIMENSION} điểm ảnh`,
      });
    }

    const now = new Date();
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const baseKey = `${folder}/${checksum}`;

    let mainSize = 0;
    let mainWidth = metadata.width;
    let mainHeight = metadata.height;
    const writtenKeys: string[] = [];

    try {
      for (const size of SIZES) {
        const output = await sharp(buffer)
          // Xoay theo hướng chụp thật, rồi bỏ toàn bộ dữ liệu ẩn (GPS, máy ảnh)
          .rotate()
          .resize({ width: size.width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });

        const key = `${baseKey}${size.suffix}.webp`;
        await this.storage.save(key, output.data);
        writtenKeys.push(key);

        if (size.suffix === '') {
          mainSize = output.data.length;
          mainWidth = output.info.width;
          mainHeight = output.info.height;
        }
      }

      return await this.db.mediaAsset.create({
        data: {
          storageKey: `${baseKey}.webp`,
          url: this.storage.urlFor(`${baseKey}.webp`),
          mimeType: 'image/webp',
          sizeBytes: mainSize,
          width: mainWidth,
          height: mainHeight,
          altText,
          checksumSha256: checksum,
          uploadedById: staffId,
        },
      });
    } catch (error) {
      // Ghi file xong mà lưu database lỗi thì dọn file, tránh rác trên ổ đĩa
      await Promise.all(writtenKeys.map((key) => this.storage.remove(key)));
      this.logger.error(`Lỗi khi lưu ảnh: ${(error as Error).message}`);
      throw error;
    }
  }

  async remove(id: string) {
    const asset = await this.db.mediaAsset.findUnique({
      where: { id },
      include: { _count: { select: { postCovers: true, bannerDesktop: true, bannerMobile: true } } },
    });
    if (!asset) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    // Ảnh sản phẩm, ảnh showroom và ảnh ở trang Cấu hình lưu theo url (không có khóa ngoại tới media_assets),
    // nên phải đếm riêng
    const [productUsage, settingUsage, showroomUsage, postContentUsage, brandUsage] = await Promise.all([
      this.db.productMedia.count({ where: { url: asset.url } }),
      this.db.systemSetting.count({ where: { key: { in: IMAGE_SETTING_KEYS }, value: { equals: asset.url } } }),
      this.db.location.count({ where: { imageUrls: { has: asset.url } } }),
      // Ảnh chèn trong nội dung bài viết (ảnh bìa đã có khóa ngoại, đếm ở postCovers)
      this.db.post.count({ where: { contentHtml: { contains: asset.url } } }),
      // Logo hãng cũng lưu theo url
      this.db.brand.count({ where: { logoUrl: asset.url } }),
    ]);
    const used =
      asset._count.postCovers +
      asset._count.bannerDesktop +
      asset._count.bannerMobile +
      productUsage +
      settingUsage +
      showroomUsage +
      postContentUsage +
      brandUsage;
    if (used > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        references: used,
        products: productUsage,
        hint:
          productUsage > 0
            ? `Ảnh đang dùng cho ${productUsage} sản phẩm/biến thể. Gỡ khỏi sản phẩm trước khi xóa.`
            : settingUsage > 0
              ? 'Ảnh đang dùng làm logo hoặc ảnh chia sẻ ở trang Cấu hình. Đổi ảnh khác ở đó trước khi xóa.'
              : brandUsage > 0
              ? `Ảnh đang làm logo của ${brandUsage} hãng. Đổi logo khác trước khi xóa.`
              : showroomUsage > 0
                ? `Ảnh đang dùng cho ${showroomUsage} showroom. Gỡ khỏi showroom trước khi xóa.`
                : postContentUsage > 0 || asset._count.postCovers > 0
                  ? 'Ảnh đang dùng trong bài viết (ảnh bìa hoặc chèn trong bài). Gỡ khỏi bài trước khi xóa.'
                  : 'Ảnh đang dùng cho banner.',
      });
    }

    // Xóa bản ghi trước, file sau: nếu xóa file lỗi thì chỉ còn file rác, không có bản ghi trỏ tới file đã mất
    await this.db.mediaAsset.delete({ where: { id } });
    const base = asset.storageKey.replace(/\.webp$/, '');
    const results = await Promise.allSettled([
      this.storage.remove(asset.storageKey),
      this.storage.remove(`${base}_md.webp`),
      this.storage.remove(`${base}_sm.webp`),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      this.logger.warn(`Đã xóa ảnh ${id} nhưng còn sót file trên ổ đĩa: ${base}*`);
    }
  }

  list(page: number, pageSize: number) {
    return this.db.$transaction([
      this.db.mediaAsset.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.mediaAsset.count(),
    ]);
  }
}
