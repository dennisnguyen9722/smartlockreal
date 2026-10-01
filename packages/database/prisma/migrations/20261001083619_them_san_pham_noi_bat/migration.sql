-- AlterTable
ALTER TABLE "products" ADD COLUMN     "featured_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "products_is_featured_featured_order_idx" ON "products"("is_featured", "featured_order");
