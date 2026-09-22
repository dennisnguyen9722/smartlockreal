import { Module } from '@nestjs/common';
import { ShowroomController } from './showroom.controller';
import { ShowroomService } from './showroom.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [ShowroomService];

@Module({
  controllers: [ShowroomController],
  providers: services,
  exports: services,
})
export class ShowroomsModule {}