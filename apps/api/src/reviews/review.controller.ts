import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ErrorCode,
  Permission,
  REVIEW_MAX_PHOTOS,
  REVIEW_MAX_PHOTO_MB,
  ReviewApproveSchema,
  ReviewListQuerySchema,
  ReviewRejectSchema,
  ReviewReplySchema,
  ReviewSubmitSchema,
} from '@ktm/shared';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import type { AuthUser } from '../common/types/express';
import { ReviewService } from './review.service';

const IdSchema = z.uuid('ID không hợp lệ');

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppException(
      ErrorCode.VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

function auditContext(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    traceId: req.get('x-request-id') ?? undefined,
  };
}

/** Endpoint công khai cho website: khách gửi đánh giá ở trang sản phẩm */
@Controller('shop/reviews')
export class ShopReviewController {
  constructor(private readonly reviews: ReviewService) {}

  /**
   * multipart/form-data: productId, reviewerName, phone, rating, content, privacyConsent + tối đa 5 file "photos".
   * Tối đa 5 lần / giờ / IP: khách thật hiếm khi đánh giá nhiều hơn, bot thì bị chặn sớm.
   */
  @Post()
  @Public()
  @RateLimit({ name: 'shop-review', limit: 5, windowSeconds: 3600 })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    // Giới hạn ngay lúc nhận file: quá cỡ hoặc quá số lượng thì multer dừng đọc, không tốn bộ nhớ
    FilesInterceptor('photos', REVIEW_MAX_PHOTOS, { limits: { fileSize: REVIEW_MAX_PHOTO_MB * 1024 * 1024, files: REVIEW_MAX_PHOTOS, fields: 10 } }),
  )
  submit(@Body() body: unknown, @UploadedFiles() files: Express.Multer.File[] | undefined) {
    return this.reviews.submit(parse(ReviewSubmitSchema, body), (files ?? []).map((file) => ({ buffer: file.buffer, size: file.size })));
  }
}

/** Duyệt đánh giá trong CMS */
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  @RequirePermissions(Permission.REVIEW_MODERATE)
  list(@Query() query: unknown) {
    return this.reviews.list(parse(ReviewListQuerySchema, query));
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const input = parse(ReviewApproveSchema, body);
    return this.reviews.approve(parse(IdSchema, id), input.expectedUpdatedAt, user.id, auditContext(req));
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.REVIEW_MODERATE)
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.reviews.reject(parse(IdSchema, id), parse(ReviewRejectSchema, body), user.id, auditContext(req));
  }

  /** Trả lời công khai (content = null để gỡ) */
  @Put(':id/reply')
  @RequirePermissions(Permission.REVIEW_MODERATE)
  reply(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.reviews.reply(parse(IdSchema, id), parse(ReviewReplySchema, body), user.id, auditContext(req));
  }
}