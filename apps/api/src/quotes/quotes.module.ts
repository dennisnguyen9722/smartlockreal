import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [QuoteService];

@Module({
  // Dùng lại hàm tính giá (và ở lượt sau: lõi tạo đơn) của module đơn hàng
  imports: [OrdersModule],
  controllers: [QuoteController],
  providers: services,
  exports: services,
})
export class QuotesModule {}