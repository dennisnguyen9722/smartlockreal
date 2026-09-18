import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { SpecDefinitionService } from './spec-definition.service';
import { BrandController, CategoryController } from './catalog.controller';
import { ProductController } from './product.controller';
import { VariantService } from './variant.service';

@Module({
  controllers: [BrandController, CategoryController, ProductController],
  providers: [BrandService, CategoryService, SpecDefinitionService, ProductService, VariantService],
  exports: [BrandService, CategoryService, SpecDefinitionService, ProductService, VariantService],
})
export class CatalogModule {}
