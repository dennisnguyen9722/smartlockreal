-- This is an empty migration.-- ============================================================
-- Đánh giá (Bước 8): khách đánh giá thẳng trên trang sản phẩm.
-- Migration RIÊNG (*_open_reviews_checks), viết để CHẠY LẶP KHÔNG SAO:
-- ràng buộc nào đã có thì xóa rồi tạo lại; hàm trigger luôn được thay bằng bản mới.
-- ============================================================

ALTER TABLE "product_reviews" DROP CONSTRAINT IF EXISTS "product_reviews_phone_format";
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_phone_format"
  CHECK ("reviewer_phone" ~ '^\+84[0-9]{9}$');

-- Tối đa 5 ảnh (API cũng chặn)
ALTER TABLE "product_reviews" DROP CONSTRAINT IF EXISTS "product_reviews_photo_limit";
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_photo_limit"
  CHECK (jsonb_array_length("photos") <= 5);

-- "Đã mua hàng" phải đi kèm dòng đơn làm bằng chứng
ALTER TABLE "product_reviews" DROP CONSTRAINT IF EXISTS "product_reviews_verified_line";
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_verified_line"
  CHECK (NOT "verified_purchase" OR "order_line_id" IS NOT NULL);

-- Trigger kiểm tra mua hàng: giờ order_line_id được phép trống (đánh giá của người chưa mua qua hệ thống).
-- Có order_line_id thì vẫn kiểm tra như cũ: đúng sản phẩm, đơn đã hoàn tất.
CREATE OR REPLACE FUNCTION "product_reviews_verify_purchase"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_product_id uuid;
  v_line_type  order_line_type;
  v_status     order_status;
BEGIN
  IF NEW."order_line_id" IS NULL THEN
    RETURN NEW;
  END IF;

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
    RAISE EXCEPTION 'Chỉ được gắn đơn đã hoàn tất (hiện tại: %)', v_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
