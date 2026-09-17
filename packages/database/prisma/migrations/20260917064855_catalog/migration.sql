-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('LOCK', 'ACCESSORY', 'SERVICE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "spec_data_type" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "product_relation_type" AS ENUM ('ACCESSORY', 'SIMILAR', 'UPSELL');

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "country_of_origin" VARCHAR(80),
    "is_authorized" BOOLEAN NOT NULL DEFAULT false,
    "authorization_doc_url" TEXT,
    "authorization_expires_at" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_definitions" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "data_type" "spec_data_type" NOT NULL,
    "unit" VARCHAR(20),
    "options" JSONB,
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "spec_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_classes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "installation_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_rates" (
    "installation_class_id" UUID NOT NULL,
    "region" "region" NOT NULL,
    "price" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "installation_rates_pkey" PRIMARY KEY ("installation_class_id","region")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "type" "product_type" NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "brand_id" UUID,
    "category_id" UUID NOT NULL,
    "installation_class_id" UUID,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "manufacturer_code" VARCHAR(80),
    "short_description" TEXT,
    "description" TEXT,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "warranty_months" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(320),
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_options" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_values" (
    "id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "value" VARCHAR(60) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "option_key" VARCHAR(255) NOT NULL DEFAULT '',
    "price" BIGINT NOT NULL,
    "compare_at_price" BIGINT,
    "barcode" VARCHAR(64),
    "weight_grams" INTEGER,
    "track_serial" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option_values" (
    "variant_id" UUID NOT NULL,
    "option_value_id" UUID NOT NULL,

    CONSTRAINT "variant_option_values_pkey" PRIMARY KEY ("variant_id","option_value_id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "type" "media_type" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "alt_text" VARCHAR(200),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "bundle_variant_id" UUID NOT NULL,
    "component_variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("bundle_variant_id","component_variant_id")
);

-- CreateTable
CREATE TABLE "product_relations" (
    "product_id" UUID NOT NULL,
    "related_product_id" UUID NOT NULL,
    "type" "product_relation_type" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_relations_pkey" PRIMARY KEY ("product_id","related_product_id","type")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "spec_definitions_category_id_code_key" ON "spec_definitions"("category_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "installation_classes_code_key" ON "installation_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_type_status_idx" ON "products"("type", "status");

-- CreateIndex
CREATE INDEX "products_specs_idx" ON "products" USING GIN ("specs" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "product_options_product_id_code_key" ON "product_options"("product_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_values_option_id_code_key" ON "product_option_values"("option_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_option_key_key" ON "product_variants"("product_id", "option_key");

-- CreateIndex
CREATE INDEX "variant_option_values_option_value_id_idx" ON "variant_option_values"("option_value_id");

-- CreateIndex
CREATE INDEX "product_media_product_id_sort_order_idx" ON "product_media"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "bundle_items_component_variant_id_idx" ON "bundle_items"("component_variant_id");

-- CreateIndex
CREATE INDEX "product_relations_related_product_id_idx" ON "product_relations"("related_product_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_definitions" ADD CONSTRAINT "spec_definitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_rates" ADD CONSTRAINT "installation_rates_installation_class_id_fkey" FOREIGN KEY ("installation_class_id") REFERENCES "installation_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_installation_class_id_fkey" FOREIGN KEY ("installation_class_id") REFERENCES "installation_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "product_option_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_variant_id_fkey" FOREIGN KEY ("bundle_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_component_variant_id_fkey" FOREIGN KEY ("component_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_related_product_id_fkey" FOREIGN KEY ("related_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Ràng buộc CHECK (viết tay, Prisma không tự tạo)
-- ============================================================

-- Slug: chữ thường, số, gạch ngang; không bắt đầu/kết thúc bằng gạch
ALTER TABLE "brands"     ADD CONSTRAINT "brands_slug_format"     CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "products"   ADD CONSTRAINT "products_slug_format"   CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Danh mục không được là cha của chính nó
ALTER TABLE "categories" ADD CONSTRAINT "categories_not_self_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

-- Sản phẩm
ALTER TABLE "products" ADD CONSTRAINT "products_lock_requires_brand"
  CHECK ("type" <> 'LOCK' OR "brand_id" IS NOT NULL);
ALTER TABLE "products" ADD CONSTRAINT "products_installation_only_for_lock"
  CHECK ("installation_class_id" IS NULL OR "type" = 'LOCK');
ALTER TABLE "products" ADD CONSTRAINT "products_warranty_non_negative" CHECK ("warranty_months" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_specs_is_object" CHECK (jsonb_typeof("specs") = 'object');

-- Biến thể
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_sku_format"
  CHECK ("sku" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$');
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_compare_at_gt_price"
  CHECK ("compare_at_price" IS NULL OR "compare_at_price" > "price");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_weight_positive"
  CHECK ("weight_grams" IS NULL OR "weight_grams" > 0);

-- Giá lắp đặt
ALTER TABLE "installation_rates" ADD CONSTRAINT "installation_rates_price_non_negative" CHECK ("price" >= 0);

-- Combo: số lượng dương, không chứa chính nó
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_not_self"
  CHECK ("bundle_variant_id" <> "component_variant_id");

-- Sản phẩm liên quan: không liên quan tới chính nó
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_not_self"
  CHECK ("product_id" <> "related_product_id");
