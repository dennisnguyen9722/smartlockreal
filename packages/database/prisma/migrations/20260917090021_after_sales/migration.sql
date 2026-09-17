-- CreateEnum
CREATE TYPE "service_job_type" AS ENUM ('INSTALLATION', 'WARRANTY_VISIT', 'REINSTALL');

-- CreateEnum
CREATE TYPE "service_job_status" AS ENUM ('PENDING_SCHEDULE', 'SCHEDULED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "warranty_status" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'REPLACED', 'VOIDED');

-- CreateEnum
CREATE TYPE "warranty_source" AS ENUM ('INSTALLATION', 'DELIVERY', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "claim_status" AS ENUM ('RECEIVED', 'INSPECTING', 'REPAIRING', 'AT_VENDOR', 'RESOLVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "inspection_result" AS ENUM ('MANUFACTURER_DEFECT', 'USER_DAMAGE', 'NO_FAULT');

-- CreateEnum
CREATE TYPE "claim_resolution" AS ENUM ('EXCHANGED', 'REPAIRED', 'VENDOR_REPAIRED', 'VENDOR_REPLACED', 'NO_FAULT_FOUND', 'REJECTED');

-- CreateEnum
CREATE TYPE "vendor_return_status" AS ENUM ('DRAFT', 'SENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "vendor_return_outcome" AS ENUM ('PENDING', 'REPAIRED', 'REPLACED', 'REFUNDED', 'REJECTED');

-- CreateTable
CREATE TABLE "technicians" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "region" "region" NOT NULL,
    "home_location_id" UUID,
    "staff_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_jobs" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "job_type" "service_job_type" NOT NULL,
    "status" "service_job_status" NOT NULL DEFAULT 'PENDING_SCHEDULE',
    "order_id" UUID,
    "order_line_id" UUID,
    "warranty_claim_id" UUID,
    "region" "region" NOT NULL,
    "contact_name" VARCHAR(200) NOT NULL,
    "contact_phone" VARCHAR(16) NOT NULL,
    "address" TEXT NOT NULL,
    "scheduled_start" TIMESTAMPTZ(3),
    "scheduled_end" TIMESTAMPTZ(3),
    "result_note" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "failed_reason" TEXT,
    "cancel_reason" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_job_technicians" (
    "job_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_start" TIMESTAMPTZ(3),
    "scheduled_end" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "service_job_technicians_pkey" PRIMARY KEY ("job_id","technician_id")
);

-- CreateTable
CREATE TABLE "service_job_serials" (
    "job_id" UUID NOT NULL,
    "serial_unit_id" UUID NOT NULL,

    CONSTRAINT "service_job_serials_pkey" PRIMARY KEY ("job_id","serial_unit_id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" UUID NOT NULL,
    "serial_unit_id" UUID NOT NULL,
    "order_id" UUID,
    "order_line_id" UUID,
    "customer_id" UUID,
    "phone" VARCHAR(16),
    "months" INTEGER NOT NULL,
    "status" "warranty_status" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "source" "warranty_source" NOT NULL,
    "starts_on" DATE,
    "ends_on" DATE,
    "activated_at" TIMESTAMPTZ(3),
    "activated_by_job_id" UUID,
    "previous_warranty_id" UUID,
    "voided_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "warranty_id" UUID NOT NULL,
    "serial_unit_id" UUID NOT NULL,
    "customer_id" UUID,
    "contact_name" VARCHAR(200) NOT NULL,
    "contact_phone" VARCHAR(16) NOT NULL,
    "issue_description" TEXT NOT NULL,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "status" "claim_status" NOT NULL DEFAULT 'RECEIVED',
    "received_location_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "within_exchange_window" BOOLEAN NOT NULL,
    "inspection_result" "inspection_result",
    "inspection_note" TEXT,
    "inspected_at" TIMESTAMPTZ(3),
    "resolution" "claim_resolution",
    "replacement_serial_unit_id" UUID,
    "replacement_warranty_id" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_returns" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "from_location_id" UUID NOT NULL,
    "status" "vendor_return_status" NOT NULL DEFAULT 'DRAFT',
    "tracking_code" VARCHAR(60),
    "note" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vendor_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_return_items" (
    "id" UUID NOT NULL,
    "vendor_return_id" UUID NOT NULL,
    "serial_unit_id" UUID NOT NULL,
    "warranty_claim_id" UUID,
    "outcome" "vendor_return_outcome" NOT NULL DEFAULT 'PENDING',
    "replacement_serial_unit_id" UUID,
    "refund_amount" BIGINT,
    "resolved_at" TIMESTAMPTZ(3),
    "note" TEXT,

    CONSTRAINT "vendor_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technicians_staff_id_key" ON "technicians"("staff_id");

-- CreateIndex
CREATE INDEX "technicians_region_is_active_idx" ON "technicians"("region", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_jobs_code_key" ON "service_jobs"("code");

-- CreateIndex
CREATE INDEX "service_jobs_status_scheduled_start_idx" ON "service_jobs"("status", "scheduled_start");

-- CreateIndex
CREATE INDEX "service_jobs_region_scheduled_start_idx" ON "service_jobs"("region", "scheduled_start");

-- CreateIndex
CREATE INDEX "service_jobs_order_id_idx" ON "service_jobs"("order_id");

-- CreateIndex
CREATE INDEX "service_jobs_order_line_id_idx" ON "service_jobs"("order_line_id");

-- CreateIndex
CREATE INDEX "service_jobs_warranty_claim_id_idx" ON "service_jobs"("warranty_claim_id");

-- CreateIndex
CREATE INDEX "service_job_technicians_technician_id_is_active_idx" ON "service_job_technicians"("technician_id", "is_active");

-- CreateIndex
CREATE INDEX "service_job_serials_serial_unit_id_idx" ON "service_job_serials"("serial_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_previous_warranty_id_key" ON "warranties"("previous_warranty_id");

-- CreateIndex
CREATE INDEX "warranties_serial_unit_id_idx" ON "warranties"("serial_unit_id");

-- CreateIndex
CREATE INDEX "warranties_phone_idx" ON "warranties"("phone");

-- CreateIndex
CREATE INDEX "warranties_customer_id_idx" ON "warranties"("customer_id");

-- CreateIndex
CREATE INDEX "warranties_order_id_idx" ON "warranties"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_code_key" ON "warranty_claims"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_replacement_warranty_id_key" ON "warranty_claims"("replacement_warranty_id");

-- CreateIndex
CREATE INDEX "warranty_claims_warranty_id_idx" ON "warranty_claims"("warranty_id");

-- CreateIndex
CREATE INDEX "warranty_claims_serial_unit_id_idx" ON "warranty_claims"("serial_unit_id");

-- CreateIndex
CREATE INDEX "warranty_claims_status_received_at_idx" ON "warranty_claims"("status", "received_at");

-- CreateIndex
CREATE INDEX "warranty_claims_contact_phone_idx" ON "warranty_claims"("contact_phone");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_returns_code_key" ON "vendor_returns"("code");

-- CreateIndex
CREATE INDEX "vendor_returns_status_sent_at_idx" ON "vendor_returns"("status", "sent_at");

-- CreateIndex
CREATE INDEX "vendor_return_items_serial_unit_id_idx" ON "vendor_return_items"("serial_unit_id");

-- CreateIndex
CREATE INDEX "vendor_return_items_warranty_claim_id_idx" ON "vendor_return_items"("warranty_claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_return_items_vendor_return_id_serial_unit_id_key" ON "vendor_return_items"("vendor_return_id", "serial_unit_id");

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_home_location_id_fkey" FOREIGN KEY ("home_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_warranty_claim_id_fkey" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_job_technicians" ADD CONSTRAINT "service_job_technicians_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_job_technicians" ADD CONSTRAINT "service_job_technicians_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_job_serials" ADD CONSTRAINT "service_job_serials_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_job_serials" ADD CONSTRAINT "service_job_serials_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_activated_by_job_id_fkey" FOREIGN KEY ("activated_by_job_id") REFERENCES "service_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_previous_warranty_id_fkey" FOREIGN KEY ("previous_warranty_id") REFERENCES "warranties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_received_location_id_fkey" FOREIGN KEY ("received_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_replacement_serial_unit_id_fkey" FOREIGN KEY ("replacement_serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_replacement_warranty_id_fkey" FOREIGN KEY ("replacement_warranty_id") REFERENCES "warranties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_vendor_return_id_fkey" FOREIGN KEY ("vendor_return_id") REFERENCES "vendor_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_warranty_claim_id_fkey" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_replacement_serial_unit_id_fkey" FOREIGN KEY ("replacement_serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK, EXCLUDE, unique có điều kiện và trigger (viết tay)
-- ============================================================

-- ----- Kỹ thuật viên -----
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_phone_format" CHECK ("phone" ~ '^\+84[0-9]{9,10}$');

-- ----- Lịch dịch vụ -----
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_phone_format" CHECK ("contact_phone" ~ '^\+84[0-9]{9,10}$');
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_links_by_type" CHECK (
  CASE "job_type"
    WHEN 'INSTALLATION' THEN "order_id" IS NOT NULL AND "order_line_id" IS NOT NULL
    ELSE "warranty_claim_id" IS NOT NULL
  END
);
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_schedule_pair"
  CHECK (("scheduled_start" IS NULL) = ("scheduled_end" IS NULL));
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_schedule_order"
  CHECK ("scheduled_end" IS NULL OR "scheduled_end" > "scheduled_start");
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_scheduled_has_time"
  CHECK ("status" NOT IN ('SCHEDULED', 'COMPLETED') OR "scheduled_start" IS NOT NULL);
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_completed_at_matches"
  CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_cancelled_at_matches"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_failed_reason"
  CHECK ("status" <> 'FAILED' OR "failed_reason" IS NOT NULL);
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_photos_is_array" CHECK (jsonb_typeof("photos") = 'array');
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_version_positive" CHECK ("version" >= 1);

-- Dòng đơn phải là dòng LẮP ĐẶT của đúng đơn hàng
CREATE FUNCTION "service_jobs_check_order_line"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_id uuid;
  v_type     order_line_type;
BEGIN
  IF NEW."order_line_id" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "order_id", "line_type" INTO v_order_id, v_type FROM "order_lines" WHERE "id" = NEW."order_line_id";
  IF v_order_id IS DISTINCT FROM NEW."order_id" OR v_type <> 'INSTALLATION' THEN
    RAISE EXCEPTION 'Dòng đơn % không phải dòng lắp đặt của đơn %', NEW."order_line_id", NEW."order_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "service_jobs_order_line_check"
  BEFORE INSERT OR UPDATE OF "order_id", "order_line_id" ON "service_jobs"
  FOR EACH ROW EXECUTE FUNCTION "service_jobs_check_order_line"();

-- ----- Phân công: chống trùng lịch kỹ thuật viên -----
CREATE UNIQUE INDEX "service_job_technicians_one_lead" ON "service_job_technicians" ("job_id") WHERE "is_lead";
ALTER TABLE "service_job_technicians" ADD CONSTRAINT "service_job_technicians_no_overlap"
  EXCLUDE USING gist ("technician_id" WITH =, tstzrange("scheduled_start", "scheduled_end", '[)') WITH &&)
  WHERE ("is_active");

CREATE FUNCTION "service_job_technicians_sync"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT j."scheduled_start", j."scheduled_end", j."status" = 'SCHEDULED'
    INTO NEW."scheduled_start", NEW."scheduled_end", NEW."is_active"
    FROM "service_jobs" j
    WHERE j."id" = NEW."job_id";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "service_job_technicians_sync_from_job"
  BEFORE INSERT OR UPDATE ON "service_job_technicians"
  FOR EACH ROW EXECUTE FUNCTION "service_job_technicians_sync"();

CREATE FUNCTION "service_jobs_propagate_schedule"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Lệnh UPDATE này kích hoạt trigger đồng bộ ở trên cho từng dòng phân công
  UPDATE "service_job_technicians" SET "job_id" = "job_id" WHERE "job_id" = NEW."id";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "service_jobs_propagate_to_technicians"
  AFTER UPDATE OF "status", "scheduled_start", "scheduled_end" ON "service_jobs"
  FOR EACH ROW EXECUTE FUNCTION "service_jobs_propagate_schedule"();

-- ----- Bảo hành -----
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_months_positive" CHECK ("months" > 0);
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_phone_format"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+84[0-9]{9,10}$');
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_dates_by_status" CHECK (
  CASE "status"
    WHEN 'PENDING_ACTIVATION' THEN "starts_on" IS NULL AND "ends_on" IS NULL AND "activated_at" IS NULL
    WHEN 'VOIDED' THEN "voided_reason" IS NOT NULL
    ELSE "starts_on" IS NOT NULL AND "ends_on" IS NOT NULL AND "activated_at" IS NOT NULL
  END
);
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_date_order"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_replacement_link"
  CHECK (("source" = 'REPLACEMENT') = ("previous_warranty_id" IS NOT NULL));
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_installation_job"
  CHECK ("source" <> 'INSTALLATION' OR "status" NOT IN ('ACTIVE', 'REPLACED') OR "activated_by_job_id" IS NOT NULL);
-- Mỗi serial tối đa một phiếu đang chờ hoặc đang hiệu lực
CREATE UNIQUE INDEX "warranties_one_open_per_serial" ON "warranties" ("serial_unit_id")
  WHERE "status" IN ('PENDING_ACTIVATION', 'ACTIVE');

-- ----- Yêu cầu bảo hành -----
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_phone_format" CHECK ("contact_phone" ~ '^\+84[0-9]{9,10}$');
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_photos_is_array" CHECK (jsonb_typeof("photos") = 'array');
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_version_positive" CHECK ("version" >= 1);
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_inspection_pair"
  CHECK (("inspection_result" IS NULL) = ("inspected_at" IS NULL));
-- Sửa, gửi hãng, kết thúc hay từ chối đều phải kiểm tra trước
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_inspected_before_action"
  CHECK ("status" IN ('RECEIVED', 'INSPECTING', 'CANCELLED') OR "inspection_result" IS NOT NULL);
-- Đóng yêu cầu thì phải có kết quả và thời điểm
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_resolution_matches" CHECK (
  ("status" IN ('RESOLVED', 'REJECTED')) = ("resolution" IS NOT NULL)
  AND ("status" IN ('RESOLVED', 'REJECTED')) = ("resolved_at" IS NOT NULL)
);
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_rejected_matches"
  CHECK (("status" = 'REJECTED') = COALESCE("resolution" = 'REJECTED', false));
-- Sửa hoặc đổi chỉ khi lỗi nhà sản xuất
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_fix_requires_defect" CHECK (
  COALESCE("resolution" IN ('EXCHANGED', 'REPAIRED', 'VENDOR_REPAIRED', 'VENDOR_REPLACED'), false) = false
  OR "inspection_result" = 'MANUFACTURER_DEFECT'
);
-- Đổi máy tại cửa hàng chỉ khi còn trong hạn đổi
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_exchange_window"
  CHECK (COALESCE("resolution" = 'EXCHANGED', false) = false OR "within_exchange_window");
-- Có máy thay thế khi và chỉ khi kết quả là đổi máy
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_replacement_serial" CHECK (
  COALESCE("resolution" IN ('EXCHANGED', 'VENDOR_REPLACED'), false) = ("replacement_serial_unit_id" IS NOT NULL)
);
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_replacement_differs"
  CHECK ("replacement_serial_unit_id" IS NULL OR "replacement_serial_unit_id" <> "serial_unit_id");
-- Mỗi serial tối đa một yêu cầu đang mở
CREATE UNIQUE INDEX "warranty_claims_one_open_per_serial" ON "warranty_claims" ("serial_unit_id")
  WHERE "status" NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED');

-- ----- Gửi trả hãng -----
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_sent_at"
  CHECK ("status" NOT IN ('SENT', 'COMPLETED') OR "sent_at" IS NOT NULL);
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_completed_at_matches"
  CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_cancelled_at_matches"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));

ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_resolved_matches"
  CHECK (("outcome" = 'PENDING') = ("resolved_at" IS NULL));
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_replacement_matches"
  CHECK (("outcome" = 'REPLACED') = ("replacement_serial_unit_id" IS NOT NULL));
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_refund_matches"
  CHECK (("outcome" = 'REFUNDED') = ("refund_amount" IS NOT NULL) AND ("refund_amount" IS NULL OR "refund_amount" > 0));
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_replacement_differs"
  CHECK ("replacement_serial_unit_id" IS NULL OR "replacement_serial_unit_id" <> "serial_unit_id");
-- Một máy chỉ nằm trong một phiếu gửi hãng đang chờ kết quả
CREATE UNIQUE INDEX "vendor_return_items_one_pending_per_serial" ON "vendor_return_items" ("serial_unit_id")
  WHERE "outcome" = 'PENDING';
