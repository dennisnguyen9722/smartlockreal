-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "category_id" UUID;

-- CreateIndex
CREATE INDEX "banners_category_id_idx" ON "banners"("category_id");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
