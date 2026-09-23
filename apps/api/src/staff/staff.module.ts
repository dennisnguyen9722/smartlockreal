import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây.
// PasswordService, AuthService (AuthModule) và AuditService là module global, không cần import.
const services = [StaffService];

@Module({
  controllers: [StaffController],
  providers: services,
  exports: services,
})
export class StaffModule {}