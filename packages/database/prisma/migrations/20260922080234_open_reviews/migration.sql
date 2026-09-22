/*
  Warnings:

  - Added the required column `reviewer_phone` to the `product_reviews` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "product_reviews" ADD COLUMN     "reviewer_phone" VARCHAR(16) NOT NULL,
ADD COLUMN     "verified_purchase" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "order_line_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "product_reviews_product_id_reviewer_phone_idx" ON "product_reviews"("product_id", "reviewer_phone");
