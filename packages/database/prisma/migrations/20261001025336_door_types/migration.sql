-- CreateTable
CREATE TABLE "door_types" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(320),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "door_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_door_types" (
    "product_id" UUID NOT NULL,
    "door_type_id" UUID NOT NULL,

    CONSTRAINT "product_door_types_pkey" PRIMARY KEY ("product_id","door_type_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "door_types_slug_key" ON "door_types"("slug");

-- CreateIndex
CREATE INDEX "door_types_is_active_sort_order_idx" ON "door_types"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "product_door_types_door_type_id_idx" ON "product_door_types"("door_type_id");

-- AddForeignKey
ALTER TABLE "product_door_types" ADD CONSTRAINT "product_door_types_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_door_types" ADD CONSTRAINT "product_door_types_door_type_id_fkey" FOREIGN KEY ("door_type_id") REFERENCES "door_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
