-- CreateEnum
CREATE TYPE "promotion_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "voucher_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "voucher_target_type" AS ENUM ('PRODUCT', 'CATEGORY', 'BRAND');

-- CreateEnum
CREATE TYPE "redemption_status" AS ENUM ('RESERVED', 'USED', 'RELEASED');

-- AlterTable
ALTER TABLE "customer_groups" ADD COLUMN     "discount_bps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "variant_region_prices" (
    "variant_id" UUID NOT NULL,
    "region" "region" NOT NULL,
    "price" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "variant_region_prices_pkey" PRIMARY KEY ("variant_id","region")
);

-- CreateTable
CREATE TABLE "group_variant_prices" (
    "group_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "price" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "group_variant_prices_pkey" PRIMARY KEY ("group_id","variant_id")
);

-- CreateTable
CREATE TABLE "quantity_price_tiers" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "fixed_price" BIGINT,
    "discount_bps" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quantity_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "promotion_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sale_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_campaign_items" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "sale_price" BIGINT NOT NULL,
    "quantity_limit" INTEGER,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "per_order_limit" INTEGER,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sale_campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "discount_type" "discount_type" NOT NULL,
    "discount_bps" INTEGER,
    "discount_amount" BIGINT,
    "max_discount" BIGINT,
    "min_order_amount" BIGINT NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_phone_limit" INTEGER DEFAULT 1,
    "applies_to_sale_items" BOOLEAN NOT NULL DEFAULT false,
    "status" "voucher_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_targets" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "target_type" "voucher_target_type" NOT NULL,
    "product_id" UUID,
    "category_id" UUID,
    "brand_id" UUID,

    CONSTRAINT "voucher_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_redemptions" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "order_id" UUID,
    "phone" VARCHAR(16) NOT NULL,
    "discount_amount" BIGINT NOT NULL,
    "status" "redemption_status" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_promotions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "promotion_status" NOT NULL DEFAULT 'DRAFT',
    "min_order_amount" BIGINT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gift_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_triggers" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "gift_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_items" (
    "promotion_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "gift_items_pkey" PRIMARY KEY ("promotion_id","variant_id")
);

-- CreateIndex
CREATE INDEX "group_variant_prices_variant_id_idx" ON "group_variant_prices"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "quantity_price_tiers_variant_id_min_quantity_key" ON "quantity_price_tiers"("variant_id", "min_quantity");

-- CreateIndex
CREATE INDEX "sale_campaigns_status_starts_at_ends_at_idx" ON "sale_campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "sale_campaign_items_variant_id_is_published_starts_at_ends__idx" ON "sale_campaign_items"("variant_id", "is_published", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "sale_campaign_items_campaign_id_variant_id_key" ON "sale_campaign_items"("campaign_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_status_starts_at_ends_at_idx" ON "vouchers"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "voucher_targets_voucher_id_idx" ON "voucher_targets"("voucher_id");

-- CreateIndex
CREATE INDEX "voucher_redemptions_voucher_id_phone_idx" ON "voucher_redemptions"("voucher_id", "phone");

-- CreateIndex
CREATE INDEX "voucher_redemptions_order_id_idx" ON "voucher_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "gift_promotions_status_starts_at_ends_at_idx" ON "gift_promotions"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "gift_triggers_promotion_id_variant_id_key" ON "gift_triggers"("promotion_id", "variant_id");

-- AddForeignKey
ALTER TABLE "variant_region_prices" ADD CONSTRAINT "variant_region_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_variant_prices" ADD CONSTRAINT "group_variant_prices_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_variant_prices" ADD CONSTRAINT "group_variant_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quantity_price_tiers" ADD CONSTRAINT "quantity_price_tiers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_campaigns" ADD CONSTRAINT "sale_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_campaign_items" ADD CONSTRAINT "sale_campaign_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sale_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_campaign_items" ADD CONSTRAINT "sale_campaign_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_targets" ADD CONSTRAINT "voucher_targets_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_targets" ADD CONSTRAINT "voucher_targets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_targets" ADD CONSTRAINT "voucher_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_targets" ADD CONSTRAINT "voucher_targets_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_promotions" ADD CONSTRAINT "gift_promotions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_triggers" ADD CONSTRAINT "gift_triggers_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "gift_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_triggers" ADD CONSTRAINT "gift_triggers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "gift_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK, EXCLUDE và trigger (viết tay)
-- ============================================================

-- Tiện ích cho phép dùng uuid trong ràng buộc EXCLUDE (có sẵn trong PostgreSQL)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Nhóm khách
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_discount_range"
  CHECK ("discount_bps" BETWEEN 0 AND 10000);

-- Giá khu vực, giá nhóm
ALTER TABLE "variant_region_prices" ADD CONSTRAINT "variant_region_prices_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "group_variant_prices" ADD CONSTRAINT "group_variant_prices_price_non_negative" CHECK ("price" >= 0);

-- Bậc số lượng: đúng MỘT trong hai kiểu giá
ALTER TABLE "quantity_price_tiers" ADD CONSTRAINT "quantity_price_tiers_min_quantity" CHECK ("min_quantity" >= 2);
ALTER TABLE "quantity_price_tiers" ADD CONSTRAINT "quantity_price_tiers_one_kind"
  CHECK (("fixed_price" IS NULL) <> ("discount_bps" IS NULL));
ALTER TABLE "quantity_price_tiers" ADD CONSTRAINT "quantity_price_tiers_values" CHECK (
  ("fixed_price" IS NULL OR "fixed_price" >= 0)
  AND ("discount_bps" IS NULL OR "discount_bps" BETWEEN 1 AND 9999)
);

-- Flash sale
ALTER TABLE "sale_campaigns" ADD CONSTRAINT "sale_campaigns_time_range" CHECK ("ends_at" > "starts_at");
ALTER TABLE "sale_campaign_items" ADD CONSTRAINT "sale_campaign_items_values" CHECK (
  "sale_price" >= 0
  AND ("quantity_limit" IS NULL OR "quantity_limit" > 0)
  AND "sold_quantity" >= 0
  AND ("quantity_limit" IS NULL OR "sold_quantity" <= "quantity_limit")
  AND ("per_order_limit" IS NULL OR "per_order_limit" > 0)
);
-- Một biến thể không được nằm trong hai đợt sale ĐÃ CÔNG BỐ có thời gian giao nhau
ALTER TABLE "sale_campaign_items" ADD CONSTRAINT "sale_campaign_items_no_overlap"
  EXCLUDE USING gist ("variant_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("is_published");

-- Đồng bộ thời gian và trạng thái từ đợt sale xuống từng dòng
CREATE FUNCTION "sale_items_sync_from_campaign"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT c."starts_at", c."ends_at", c."status" = 'PUBLISHED'
    INTO NEW."starts_at", NEW."ends_at", NEW."is_published"
    FROM "sale_campaigns" c
    WHERE c."id" = NEW."campaign_id";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "sale_campaign_items_sync"
  BEFORE INSERT OR UPDATE ON "sale_campaign_items"
  FOR EACH ROW EXECUTE FUNCTION "sale_items_sync_from_campaign"();

CREATE FUNCTION "sale_campaigns_propagate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."starts_at" IS DISTINCT FROM OLD."starts_at"
     OR NEW."ends_at" IS DISTINCT FROM OLD."ends_at"
     OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    -- Lệnh UPDATE này kích hoạt trigger đồng bộ ở trên cho từng dòng
    UPDATE "sale_campaign_items" SET "updated_at" = now() WHERE "campaign_id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "sale_campaigns_propagate_to_items"
  AFTER UPDATE ON "sale_campaigns"
  FOR EACH ROW EXECUTE FUNCTION "sale_campaigns_propagate"();

-- Voucher
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_code_format" CHECK ("code" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$');
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_time_range" CHECK ("ends_at" > "starts_at");
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_discount_by_type" CHECK (
  ("discount_type" = 'PERCENT'
    AND "discount_bps" BETWEEN 1 AND 10000
    AND "discount_amount" IS NULL
    AND ("max_discount" IS NULL OR "max_discount" > 0))
  OR
  ("discount_type" = 'FIXED_AMOUNT'
    AND "discount_amount" > 0
    AND "discount_bps" IS NULL
    AND "max_discount" IS NULL)
);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_limits" CHECK (
  "min_order_amount" >= 0
  AND ("usage_limit" IS NULL OR "usage_limit" > 0)
  AND "used_count" >= 0
  AND ("usage_limit" IS NULL OR "used_count" <= "usage_limit")
  AND ("per_phone_limit" IS NULL OR "per_phone_limit" > 0)
);

-- Phạm vi voucher: đúng MỘT khóa ngoại khớp với loại; không trùng
ALTER TABLE "voucher_targets" ADD CONSTRAINT "voucher_targets_one_target" CHECK (
  ("target_type" = 'PRODUCT') = ("product_id" IS NOT NULL)
  AND ("target_type" = 'CATEGORY') = ("category_id" IS NOT NULL)
  AND ("target_type" = 'BRAND') = ("brand_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "voucher_targets_unique" ON "voucher_targets"
  ("voucher_id", "product_id", "category_id", "brand_id") NULLS NOT DISTINCT;

-- Lượt dùng voucher
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_amount_non_negative" CHECK ("discount_amount" >= 0);
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_phone_format" CHECK ("phone" ~ '^\+84[0-9]{9,10}$');

-- Quà tặng
ALTER TABLE "gift_promotions" ADD CONSTRAINT "gift_promotions_time_range" CHECK ("ends_at" > "starts_at");
ALTER TABLE "gift_promotions" ADD CONSTRAINT "gift_promotions_min_order" CHECK ("min_order_amount" IS NULL OR "min_order_amount" >= 0);
ALTER TABLE "gift_triggers" ADD CONSTRAINT "gift_triggers_min_quantity" CHECK ("min_quantity" > 0);
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_quantity" CHECK ("quantity" > 0);
