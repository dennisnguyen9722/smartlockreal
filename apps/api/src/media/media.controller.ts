import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { ErrorCode, Permission } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import type { AuthUser } from '../common/types/express';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { ImageService } from './image.service';

const IdSchema = z.uuid('ID không hợp lệ');

@Controller('media')
export class MediaController {
  constructor(
    private readonly images: ImageService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_VIEW)
  async list(@Query('page') page = '1', @Query('pageSize') pageSize = '24') {
    const [items, total] = await this.images.list(Number(page) || 1, Math.min(Number(pageSize) || 24, 100));
    return { items, total, page: Number(page) || 1, pageSize: Number(pageSize) || 24 };
  }

  @Post('upload')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  // Giữ file trong bộ nhớ để sharp xử lý; giới hạn dung lượng ngay tại đây
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthUser) {
    if (!file) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'Chưa chọn file',
      });
    }
    if (file.size > this.env.MEDIA_MAX_SIZE_MB * 1024 * 1024) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.PAYLOAD_TOO_LARGE, {
        field: 'file',
        message: `Ảnh tối đa ${this.env.MEDIA_MAX_SIZE_MB} MB`,
      });
    }
    return this.images.upload(file.buffer, file.originalname, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONTENT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    const parsed = IdSchema.safeParse(id);
    if (!parsed.success) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    }
    return this.images.remove(parsed.data);
  }
}
