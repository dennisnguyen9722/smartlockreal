-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "customer_source" AS ENUM ('WEBSITE', 'ZALO', 'STORE', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('SUPER_ADMIN', 'SALE_STAFF');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "type" "customer_type" NOT NULL DEFAULT 'INDIVIDUAL',
    "group_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(16),
    "email" VARCHAR(200),
    "company_name" VARCHAR(255),
    "tax_code" VARCHAR(20),
    "invoice_address" TEXT,
    "assigned_staff_id" UUID,
    "source" "customer_source" NOT NULL DEFAULT 'WEBSITE',
    "note" TEXT,
    "privacy_consent_at" TIMESTAMPTZ(3),
    "privacy_policy_version" VARCHAR(20),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "recipient_name" VARCHAR(200) NOT NULL,
    "recipient_phone" VARCHAR(16) NOT NULL,
    "province_code" VARCHAR(10) NOT NULL,
    "province_name" VARCHAR(100) NOT NULL,
    "ward_code" VARCHAR(10) NOT NULL,
    "ward_name" VARCHAR(100) NOT NULL,
    "street" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(16),
    "email" VARCHAR(200),
    "position" VARCHAR(120),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(16),
    "password_hash" TEXT NOT NULL,
    "role" "staff_role" NOT NULL DEFAULT 'SALE_STAFF',
    "status" "staff_status" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "family_id" UUID NOT NULL,
    "replaced_by_id" UUID,
    "user_agent" VARCHAR(500),
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_code_key" ON "customer_groups"("code");

-- CreateIndex
CREATE INDEX "customers_group_id_idx" ON "customers"("group_id");

-- CreateIndex
CREATE INDEX "customers_assigned_staff_id_idx" ON "customers"("assigned_staff_id");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE INDEX "customer_contacts_customer_id_idx" ON "customer_contacts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_id_idx" ON "staff_sessions"("staff_id");

-- CreateIndex
CREATE INDEX "staff_sessions_family_id_idx" ON "staff_sessions"("family_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "customer_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Unique có điều kiện và CHECK (viết tay)
-- ============================================================

-- Khách hàng
CREATE UNIQUE INDEX "customers_individual_phone_key" ON "customers" ("phone") WHERE "type" = 'INDIVIDUAL';
CREATE UNIQUE INDEX "customers_business_tax_code_key" ON "customers" ("tax_code")
  WHERE "type" = 'BUSINESS' AND "tax_code" IS NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_format"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+84[0-9]{9,10}$');
ALTER TABLE "customers" ADD CONSTRAINT "customers_individual_requires_phone"
  CHECK ("type" <> 'INDIVIDUAL' OR "phone" IS NOT NULL);
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_requires_company"
  CHECK ("type" <> 'BUSINESS' OR "company_name" IS NOT NULL);
-- Mã số thuế doanh nghiệp (10 số, chi nhánh 10-3) hoặc hộ kinh doanh (12 số CCCD)
ALTER TABLE "customers" ADD CONSTRAINT "customers_tax_code_format"
  CHECK ("tax_code" IS NULL OR "tax_code" ~ '^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$');
ALTER TABLE "customers" ADD CONSTRAINT "customers_email_lowercase"
  CHECK ("email" IS NULL OR "email" = lower("email"));
ALTER TABLE "customers" ADD CONSTRAINT "customers_consent_pair"
  CHECK (("privacy_consent_at" IS NULL) = ("privacy_policy_version" IS NULL));

-- Tối đa một nhóm mặc định; mỗi khách tối đa một địa chỉ mặc định
CREATE UNIQUE INDEX "customer_groups_single_default" ON "customer_groups" ("is_default") WHERE "is_default";
CREATE UNIQUE INDEX "customer_addresses_single_default" ON "customer_addresses" ("customer_id") WHERE "is_default";
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_code_format" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_phone_format"
  CHECK ("recipient_phone" ~ '^\+84[0-9]{9,10}$');
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_phone_format"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+84[0-9]{9,10}$');

-- Nhân viên
ALTER TABLE "staff" ADD CONSTRAINT "staff_email_format"
  CHECK ("email" = lower("email") AND "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
ALTER TABLE "staff" ADD CONSTRAINT "staff_phone_format"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+84[0-9]{9,10}$');
ALTER TABLE "staff" ADD CONSTRAINT "staff_failed_login_non_negative" CHECK ("failed_login_count" >= 0);

-- Phiên đăng nhập
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_token_hash_format"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_revoke_pair"
  CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL));
