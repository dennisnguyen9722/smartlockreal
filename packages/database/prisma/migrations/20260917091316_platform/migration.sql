-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "banner_placement" AS ENUM ('HOME_HERO', 'HOME_SECONDARY', 'CATEGORY_TOP', 'POPUP');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "message_channel" AS ENUM ('EMAIL', 'ZALO_ZNS');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating_sum" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" VARCHAR(200),
    "checksum_sha256" CHAR(64),
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "excerpt" TEXT,
    "content_json" JSONB NOT NULL DEFAULT '{}',
    "content_html" TEXT NOT NULL DEFAULT '',
    "cover_media_id" UUID,
    "category_id" UUID,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "author_id" UUID,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(320),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_products" (
    "post_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_products_pkey" PRIMARY KEY ("post_id","product_id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content_json" JSONB NOT NULL DEFAULT '{}',
    "content_html" TEXT NOT NULL DEFAULT '',
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(320),
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content_html" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "placement" "banner_placement" NOT NULL,
    "desktop_media_id" UUID NOT NULL,
    "mobile_media_id" UUID,
    "link_url" VARCHAR(500),
    "alt_text" VARCHAR(200),
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "group_code" VARCHAR(40) NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "answer_html" TEXT NOT NULL,
    "product_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_redirects" (
    "id" UUID NOT NULL,
    "from_path" VARCHAR(500) NOT NULL,
    "to_path" VARCHAR(500) NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "url_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "customer_id" UUID,
    "reviewer_name" VARCHAR(100) NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "moderated_by_id" UUID,
    "moderated_at" TIMESTAMPTZ(3),
    "reject_reason" TEXT,
    "reply_content" TEXT,
    "replied_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "link" VARCHAR(500),
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "channel" "message_channel" NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "provider_template_id" VARCHAR(60),
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" UUID NOT NULL,
    "channel" "message_channel" NOT NULL,
    "template_code" VARCHAR(60) NOT NULL,
    "recipient" VARCHAR(200) NOT NULL,
    "customer_id" UUID,
    "order_id" UUID,
    "payload" JSONB NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" VARCHAR(200) NOT NULL,
    "provider_message_id" VARCHAR(100),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(40) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "dedupe_key" VARCHAR(200),
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "staff_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    "trace_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_checksum_sha256_idx" ON "media_assets"("checksum_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "post_categories_slug_key" ON "post_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_status_published_at_idx" ON "posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "posts_category_id_idx" ON "posts"("category_id");

-- CreateIndex
CREATE INDEX "post_products_product_id_idx" ON "post_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "policy_versions_code_effective_at_idx" ON "policy_versions"("code", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_code_version_key" ON "policy_versions"("code", "version");

-- CreateIndex
CREATE INDEX "banners_placement_is_active_sort_order_idx" ON "banners"("placement", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "faqs_group_code_sort_order_idx" ON "faqs"("group_code", "sort_order");

-- CreateIndex
CREATE INDEX "faqs_product_id_idx" ON "faqs"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "url_redirects_from_path_key" ON "url_redirects"("from_path");

-- CreateIndex
CREATE INDEX "url_redirects_to_path_idx" ON "url_redirects"("to_path");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_order_line_id_key" ON "product_reviews"("order_line_id");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_created_at_idx" ON "product_reviews"("product_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_status_created_at_idx" ON "product_reviews"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_token_hash_key" ON "review_requests"("token_hash");

-- CreateIndex
CREATE INDEX "review_requests_order_line_id_idx" ON "review_requests"("order_line_id");

-- CreateIndex
CREATE INDEX "staff_notifications_staff_id_read_at_created_at_idx" ON "staff_notifications"("staff_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_channel_code_key" ON "message_templates"("channel", "code");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_idempotency_key_key" ON "outbound_messages"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbound_messages_status_created_at_idx" ON "outbound_messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "outbound_messages_customer_id_idx" ON "outbound_messages"("customer_id");

-- CreateIndex
CREATE INDEX "outbound_messages_order_id_idx" ON "outbound_messages"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_staff_id_created_at_idx" ON "audit_logs"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "post_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_products" ADD CONSTRAINT "post_products_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_products" ADD CONSTRAINT "post_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_desktop_media_id_fkey" FOREIGN KEY ("desktop_media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_mobile_media_id_fkey" FOREIGN KEY ("mobile_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_redirects" ADD CONSTRAINT "url_redirects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CHECK, trigger và dữ liệu cấu hình mặc định (viết tay)
-- ============================================================

-- ----- Nội dung -----
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_values" CHECK (
  "size_bytes" > 0
  AND ("width" IS NULL OR "width" > 0)
  AND ("height" IS NULL OR "height" > 0)
  AND ("checksum_sha256" IS NULL OR "checksum_sha256" ~ '^[0-9a-f]{64}$')
);
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "posts" ADD CONSTRAINT "posts_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "posts" ADD CONSTRAINT "posts_published_at"
  CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "posts" ADD CONSTRAINT "posts_view_count" CHECK ("view_count" >= 0);
ALTER TABLE "pages" ADD CONSTRAINT "pages_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "pages" ADD CONSTRAINT "pages_published_at"
  CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_code_format" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE "banners" ADD CONSTRAINT "banners_time_range"
  CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");
ALTER TABLE "banners" ADD CONSTRAINT "banners_link_format"
  CHECK ("link_url" IS NULL OR "link_url" ~ '^(/|https://)');
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_group_code_format" CHECK ("group_code" ~ '^[A-Z][A-Z0-9_]*$');

-- Chuyển hướng: đường dẫn nội bộ, không trỏ về chính nó
ALTER TABLE "url_redirects" ADD CONSTRAINT "url_redirects_values" CHECK (
  "from_path" ~ '^/[^[:space:]]*$'
  AND ("to_path" ~ '^/[^[:space:]]*$' OR "to_path" ~ '^https://[^[:space:]]+$')
  AND "from_path" <> "to_path"
  AND "status_code" IN (301, 302, 307, 308)
  AND "hit_count" >= 0
);

-- Không cho nối chuỗi A -> B -> C (Google chỉ theo vài bước và mất SEO)
CREATE FUNCTION "url_redirects_flat"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "url_redirects" WHERE "from_path" = NEW."to_path" AND "id" <> NEW."id") THEN
    RAISE EXCEPTION 'Đích % đang là nguồn của một chuyển hướng khác (tạo chuỗi)', NEW."to_path"
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM "url_redirects" WHERE "to_path" = NEW."from_path" AND "id" <> NEW."id") THEN
    RAISE EXCEPTION 'Đã có chuyển hướng trỏ tới %; hãy cập nhật chuyển hướng đó sang đích mới', NEW."from_path"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "url_redirects_no_chain"
  BEFORE INSERT OR UPDATE OF "from_path", "to_path" ON "url_redirects"
  FOR EACH ROW EXECUTE FUNCTION "url_redirects_flat"();

-- ----- Đánh giá -----
ALTER TABLE "products" ADD CONSTRAINT "products_rating_values" CHECK (
  "rating_count" >= 0 AND "rating_sum" BETWEEN "rating_count" AND 5 * "rating_count"
);
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_values" CHECK (
  "rating" BETWEEN 1 AND 5 AND jsonb_typeof("photos") = 'array'
);
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_moderation" CHECK (
  ("status" = 'PENDING') = ("moderated_at" IS NULL)
  AND ("status" = 'REJECTED') = ("reject_reason" IS NOT NULL)
);
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_reply_pair"
  CHECK (("reply_content" IS NULL) = ("replied_at" IS NULL));

-- Chỉ dòng sản phẩm/combo của đơn ĐÃ HOÀN TẤT, và đúng sản phẩm
CREATE FUNCTION "product_reviews_verify_purchase"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_product_id uuid;
  v_line_type  order_line_type;
  v_status     order_status;
BEGIN
  SELECT v."product_id", ol."line_type", o."status"
    INTO v_product_id, v_line_type, v_status
    FROM "order_lines" ol
    JOIN "orders" o ON o."id" = ol."order_id"
    LEFT JOIN "product_variants" v ON v."id" = ol."variant_id"
    WHERE ol."id" = NEW."order_line_id";

  IF v_line_type NOT IN ('PRODUCT', 'BUNDLE') OR v_product_id IS DISTINCT FROM NEW."product_id" THEN
    RAISE EXCEPTION 'Dòng đơn % không phải sản phẩm % đã mua', NEW."order_line_id", NEW."product_id"
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Chỉ được đánh giá khi đơn đã hoàn tất (hiện tại: %)', v_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "product_reviews_purchase_check"
  BEFORE INSERT OR UPDATE OF "order_line_id", "product_id" ON "product_reviews"
  FOR EACH ROW EXECUTE FUNCTION "product_reviews_verify_purchase"();

-- Tự tính lại điểm của sản phẩm từ các đánh giá ĐÃ DUYỆT
CREATE FUNCTION "product_reviews_refresh_rating"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_ids uuid[];
BEGIN
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD."product_id" END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW."product_id" END
    ]) AS x WHERE x IS NOT NULL
  );

  UPDATE "products" p SET
    "rating_count" = s.cnt,
    "rating_sum"   = s.total
  FROM (
    SELECT pid,
           count(r."id")::int              AS cnt,
           COALESCE(sum(r."rating"), 0)::int AS total
    FROM unnest(v_ids) AS pid
    LEFT JOIN "product_reviews" r ON r."product_id" = pid AND r."status" = 'APPROVED'
    GROUP BY pid
  ) s
  WHERE p."id" = s.pid;

  RETURN NULL;
END;
$$;

CREATE TRIGGER "product_reviews_rating"
  AFTER INSERT OR UPDATE OR DELETE ON "product_reviews"
  FOR EACH ROW EXECUTE FUNCTION "product_reviews_refresh_rating"();

ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_token_format" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

-- ----- Cấu hình -----
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$');

INSERT INTO "system_settings" ("key", "value", "description", "updated_at") VALUES
  ('order.deposit_min_bps',                '1000',                   'Tỷ lệ cọc tối thiểu (phần vạn)', now()),
  ('order.deposit_max_bps',                '3000',                   'Tỷ lệ cọc tối đa (phần vạn)', now()),
  ('checkout.hold_minutes',                '20',                     'Thời gian giữ hàng khi thanh toán online (phút)', now()),
  ('payment.vnpay_session_minutes',        '15',                     'Thời hạn phiên thanh toán VNPay (phút)', now()),
  ('payment.bank_transfer_reminder_hours', '24',                     'Nhắc nhân viên khi chuyển khoản chưa về (giờ)', now()),
  ('warranty.exchange_window_days',        '7',                      'Hạn đổi máy mới khi lỗi nhà sản xuất (ngày)', now()),
  ('pricing.rounding_unit',                '1000',                   'Đơn vị làm tròn giá tính theo % (VND)', now()),
  ('pricing.rounding_mode',                '"DOWN"',                 'Cách làm tròn: DOWN', now()),
  ('vat.mode',                             '"EXCLUSIVE_ON_REQUEST"', 'Giá chưa VAT, cộng khi khách lấy hóa đơn', now()),
  ('vat.default_rate_bps',                 '1000',                   'Thuế suất VAT mặc định (phần vạn)', now()),
  ('quote.approval_threshold_bps',         '1000',                   'Báo giá giảm quá mức này cần quản trị duyệt (phần vạn)', now()),
  ('quote.default_valid_days',             '15',                     'Số ngày hiệu lực mặc định của báo giá', now()),
  ('inventory.transfer_stale_days',        '3',                      'Nhắc phiếu chuyển kho chưa nhận sau (ngày)', now()),
  ('vendor_return.stale_days',             '30',                     'Nhắc phiếu gửi hãng chưa có kết quả sau (ngày)', now()),
  ('review.request_valid_days',            '30',                     'Hạn dùng link mời đánh giá (ngày)', now())
ON CONFLICT ("key") DO NOTHING;

-- ----- Thông báo -----
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_code_format" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_by_channel" CHECK (
  ("channel" = 'EMAIL' AND "subject" IS NOT NULL)
  OR ("channel" = 'ZALO_ZNS' AND "provider_template_id" IS NOT NULL)
);
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_recipient_format" CHECK (
  ("channel" = 'EMAIL' AND "recipient" = lower("recipient") AND "recipient" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  OR ("channel" = 'ZALO_ZNS' AND "recipient" ~ '^\+84[0-9]{9,10}$')
);
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_values" CHECK (
  "attempts" >= 0 AND ("status" = 'SENT') = ("sent_at" IS NOT NULL)
);

-- ----- Outbox -----
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_values" CHECK (
  "attempts" >= 0
  AND ("status" = 'DONE') = ("processed_at" IS NOT NULL)
  AND ("status" <> 'FAILED' OR "last_error" IS NOT NULL)
);

-- ----- Bảng bất biến -----
CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_modification"();
CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_modification"();
CREATE TRIGGER "policy_versions_no_update_delete"
  BEFORE UPDATE OR DELETE ON "policy_versions"
  FOR EACH ROW EXECUTE FUNCTION "forbid_modification"();
CREATE TRIGGER "policy_versions_no_truncate"
  BEFORE TRUNCATE ON "policy_versions"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_modification"();
