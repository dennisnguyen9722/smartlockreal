import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { SpecDefinitionService } from './spec-definition.service';
import { BrandController, CategoryController } from './catalog.controller';

@Module({
  controllers: [BrandController, CategoryController],
  providers: [BrandService, CategoryService, SpecDefinitionService],
  exports: [BrandService, CategoryService, SpecDefinitionService],
})
export class CatalogModule {}
