-- CreateEnum
CREATE TYPE "consult_kind" AS ENUM ('RETAIL', 'PROJECT');

-- CreateEnum
CREATE TYPE "consult_status" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST', 'SPAM');

-- CreateTable
CREATE TABLE "consult_requests" (
    "id" UUID NOT NULL,
    "kind" "consult_kind" NOT NULL DEFAULT 'RETAIL',
    "status" "consult_status" NOT NULL DEFAULT 'NEW',
    "full_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(255),
    "company" VARCHAR(200),
    "quantity" INTEGER,
    "door_type_name" VARCHAR(120),
    "product_slug" VARCHAR(160),
    "product_name" VARCHAR(200),
    "message" TEXT,
    "source_path" VARCHAR(500),
    "internal_note" TEXT,
    "contacted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consult_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consult_requests_status_created_at_idx" ON "consult_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "consult_requests_kind_status_idx" ON "consult_requests"("kind", "status");

-- CreateIndex
CREATE INDEX "consult_requests_phone_idx" ON "consult_requests"("phone");
