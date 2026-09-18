import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { ProductMediaService } from './product-media.service';
import { ProductService } from './product.service';
import { SpecDefinitionService } from './spec-definition.service';
import { VariantService } from './variant.service';
import { BrandController, CategoryController } from './catalog.controller';
import { ProductController } from './product.controller';

@Module({
  controllers: [BrandController, CategoryController, ProductController],
  providers: [
    BrandService,
    CategoryService,
    SpecDefinitionService,
    ProductService,
    VariantService,
    ProductMediaService,
  ],
  exports: [
    BrandService,
    CategoryService,
    SpecDefinitionService,
    ProductService,
    VariantService,
    ProductMediaService,
  ],
})
export class CatalogModule {}
