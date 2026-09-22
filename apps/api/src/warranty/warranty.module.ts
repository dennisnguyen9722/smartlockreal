import { Module } from '@nestjs/common';
import { WarrantyController } from './warranty.controller';
import { WarrantyService } from './warranty.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [WarrantyService];

@Module({
  controllers: [WarrantyController],
  providers: services,
  exports: services,
})
export class WarrantyModule {}