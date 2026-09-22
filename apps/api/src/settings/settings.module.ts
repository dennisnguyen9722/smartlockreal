import { Global, Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

// Global giống AuditModule: báo giá, đơn hàng, bài viết, storefront... đều cần đọc cấu hình
const services = [SettingsService];

@Global()
@Module({
  controllers: [SettingsController],
  providers: services,
  exports: services,
})
export class SettingsModule {}