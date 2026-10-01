import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [BannerService];

@Module({
  // Cần StorefrontService để xóa bộ nhớ đệm trang chủ sau khi sửa banner
  imports: [StorefrontModule],
  controllers: [BannerController],
  providers: services,
  exports: services,
})
export class BannersModule {}