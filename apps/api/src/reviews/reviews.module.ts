import { Module } from '@nestjs/common';
import { ReviewController, ShopReviewController } from './review.controller';
import { ReviewPhotoService } from './review-photo.service';
import { ReviewService } from './review.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [ReviewService, ReviewPhotoService];

@Module({
  controllers: [ShopReviewController, ReviewController],
  providers: services,
  exports: services,
})
export class ReviewsModule {}