import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderWorkflowService } from './order-workflow.service';
import { ShopOrderController } from './shop-order.controller';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [OrderService, OrderWorkflowService];

@Module({
  controllers: [OrderController, ShopOrderController],
  providers: services,
  exports: services,
})
export class OrdersModule {}