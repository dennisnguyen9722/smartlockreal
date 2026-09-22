/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `locations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "google_maps_url" TEXT,
ADD COLUMN     "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "opening_hours" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "province_code" VARCHAR(10),
ADD COLUMN     "province_name" VARCHAR(100),
ADD COLUMN     "published_at" TIMESTAMPTZ(3),
ADD COLUMN     "slug" VARCHAR(120),
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "ward_code" VARCHAR(10),
ADD COLUMN     "ward_name" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");
