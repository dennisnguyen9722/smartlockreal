-- CreateEnum
CREATE TYPE "shipment_method" AS ENUM ('OWN_DELIVERY', 'CARRIER', 'CUSTOMER_PICKUP');

-- CreateEnum
CREATE TYPE "carrier" AS ENUM ('GHN', 'GHTK', 'VIETTEL_POST', 'OTHER');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('PENDING', 'PACKED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "order_id" UUID NOT NULL,
    "from_location_id" UUID NOT NULL,
    "method" "shipment_method" NOT NULL,
    "carrier" "carrier",
    "tracking_code" VARCHAR(60),
    "status" "shipment_status" NOT NULL DEFAULT 'PENDING',
    "cod_amount" BIGINT NOT NULL DEFAULT 0,
    "cod_collected_amount" BIGINT,
    "cod_collected_at" TIMESTAMPTZ(3),
    "carrier_fee" BIGINT,
    "delivered_by_id" UUID,
    "failed_reason" TEXT,
    "note" TEXT,
    "created_by_id" UUID,
    "packed_at" TIMESTAMPTZ(3),
    "shipped_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lines" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_line_serials" (
    "shipment_line_id" UUID NOT NULL,
    "serial_unit_id" UUID NOT NULL,

    CONSTRAINT "shipment_line_serials_pkey" PRIMARY KEY ("shipment_line_id","serial_unit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_code_key" ON "shipments"("code");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_created_at_idx" ON "shipments"("status", "created_at");

-- CreateIndex
CREATE INDEX "shipments_from_location_id_status_idx" ON "shipments"("from_location_id", "status");

-- CreateIndex
CREATE INDEX "shipment_lines_order_line_id_idx" ON "shipment_lines"("order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_lines_shipment_id_order_line_id_key" ON "shipment_lines"("shipment_id", "order_line_id");

-- CreateIndex
CREATE INDEX "shipment_line_serials_serial_unit_id_idx" ON "shipment_line_serials"("serial_unit_id");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivered_by_id_fkey" FOREIGN KEY ("delivered_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_line_serials" ADD CONSTRAINT "shipment_line_serials_shipment_line_id_fkey" FOREIGN KEY ("shipment_line_id") REFERENCES "shipment_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_line_serials" ADD CONSTRAINT "shipment_line_serials_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK, unique có điều kiện và trigger (viết tay)
-- ============================================================

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
-- Đơn vị vận chuyển chỉ có khi gửi vận chuyển, và bắt buộc khi đó
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_by_method"
  CHECK (("method" = 'CARRIER') = ("carrier" IS NOT NULL));
-- Đã rời showroom qua vận chuyển thì phải có mã vận đơn
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tracking_when_shipped" CHECK (
  "method" <> 'CARRIER'
  OR "status" NOT IN ('IN_TRANSIT', 'DELIVERED', 'RETURNED')
  OR "tracking_code" IS NOT NULL
);
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivered_by_own_only"
  CHECK ("delivered_by_id" IS NULL OR "method" = 'OWN_DELIVERY');
-- Tiền thu hộ
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cod_values" CHECK (
  "cod_amount" >= 0
  AND ("cod_collected_amount" IS NULL OR "cod_collected_amount" >= 0)
  AND ("carrier_fee" IS NULL OR "carrier_fee" >= 0)
);
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cod_collected_pair"
  CHECK (("cod_collected_amount" IS NULL) = ("cod_collected_at" IS NULL));
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_no_cod_on_pickup"
  CHECK ("method" <> 'CUSTOMER_PICKUP' OR "cod_amount" = 0);
-- Thời điểm khớp trạng thái
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivered_at_matches"
  CHECK (("status" = 'DELIVERED') = ("delivered_at" IS NOT NULL));
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cancelled_at_matches"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_failed_reason"
  CHECK ("status" <> 'FAILED' OR "failed_reason" IS NOT NULL);
-- Một mã vận đơn chỉ thuộc một lần giao của mỗi đơn vị vận chuyển
CREATE UNIQUE INDEX "shipments_carrier_tracking_key" ON "shipments" ("carrier", "tracking_code")
  WHERE "tracking_code" IS NOT NULL;

ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_quantity_positive" CHECK ("quantity" > 0);

-- ----- Trigger: tự cập nhật order_lines.quantity_shipped -----

-- Thêm hoặc xóa dòng giao
CREATE FUNCTION "shipment_lines_track_quantity"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_id  uuid;
  v_status    shipment_status;
  v_line_order uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT "order_id", "status" INTO v_order_id, v_status FROM "shipments" WHERE "id" = NEW."shipment_id";
    SELECT "order_id" INTO v_line_order FROM "order_lines" WHERE "id" = NEW."order_line_id";

    IF v_line_order IS DISTINCT FROM v_order_id THEN
      RAISE EXCEPTION 'Dòng đơn % không thuộc đơn hàng của lần giao %', NEW."order_line_id", NEW."shipment_id"
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Không thể thêm dòng vào lần giao đã hủy %', NEW."shipment_id"
        USING ERRCODE = 'check_violation';
    END IF;

    -- Nếu vượt số lượng đặt, CHECK order_lines_amounts sẽ chặn
    UPDATE "order_lines" SET "quantity_shipped" = "quantity_shipped" + NEW."quantity"
      WHERE "id" = NEW."order_line_id";
    RETURN NEW;
  END IF;

  -- DELETE: chỉ trừ lại nếu lần giao chưa bị hủy (hủy đã trừ rồi).
  -- Khi xóa cả lần giao (cascade), dòng shipments không còn nên v_status là NULL.
  SELECT "status" INTO v_status FROM "shipments" WHERE "id" = OLD."shipment_id";
  IF v_status IS DISTINCT FROM 'CANCELLED' THEN
    UPDATE "order_lines" SET "quantity_shipped" = "quantity_shipped" - OLD."quantity"
      WHERE "id" = OLD."order_line_id";
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "shipment_lines_quantity_insert"
  BEFORE INSERT ON "shipment_lines"
  FOR EACH ROW EXECUTE FUNCTION "shipment_lines_track_quantity"();
CREATE TRIGGER "shipment_lines_quantity_delete"
  AFTER DELETE ON "shipment_lines"
  FOR EACH ROW EXECUTE FUNCTION "shipment_lines_track_quantity"();
-- Không cho sửa dòng giao (muốn sửa: xóa rồi thêm lại)
CREATE TRIGGER "shipment_lines_no_update"
  BEFORE UPDATE ON "shipment_lines"
  FOR EACH ROW EXECUTE FUNCTION "forbid_modification"();

-- Hủy lần giao: trả lại số lượng; không cho mở lại lần giao đã hủy
CREATE FUNCTION "shipments_on_status_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'CANCELLED' AND NEW."status" <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Lần giao % đã hủy, không thể mở lại', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."status" = 'CANCELLED' AND OLD."status" <> 'CANCELLED' THEN
    UPDATE "order_lines" ol
      SET "quantity_shipped" = ol."quantity_shipped" - sl."quantity"
      FROM "shipment_lines" sl
      WHERE sl."shipment_id" = NEW."id" AND ol."id" = sl."order_line_id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "shipments_status_change"
  AFTER UPDATE OF "status" ON "shipments"
  FOR EACH ROW EXECUTE FUNCTION "shipments_on_status_change"();

-- Không cho chuyển lần giao sang đơn hàng khác
CREATE FUNCTION "shipments_order_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."order_id" <> OLD."order_id" THEN
    RAISE EXCEPTION 'Không được đổi đơn hàng của lần giao %', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "shipments_order_fixed"
  BEFORE UPDATE OF "order_id" ON "shipments"
  FOR EACH ROW EXECUTE FUNCTION "shipments_order_immutable"();
