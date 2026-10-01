import { Module } from '@nestjs/common';
import { ConsultController, ShopConsultController } from './consult.controller';
import { ConsultService } from './consult.service';

/**
 * Yêu cầu tư vấn: khách gửi từ website (ShopConsultController, công khai)
 * và nhân viên xử lý trong trang quản trị (ConsultController, cần quyền).
 * Hai controller cùng một service để quy tắc nghiệp vụ chỉ nằm ở một chỗ.
 */
@Module({
  controllers: [ShopConsultController, ConsultController],
  providers: [ConsultService],
  exports: [ConsultService],
})
export class ConsultModule {}
