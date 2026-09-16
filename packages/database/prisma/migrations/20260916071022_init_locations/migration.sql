-- CreateEnum
CREATE TYPE "location_type" AS ENUM ('WAREHOUSE', 'STORE');

-- CreateEnum
CREATE TYPE "region" AS ENUM ('HCM', 'HN');

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "location_type" NOT NULL,
    "region" "region" NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");
