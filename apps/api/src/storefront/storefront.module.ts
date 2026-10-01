import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';

/**
 * API công khai cho website bán hàng.
 * Cần CatalogModule vì dùng lại SpecDefinitionService để đọc khuôn thông số
 * theo danh mục — thông số hiện trên trang sản phẩm phải đúng tên và đúng thứ tự
 * như trong trang quản trị, nên dùng chung một nguồn.
 */
@Module({
  imports: [CatalogModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
