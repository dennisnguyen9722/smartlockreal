-- DropIndex
DROP INDEX "voucher_targets_unique";

-- Thay chỉ mục NULLS NOT DISTINCT (Prisma không quản lý được) bằng 3 chỉ mục có điều kiện.
-- Prisma bỏ qua chỉ mục có WHERE nên không đòi xóa nữa.
CREATE UNIQUE INDEX "voucher_targets_product_key" ON "voucher_targets" ("voucher_id", "product_id")
  WHERE "product_id" IS NOT NULL;
CREATE UNIQUE INDEX "voucher_targets_category_key" ON "voucher_targets" ("voucher_id", "category_id")
  WHERE "category_id" IS NOT NULL;
CREATE UNIQUE INDEX "voucher_targets_brand_key" ON "voucher_targets" ("voucher_id", "brand_id")
  WHERE "brand_id" IS NOT NULL;
