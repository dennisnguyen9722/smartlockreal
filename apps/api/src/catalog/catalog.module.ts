import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { BrandController, CategoryController } from './catalog.controller';

@Module({
  controllers: [BrandController, CategoryController],
  providers: [BrandService, CategoryService],
  exports: [BrandService, CategoryService],
})
export class CatalogModule {}
