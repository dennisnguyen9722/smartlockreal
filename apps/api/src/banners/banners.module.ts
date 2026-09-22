import { Module } from '@nestjs/common';
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [BannerService];

@Module({
  controllers: [BannerController],
  providers: services,
  exports: services,
})
export class BannersModule {}