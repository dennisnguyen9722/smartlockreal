import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { SpecDefinitionService } from './spec-definition.service';
import { BrandController, CategoryController } from './catalog.controller';
import { ProductController } from './product.controller';

@Module({
  controllers: [BrandController, CategoryController, ProductController],
  providers: [BrandService, CategoryService, SpecDefinitionService, ProductService],
  exports: [BrandService, CategoryService, SpecDefinitionService, ProductService],
})
export class CatalogModule {}
