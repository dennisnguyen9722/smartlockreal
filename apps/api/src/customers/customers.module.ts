import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [CustomerService];

@Module({
  controllers: [CustomerController],
  providers: services,
  exports: services,
})
export class CustomersModule {}