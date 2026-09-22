import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { ErrorCode, REVIEW_MAX_PHOTOS, REVIEW_MAX_PHOTO_MB, type ReviewPhoto } from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { StorageService } from '../media/storage.service';

/** Ảnh lưu trong cột photos: kèm storage key để xóa file khi từ chối (không trả ra ngoài) */
export interface StoredReviewPhoto extends ReviewPhoto {
  key: string;
  thumbKey: string;
}

const MAX_DIMENSION = 8000;

function invalid(message: string): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [{ field: 'photos', message }]);
}

/**
 * Ảnh khách gửi kèm đánh giá. Lưu RIÊNG thư mục reviews/ và KHÔNG tạo media_assets,
 * để ảnh của người lạ không lẫn vào Thư viện ảnh của nhân viên.
 * Mỗi ảnh: bản lớn 1600px và bản nhỏ 400px, WebP, bỏ toàn bộ dữ liệu ẩn (GPS, máy ảnh).
 */
@Injectable()
export class ReviewPhotoService {
  private readonly logger = new Logger(ReviewPhotoService.name);

  constructor(private readonly storage: StorageService) {}

  async saveAll(files: { buffer: Buffer; size: number }[]): Promise<StoredReviewPhoto[]> {
    if (files.length > REVIEW_MAX_PHOTOS) invalid(`Tối đa ${REVIEW_MAX_PHOTOS} ảnh`);
    for (const file of files) {
      if (file.size > REVIEW_MAX_PHOTO_MB * 1024 * 1024) invalid(`Mỗi ảnh tối đa ${REVIEW_MAX_PHOTO_MB} MB`);
      this.assertImage(file.buffer);
    }

    const saved: StoredReviewPhoto[] = [];
    try {
      for (const file of files) saved.push(await this.saveOne(file.buffer));
      return saved;
    } catch (error) {
      // Một ảnh lỗi thì dọn các ảnh đã ghi, không để rác trên ổ đĩa
      await this.removeAll(saved);
      if (error instanceof AppException) throw error;
      this.logger.warn(`Lỗi xử lý ảnh đánh giá: ${(error as Error).message}`);
      invalid('Không đọc được ảnh, hãy chọn ảnh khác');
    }
  }

  async removeAll(photos: { key?: string; thumbKey?: string }[]): Promise<void> {
    const keys = photos.flatMap((photo) => [photo.key, photo.thumbKey]).filter((key): key is string => Boolean(key));
    await Promise.all(
      keys.map((key) =>
        this.storage.remove(key).catch((error: Error) => this.logger.warn(`Không xóa được ${key}: ${error.message}`)),
      ),
    );
  }

  /** Bỏ storage key trước khi trả ra ngoài */
  static toPublic(value: unknown): ReviewPhoto[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is StoredReviewPhoto => typeof item === 'object' && item !== null && typeof (item as ReviewPhoto).url === 'string')
      .map(({ url, thumbUrl, width, height }) => ({ url, thumbUrl, width, height }));
  }

  private async saveOne(buffer: Buffer): Promise<StoredReviewPhoto> {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) invalid('Ảnh không hợp lệ');
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) invalid('Ảnh quá lớn');

    const now = new Date();
    const base = `reviews/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
    const key = `${base}.webp`;
    const thumbKey = `${base}_sm.webp`;

    const large = await sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const thumb = await sharp(buffer).rotate().resize({ width: 400, height: 400, fit: 'cover' }).webp({ quality: 75 }).toBuffer();

    await this.storage.save(key, large.data);
    try {
      await this.storage.save(thumbKey, thumb);
    } catch (error) {
      await this.storage.remove(key).catch(() => undefined);
      throw error;
    }

    return {
      url: this.storage.urlFor(key),
      thumbUrl: this.storage.urlFor(thumbKey),
      width: large.info.width,
      height: large.info.height,
      key,
      thumbKey,
    };
  }

  /** Kiểm tra byte đầu file: chỉ JPEG, PNG, WebP (không tin phần đuôi tên file) */
  private assertImage(buffer: Buffer) {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) invalid('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
  }
}