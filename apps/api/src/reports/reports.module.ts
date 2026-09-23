import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [ReportService];

@Module({
  controllers: [ReportController],
  providers: services,
  exports: services,
})
export class ReportsModule {}
