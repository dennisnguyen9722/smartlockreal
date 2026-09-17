-- CreateEnum
CREATE TYPE "sales_channel" AS ENUM ('WEBSITE', 'ZALO', 'STORE', 'PROJECT');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'FULFILLING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "fulfillment_type" AS ENUM ('TAKE_AWAY', 'DELIVERY', 'STORE_PICKUP');

-- CreateEnum
CREATE TYPE "vat_mode" AS ENUM ('EXCLUSIVE_ON_REQUEST', 'INCLUSIVE');

-- CreateEnum
CREATE TYPE "order_line_type" AS ENUM ('PRODUCT', 'BUNDLE', 'BUNDLE_COMPONENT', 'INSTALLATION', 'GIFT');

-- CreateEnum
CREATE TYPE "price_source" AS ENUM ('RETAIL', 'REGION', 'GROUP_PERCENT', 'GROUP_FIXED', 'QUANTITY_TIER', 'FLASH_SALE', 'QUOTE', 'INSTALLATION_RATE', 'MANUAL', 'ZERO');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'COD', 'BANK_TRANSFER', 'VNPAY');

-- CreateEnum
CREATE TYPE "payment_purpose" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'REFUND');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "bank_match_status" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "vat_rate_bps" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "document_sequences" (
    "prefix" VARCHAR(10) NOT NULL,
    "period_key" VARCHAR(8) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("prefix","period_key")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "channel" "sales_channel" NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "fulfillment_type" "fulfillment_type" NOT NULL,
    "customer_id" UUID,
    "customer_name" VARCHAR(200),
    "customer_phone" VARCHAR(16),
    "fulfillment_location_id" UUID,
    "ship_recipient_name" VARCHAR(200),
    "ship_recipient_phone" VARCHAR(16),
    "ship_province_code" VARCHAR(10),
    "ship_province_name" VARCHAR(100),
    "ship_ward_code" VARCHAR(10),
    "ship_ward_name" VARCHAR(100),
    "ship_street" TEXT,
    "ship_region" "region",
    "vat_mode" "vat_mode" NOT NULL DEFAULT 'EXCLUSIVE_ON_REQUEST',
    "vat_invoice_requested" BOOLEAN NOT NULL DEFAULT false,
    "invoice_buyer_name" VARCHAR(200),
    "invoice_company_name" VARCHAR(255),
    "invoice_tax_code" VARCHAR(20),
    "invoice_address" TEXT,
    "invoice_email" VARCHAR(200),
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discount_total" BIGINT NOT NULL DEFAULT 0,
    "shipping_fee" BIGINT NOT NULL DEFAULT 0,
    "vat_total" BIGINT NOT NULL DEFAULT 0,
    "grand_total" BIGINT NOT NULL DEFAULT 0,
    "paid_total" BIGINT NOT NULL DEFAULT 0,
    "deposit_required" BIGINT NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(64),
    "customer_note" TEXT,
    "internal_note" TEXT,
    "needs_attention" BOOLEAN NOT NULL DEFAULT false,
    "attention_reason" VARCHAR(200),
    "placed_ip" INET,
    "user_agent" VARCHAR(500),
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "parent_line_id" UUID,
    "line_type" "order_line_type" NOT NULL,
    "variant_id" UUID,
    "sku" VARCHAR(64),
    "name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "list_price" BIGINT NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "price_source" "price_source" NOT NULL,
    "sale_campaign_item_id" UUID,
    "line_subtotal" BIGINT NOT NULL,
    "discount_allocated" BIGINT NOT NULL DEFAULT 0,
    "line_total" BIGINT NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "installation_class_id" UUID,
    "installation_region" "region",
    "quantity_shipped" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "note" TEXT,
    "staff_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "purpose" "payment_purpose" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "transfer_content" VARCHAR(40),
    "provider_txn_ref" VARCHAR(64),
    "provider_transaction_no" VARCHAR(64),
    "provider_response_code" VARCHAR(10),
    "expires_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "received_by_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(30),
    "amount" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "transacted_at" TIMESTAMPTZ(3) NOT NULL,
    "match_status" "bank_match_status" NOT NULL DEFAULT 'UNMATCHED',
    "matched_payment_id" UUID,
    "matched_by_id" UUID,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "event_key" VARCHAR(200) NOT NULL,
    "payment_id" UUID,
    "signature_valid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "result" VARCHAR(40),
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_customer_phone_idx" ON "orders"("customer_phone");

-- CreateIndex
CREATE INDEX "orders_channel_placed_at_idx" ON "orders"("channel", "placed_at");

-- CreateIndex
CREATE INDEX "order_lines_order_id_idx" ON "order_lines"("order_id");

-- CreateIndex
CREATE INDEX "order_lines_variant_id_idx" ON "order_lines"("variant_id");

-- CreateIndex
CREATE INDEX "order_lines_parent_line_id_idx" ON "order_lines"("parent_line_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transfer_content_key" ON "payments"("transfer_content");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_txn_ref_key" ON "payments"("provider_txn_ref");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_expires_at_idx" ON "payments"("status", "expires_at");

-- CreateIndex
CREATE INDEX "bank_transactions_match_status_transacted_at_idx" ON "bank_transactions"("match_status", "transacted_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_provider_external_id_key" ON "bank_transactions"("provider", "external_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_payment_id_idx" ON "payment_webhook_events"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_key_key" ON "payment_webhook_events"("provider", "event_key");

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillment_location_id_fkey" FOREIGN KEY ("fulfillment_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_parent_line_id_fkey" FOREIGN KEY ("parent_line_id") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_sale_campaign_item_id_fkey" FOREIGN KEY ("sale_campaign_item_id") REFERENCES "sale_campaign_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_installation_class_id_fkey" FOREIGN KEY ("installation_class_id") REFERENCES "installation_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_payment_id_fkey" FOREIGN KEY ("matched_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_by_id_fkey" FOREIGN KEY ("matched_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK, unique có điều kiện, trigger, hàm sinh mã (viết tay)
-- ============================================================

-- Biến thể: thuế suất hợp lệ
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_vat_rate_range"
  CHECK ("vat_rate_bps" BETWEEN 0 AND 10000);

-- ----- Đơn hàng -----
ALTER TABLE "orders" ADD CONSTRAINT "orders_code_format" CHECK ("code" ~ '^[A-Z]+-[A-Z0-9-]+$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative" CHECK (
  "subtotal" >= 0 AND "discount_total" >= 0 AND "shipping_fee" >= 0
  AND "vat_total" >= 0 AND "grand_total" >= 0 AND "paid_total" >= 0
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_formula"
  CHECK ("grand_total" = "subtotal" - "discount_total" + "shipping_fee" + "vat_total");
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_le_subtotal" CHECK ("discount_total" <= "subtotal");
ALTER TABLE "orders" ADD CONSTRAINT "orders_paid_le_total" CHECK ("paid_total" <= "grand_total");
ALTER TABLE "orders" ADD CONSTRAINT "orders_deposit_range"
  CHECK ("deposit_required" BETWEEN 0 AND "grand_total");
-- Chế độ hiện tại: không lấy hóa đơn thì không có VAT
ALTER TABLE "orders" ADD CONSTRAINT "orders_vat_only_when_invoiced"
  CHECK ("vat_mode" <> 'EXCLUSIVE_ON_REQUEST' OR "vat_invoice_requested" OR "vat_total" = 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_requires_buyer"
  CHECK (NOT "vat_invoice_requested" OR "invoice_buyer_name" IS NOT NULL);
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_tax_code_format"
  CHECK ("invoice_tax_code" IS NULL OR "invoice_tax_code" ~ '^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_email_lowercase"
  CHECK ("invoice_email" IS NULL OR "invoice_email" = lower("invoice_email"));
-- Khách: chỉ được trống khi mua mang về
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_required"
  CHECK ("fulfillment_type" = 'TAKE_AWAY' OR ("customer_id" IS NOT NULL AND "customer_phone" IS NOT NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_phone_format" CHECK (
  ("customer_phone" IS NULL OR "customer_phone" ~ '^\+84[0-9]{9,10}$')
  AND ("ship_recipient_phone" IS NULL OR "ship_recipient_phone" ~ '^\+84[0-9]{9,10}$')
);
-- Giao hàng phải có đủ địa chỉ; nhận tại showroom phải có showroom
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_requires_address" CHECK (
  "fulfillment_type" <> 'DELIVERY' OR (
    "ship_recipient_name" IS NOT NULL AND "ship_recipient_phone" IS NOT NULL
    AND "ship_province_code" IS NOT NULL AND "ship_province_name" IS NOT NULL
    AND "ship_ward_code" IS NOT NULL AND "ship_ward_name" IS NOT NULL
    AND "ship_street" IS NOT NULL
  )
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_requires_location"
  CHECK ("fulfillment_type" = 'DELIVERY' OR "fulfillment_location_id" IS NOT NULL);
-- Thời điểm khớp trạng thái
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_at_matches"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_completed_at_matches"
  CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_attention_reason"
  CHECK (NOT "needs_attention" OR "attention_reason" IS NOT NULL);
ALTER TABLE "orders" ADD CONSTRAINT "orders_version_positive" CHECK ("version" >= 1);

-- ----- Dòng đơn -----
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_amounts" CHECK (
  "quantity" > 0
  AND "list_price" >= 0 AND "unit_price" >= 0
  AND "line_subtotal" = "unit_price" * "quantity"
  AND "discount_allocated" BETWEEN 0 AND "line_subtotal"
  AND "line_total" = "line_subtotal" - "discount_allocated"
  AND "vat_rate_bps" BETWEEN 0 AND 10000
  AND "vat_amount" >= 0
  AND "quantity_shipped" BETWEEN 0 AND "quantity"
);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_by_type" CHECK (
  CASE "line_type"
    WHEN 'INSTALLATION' THEN "variant_id" IS NULL AND "parent_line_id" IS NOT NULL
      AND "installation_class_id" IS NOT NULL AND "installation_region" IS NOT NULL
    WHEN 'BUNDLE_COMPONENT' THEN "variant_id" IS NOT NULL AND "parent_line_id" IS NOT NULL
    ELSE "variant_id" IS NOT NULL
  END
);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_zero_price_types"
  CHECK ("line_type" NOT IN ('BUNDLE_COMPONENT', 'GIFT') OR ("unit_price" = 0 AND "price_source" = 'ZERO'));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_flash_sale_link"
  CHECK (("price_source" = 'FLASH_SALE') = ("sale_campaign_item_id" IS NOT NULL));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_not_self_parent"
  CHECK ("parent_line_id" IS NULL OR "parent_line_id" <> "id");

-- ----- Thanh toán -----
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_at_matches"
  CHECK (("status" = 'SUCCEEDED') = ("paid_at" IS NOT NULL));
ALTER TABLE "payments" ADD CONSTRAINT "payments_vnpay_fields"
  CHECK ("method" <> 'VNPAY' OR ("provider_txn_ref" IS NOT NULL AND "expires_at" IS NOT NULL));
ALTER TABLE "payments" ADD CONSTRAINT "payments_transfer_fields"
  CHECK ("method" <> 'BANK_TRANSFER' OR "purpose" = 'REFUND' OR "transfer_content" IS NOT NULL);
ALTER TABLE "payments" ADD CONSTRAINT "payments_transfer_content_format"
  CHECK ("transfer_content" IS NULL OR "transfer_content" ~ '^[A-Z0-9 ]+$');
ALTER TABLE "payments" ADD CONSTRAINT "payments_no_cod_refund"
  CHECK (NOT ("method" = 'COD' AND "purpose" = 'REFUND'));
-- Mỗi đơn tối đa một phiên VNPay đang chờ
CREATE UNIQUE INDEX "payments_one_pending_vnpay" ON "payments" ("order_id")
  WHERE "method" = 'VNPAY' AND "status" = 'PENDING';

-- ----- Giao dịch ngân hàng -----
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_amount_non_zero" CHECK ("amount" <> 0);
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_match_consistency"
  CHECK (("match_status" = 'MATCHED') = ("matched_payment_id" IS NOT NULL));

-- ----- Mã chứng từ -----
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_values"
  CHECK ("prefix" ~ '^[A-Z]+$' AND "period_key" ~ '^[0-9]+$' AND "last_value" >= 0);

-- Lấy số tiếp theo một cách an toàn khi nhiều người tạo cùng lúc
-- Ví dụ: SELECT next_document_number('DH', '260917'); -> 1, 2, 3...
CREATE FUNCTION "next_document_number"(p_prefix text, p_period text) RETURNS integer
LANGUAGE sql AS $$
  INSERT INTO "document_sequences" ("prefix", "period_key", "last_value", "updated_at")
  VALUES (p_prefix, p_period, 1, now())
  ON CONFLICT ("prefix", "period_key")
  DO UPDATE SET "last_value" = "document_sequences"."last_value" + 1, "updated_at" = now()
  RETURNING "last_value";
$$;

-- ----- Bảng bất biến dùng chung -----
CREATE FUNCTION "forbid_modification"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% là bảng bất biến: không được % dữ liệu', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "order_status_history_no_update_delete"
  BEFORE UPDATE OR DELETE ON "order_status_history"
  FOR EACH ROW EXECUTE FUNCTION "forbid_modification"();
CREATE TRIGGER "order_status_history_no_truncate"
  BEFORE TRUNCATE ON "order_status_history"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_modification"();
