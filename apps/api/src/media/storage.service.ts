import { Inject, Injectable, Logger } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/**
 * Lớp lưu trữ file. Hiện lưu trên ổ đĩa của server.
 * Muốn chuyển sang Cloudflare R2 hoặc S3: viết lớp mới cùng ba phương thức này,
 * code nghiệp vụ không phải sửa.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(@Inject(ENV) env: Env) {
    this.root = path.resolve(env.MEDIA_ROOT);
    this.publicUrl = env.MEDIA_PUBLIC_URL.replace(/\/+$/, '');
  }

  get rootDir(): string {
    return this.root;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      // File không còn thì coi như đã xóa
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Không xóa được ${key}: ${(error as Error).message}`);
      }
    }
  }

  urlFor(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Chuyển key thành đường dẫn thật, đồng thời CHẶN đường dẫn vượt ra ngoài
   * thư mục gốc (kiểu "../../etc/passwd").
   */
  private resolveKey(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error(`Đường dẫn không hợp lệ: ${key}`);
    }
    return target;
  }
}
