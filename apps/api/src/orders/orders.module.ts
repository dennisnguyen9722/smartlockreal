import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [OrderService];

@Module({
  controllers: [OrderController],
  providers: services,
  exports: services,
})
export class OrdersModule {}