import { Controller, Get, Header, Param } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { GeoService } from './geo.service';

/** Công khai: website (form đặt hàng) và CMS đều dùng. Dữ liệu hầu như không đổi nên cache 1 ngày. */
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('provinces')
  @Public()
  @Header('Cache-Control', 'public, max-age=86400')
  provinces() {
    return this.geo.provinces();
  }

  @Get('provinces/:code/wards')
  @Public()
  @Header('Cache-Control', 'public, max-age=86400')
  wards(@Param('code') code: string) {
    return this.geo.wards(code);
  }
}