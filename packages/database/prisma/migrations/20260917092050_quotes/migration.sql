/*
  Warnings:

  - A unique constraint covering the columns `[quote_id]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "quote_send_channel" AS ENUM ('ZALO', 'EMAIL', 'OTHER');

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "quote_line_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "quote_id" UUID;

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "previous_revision_id" UUID,
    "status" "quote_status" NOT NULL DEFAULT 'DRAFT',
    "customer_id" UUID NOT NULL,
    "contact_id" UUID,
    "project_name" VARCHAR(255),
    "site_address" TEXT,
    "site_region" "region",
    "valid_until" DATE NOT NULL,
    "vat_invoice_requested" BOOLEAN NOT NULL DEFAULT true,
    "reference_subtotal" BIGINT NOT NULL DEFAULT 0,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "shipping_fee" BIGINT NOT NULL DEFAULT 0,
    "vat_total" BIGINT NOT NULL DEFAULT 0,
    "grand_total" BIGINT NOT NULL DEFAULT 0,
    "deposit_required" BIGINT NOT NULL DEFAULT 0,
    "max_discount_bps" INTEGER NOT NULL DEFAULT 0,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "approval_note" TEXT,
    "pdf_url" TEXT,
    "pdf_generated_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "sent_via" "quote_send_channel",
    "sent_by_id" UUID,
    "terms" TEXT,
    "internal_note" TEXT,
    "rejected_reason" TEXT,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "accepted_at" TIMESTAMPTZ(3),
    "converted_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "parent_line_id" UUID,
    "line_type" "order_line_type" NOT NULL,
    "variant_id" UUID,
    "sku" VARCHAR(64),
    "name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_price" BIGINT NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "discount_bps" INTEGER NOT NULL,
    "line_total" BIGINT NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "installation_class_id" UUID,
    "installation_region" "region",
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_previous_revision_id_key" ON "quotes"("previous_revision_id");

-- CreateIndex
CREATE INDEX "quotes_customer_id_idx" ON "quotes"("customer_id");

-- CreateIndex
CREATE INDEX "quotes_status_valid_until_idx" ON "quotes"("status", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_code_revision_key" ON "quotes"("code", "revision");

-- CreateIndex
CREATE INDEX "quote_lines_quote_id_sort_order_idx" ON "quote_lines"("quote_id", "sort_order");

-- CreateIndex
CREATE INDEX "quote_lines_variant_id_idx" ON "quote_lines"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_quote_id_key" ON "orders"("quote_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_previous_revision_id_fkey" FOREIGN KEY ("previous_revision_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_parent_line_id_fkey" FOREIGN KEY ("parent_line_id") REFERENCES "quote_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_installation_class_id_fkey" FOREIGN KEY ("installation_class_id") REFERENCES "installation_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK, unique có điều kiện và trigger (viết tay)
-- ============================================================

-- ----- Báo giá -----
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_revision_positive" CHECK ("revision" >= 1);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_revision_chain"
  CHECK (("revision" = 1) = ("previous_revision_id" IS NULL));
-- Mỗi mã chỉ có MỘT phiên bản đang hiệu lực
CREATE UNIQUE INDEX "quotes_one_current_revision" ON "quotes" ("code")
  WHERE "status" NOT IN ('SUPERSEDED', 'CANCELLED');

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_amounts" CHECK (
  "reference_subtotal" >= 0 AND "subtotal" >= 0 AND "shipping_fee" >= 0
  AND "vat_total" >= 0 AND "grand_total" >= 0
  AND "grand_total" = "subtotal" + "shipping_fee" + "vat_total"
  AND "deposit_required" BETWEEN 0 AND "grand_total"
);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vat_only_when_invoiced"
  CHECK ("vat_invoice_requested" OR "vat_total" = 0);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_max_discount_range"
  CHECK ("max_discount_bps" BETWEEN -10000 AND 10000);

-- Duyệt: người duyệt và thời điểm đi cùng nhau; cần duyệt thì phải duyệt xong mới được gửi
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approval_pair"
  CHECK (("approved_by_id" IS NULL) = ("approved_at" IS NULL));
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_before_send" CHECK (
  NOT "requires_approval"
  OR "status" IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED', 'SUPERSEDED')
  OR "approved_at" IS NOT NULL
);

-- Đã gửi thì phải có thông tin gửi và file PDF
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sent_fields" CHECK (
  "status" NOT IN ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED')
  OR ("sent_at" IS NOT NULL AND "sent_via" IS NOT NULL AND "pdf_url" IS NOT NULL)
);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accepted_at_matches"
  CHECK ("status" NOT IN ('ACCEPTED', 'CONVERTED') OR "accepted_at" IS NOT NULL);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_at_matches"
  CHECK (("status" = 'CONVERTED') = ("converted_at" IS NOT NULL));
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cancelled_at_matches"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rejected_reason"
  CHECK ("status" <> 'REJECTED' OR "rejected_reason" IS NOT NULL);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_version_positive" CHECK ("version" >= 1);

-- ----- Dòng báo giá -----
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_amounts" CHECK (
  "quantity" > 0
  AND "reference_price" >= 0 AND "unit_price" >= 0
  AND "line_total" = "unit_price" * "quantity"
  AND "discount_bps" BETWEEN -10000 AND 10000
  AND "vat_rate_bps" BETWEEN 0 AND 10000
  AND "vat_amount" >= 0
);
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_allowed_types"
  CHECK ("line_type" IN ('PRODUCT', 'BUNDLE', 'INSTALLATION'));
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_variant_by_type" CHECK (
  CASE "line_type"
    WHEN 'INSTALLATION' THEN "variant_id" IS NULL AND "parent_line_id" IS NOT NULL
      AND "installation_class_id" IS NOT NULL AND "installation_region" IS NOT NULL
    ELSE "variant_id" IS NOT NULL AND "parent_line_id" IS NULL
  END
);

-- ----- Liên kết với đơn hàng -----
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_requires_project_channel"
  CHECK ("quote_id" IS NULL OR "channel" = 'PROJECT');
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quote_source_link"
  CHECK ("price_source" <> 'QUOTE' OR "quote_line_id" IS NOT NULL);

-- ----- Trigger: dòng báo giá chỉ sửa được khi báo giá còn DRAFT -----
CREATE FUNCTION "quote_lines_only_in_draft"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_quote_id uuid := COALESCE(NEW."quote_id", OLD."quote_id");
  v_status   quote_status;
BEGIN
  SELECT "status" INTO v_status FROM "quotes" WHERE "id" = v_quote_id;
  -- v_status NULL: báo giá đang bị xóa (cascade), cho phép
  IF v_status IS NOT NULL AND v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Báo giá % đang ở trạng thái %, không được sửa dòng (hãy tạo phiên bản mới)', v_quote_id, v_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."quote_id" <> OLD."quote_id" THEN
    RAISE EXCEPTION 'Không được chuyển dòng sang báo giá khác' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "quote_lines_draft_only"
  BEFORE INSERT OR UPDATE OR DELETE ON "quote_lines"
  FOR EACH ROW EXECUTE FUNCTION "quote_lines_only_in_draft"();
