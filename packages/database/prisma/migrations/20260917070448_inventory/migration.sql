-- CreateEnum
CREATE TYPE "serial_unit_status" AS ENUM ('IN_STOCK', 'DISPLAY', 'IN_TRANSIT', 'SOLD', 'DEFECTIVE', 'AT_VENDOR', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "reservation_source" AS ENUM ('ONLINE_CHECKOUT', 'ORDER');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('RECEIPT', 'SALE', 'SALE_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'TO_DISPLAY', 'FROM_DISPLAY', 'DISPLAY_SALE', 'MARK_DEFECTIVE', 'SEND_TO_VENDOR', 'RECEIVE_FROM_VENDOR', 'SCRAP');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "stock_levels" (
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("variant_id","location_id")
);

-- CreateTable
CREATE TABLE "serial_units" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "status" "serial_unit_status" NOT NULL DEFAULT 'IN_STOCK',
    "location_id" UUID,
    "display_price" BIGINT,
    "is_listed" BOOLEAN NOT NULL DEFAULT false,
    "condition_note" TEXT,
    "display_photos" JSONB NOT NULL DEFAULT '[]',
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sold_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "serial_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" "reservation_source" NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'ACTIVE',
    "order_id" UUID,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "on_hand_after" INTEGER NOT NULL,
    "serial_unit_id" UUID,
    "document_type" VARCHAR(40),
    "document_id" UUID,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(200),
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "location_id" UUID NOT NULL,
    "supplier_id" UUID,
    "status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "posted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "shipped_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktakes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "location_id" UUID NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "posted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stocktakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_lines" (
    "id" UUID NOT NULL,
    "stocktake_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "system_qty" INTEGER NOT NULL,
    "counted_qty" INTEGER NOT NULL,

    CONSTRAINT "stocktake_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_levels_location_id_idx" ON "stock_levels"("location_id");

-- CreateIndex
CREATE INDEX "serial_units_serial_number_idx" ON "serial_units"("serial_number");

-- CreateIndex
CREATE INDEX "serial_units_location_id_status_idx" ON "serial_units"("location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "serial_units_variant_id_serial_number_key" ON "serial_units"("variant_id", "serial_number");

-- CreateIndex
CREATE INDEX "stock_reservations_variant_id_location_id_idx" ON "stock_reservations"("variant_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_reservations_order_id_idx" ON "stock_reservations"("order_id");

-- CreateIndex
CREATE INDEX "stock_movements_variant_id_location_id_created_at_idx" ON "stock_movements"("variant_id", "location_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_document_type_document_id_idx" ON "stock_movements"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "stock_movements_serial_unit_id_idx" ON "stock_movements"("serial_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_code_key" ON "goods_receipts"("code");

-- CreateIndex
CREATE INDEX "goods_receipts_location_id_status_idx" ON "goods_receipts"("location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_receipt_id_variant_id_key" ON "goods_receipt_lines"("receipt_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_code_key" ON "stock_transfers"("code");

-- CreateIndex
CREATE INDEX "stock_transfers_status_shipped_at_idx" ON "stock_transfers"("status", "shipped_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_lines_transfer_id_variant_id_key" ON "stock_transfer_lines"("transfer_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocktakes_code_key" ON "stocktakes"("code");

-- CreateIndex
CREATE INDEX "stocktakes_location_id_status_idx" ON "stocktakes"("location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stocktake_lines_stocktake_id_variant_id_key" ON "stocktake_lines"("stocktake_id", "variant_id");

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_location_id_fkey" FOREIGN KEY ("variant_id", "location_id") REFERENCES "stock_levels"("variant_id", "location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_location_id_fkey" FOREIGN KEY ("variant_id", "location_id") REFERENCES "stock_levels"("variant_id", "location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_lines" ADD CONSTRAINT "stocktake_lines_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_lines" ADD CONSTRAINT "stocktake_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Ràng buộc CHECK và trigger (viết tay)
-- ============================================================

-- Tồn kho: không âm, giữ không vượt quá thực có
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_on_hand_non_negative" CHECK ("on_hand" >= 0);
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_reserved_non_negative" CHECK ("reserved" >= 0);
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_reserved_le_on_hand" CHECK ("reserved" <= "on_hand");

-- Serial: viết hoa, không khoảng trắng
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_serial_format"
  CHECK ("serial_number" ~ '^[A-Z0-9][A-Z0-9._/-]*$');
-- Chiếc ở showroom thì phải có showroom; chiếc không ở showroom thì không có
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_location_by_status" CHECK (
  ("status" IN ('IN_STOCK', 'DISPLAY', 'DEFECTIVE') AND "location_id" IS NOT NULL)
  OR ("status" IN ('IN_TRANSIT', 'SOLD', 'AT_VENDOR', 'SCRAPPED') AND "location_id" IS NULL)
);
-- Chỉ máy trưng bày có giá mới được rao bán
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_listed_requires_display" CHECK (
  NOT "is_listed" OR ("status" = 'DISPLAY' AND "display_price" IS NOT NULL)
);
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_display_price_non_negative"
  CHECK ("display_price" IS NULL OR "display_price" >= 0);
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_sold_at_when_sold"
  CHECK (("status" = 'SOLD') = ("sold_at" IS NOT NULL));
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_display_photos_is_array"
  CHECK (jsonb_typeof("display_photos") = 'array');

-- Giữ hàng: số lượng dương; giữ tạm online phải có hạn, giữ theo đơn thì không
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_expiry_by_source" CHECK (
  ("source" = 'ONLINE_CHECKOUT' AND "expires_at" IS NOT NULL)
  OR ("source" = 'ORDER' AND "expires_at" IS NULL)
);

-- Sổ kho: dấu của số lượng phải khớp loại biến động
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_on_hand_after_non_negative" CHECK ("on_hand_after" >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_delta_sign" CHECK (
  CASE
    WHEN "type" IN ('RECEIPT', 'TRANSFER_IN', 'SALE_RETURN', 'FROM_DISPLAY', 'RECEIVE_FROM_VENDOR')
      THEN "quantity_delta" >= 0
    WHEN "type" IN ('SALE', 'TRANSFER_OUT', 'TO_DISPLAY', 'MARK_DEFECTIVE', 'SCRAP')
      THEN "quantity_delta" <= 0
    WHEN "type" IN ('DISPLAY_SALE', 'SEND_TO_VENDOR')
      THEN "quantity_delta" = 0
    ELSE TRUE -- ADJUSTMENT: tăng hoặc giảm
  END
);

-- Chứng từ: mã viết hoa (vd: PN-260917-0001); ngày chốt khớp trạng thái
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_posted_at_when_posted"
  CHECK (("status" = 'POSTED') = ("posted_at" IS NOT NULL));
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_posted_at_when_posted"
  CHECK (("status" = 'POSTED') = ("posted_at" IS NOT NULL));
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_different_locations"
  CHECK ("from_location_id" <> "to_location_id");
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dates_by_status" CHECK (
  ("shipped_at" IS NOT NULL) = ("status" IN ('IN_TRANSIT', 'RECEIVED'))
  AND ("received_at" IS NOT NULL) = ("status" = 'RECEIVED')
);

-- Dòng chứng từ: số lượng dương; danh sách serial rỗng hoặc đủ số lượng
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_serial_count"
  CHECK (cardinality("serial_numbers") IN (0, "quantity"));
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_serial_count"
  CHECK (cardinality("serial_numbers") IN (0, "quantity"));
ALTER TABLE "stocktake_lines" ADD CONSTRAINT "stocktake_lines_qty_non_negative"
  CHECK ("system_qty" >= 0 AND "counted_qty" >= 0);

-- Sổ kho bất biến: chặn UPDATE, DELETE, TRUNCATE
CREATE FUNCTION "stock_movements_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements là sổ kho bất biến: không được % dữ liệu', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "stock_movements_no_update_delete"
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION "stock_movements_immutable"();

CREATE TRIGGER "stock_movements_no_truncate"
  BEFORE TRUNCATE ON "stock_movements"
  FOR EACH STATEMENT EXECUTE FUNCTION "stock_movements_immutable"();
