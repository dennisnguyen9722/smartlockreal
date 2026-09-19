import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { ProductMediaService } from './product-media.service';
import { ProductOptionService } from './product-option.service';
import { ProductService } from './product.service';
import { SpecDefinitionService } from './spec-definition.service';
import { VariantService } from './variant.service';
import { ImportParserService } from './import/parser.service';
import { ImportService } from './import/import.service';
import { ImportTemplateService } from './import/template.service';
import { BrandController, CategoryController } from './catalog.controller';
import { ProductController } from './product.controller';
import { ImportController } from './import/import.controller';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [
  BrandService,
  CategoryService,
  SpecDefinitionService,
  ProductService,
  VariantService,
  ProductOptionService,
  ProductMediaService,
  ImportTemplateService,
  ImportParserService,
  ImportService,
];

@Module({
  controllers: [BrandController, CategoryController, ProductController, ImportController],
  providers: services,
  exports: services,
})
export class CatalogModule {}