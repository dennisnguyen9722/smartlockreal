-- AlterTable
ALTER TABLE "products" ADD COLUMN     "price_from" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_status_price_from_idx" ON "products"("status", "price_from");
