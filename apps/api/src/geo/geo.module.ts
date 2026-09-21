import { Global, Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

/** Global: đơn hàng, khách hàng, báo giá đều cần tra địa chỉ */
@Global()
@Module({
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}