-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "order_status" ADD VALUE 'ORDERED_FROM_BRAND';
ALTER TYPE "order_status" ADD VALUE 'GOODS_ARRIVED';

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assigned_staff_id" UUID,
ADD COLUMN     "brand_order_ref" VARCHAR(100),
ADD COLUMN     "brand_ordered_at" TIMESTAMPTZ(3),
ADD COLUMN     "brand_technician_note" TEXT,
ADD COLUMN     "goods_arrived_at" TIMESTAMPTZ(3),
ADD COLUMN     "scheduled_at" TIMESTAMPTZ(3),
ADD COLUMN     "ship_address_raw" TEXT;

-- CreateIndex
CREATE INDEX "orders_assigned_staff_id_status_idx" ON "orders"("assigned_staff_id", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Viết tay: quy trình nhận đơn rồi đặt hãng (Bước 6)
-- LƯU Ý: không dùng giá trị enum mới (ORDERED_FROM_BRAND, GOODS_ARRIVED) trong migration này,
-- PostgreSQL không cho dùng giá trị enum vừa thêm trong cùng transaction.
-- ============================================================

-- Web chỉ hỏi tên, số điện thoại, địa chỉ gõ tự do để khách không bỏ ngang.
-- Địa chỉ chuẩn (tỉnh, phường, số nhà) chỉ bắt buộc từ lúc nhân viên xác nhận đơn.
ALTER TABLE "orders" DROP CONSTRAINT "orders_delivery_requires_address";
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_requires_address" CHECK (
  "fulfillment_type" <> 'DELIVERY'
  OR "status" IN ('PENDING_CONFIRMATION', 'CANCELLED')
  OR (
    "ship_recipient_name" IS NOT NULL AND "ship_recipient_phone" IS NOT NULL
    AND "ship_province_code" IS NOT NULL AND "ship_province_name" IS NOT NULL
    AND "ship_ward_code" IS NOT NULL AND "ship_ward_name" IS NOT NULL
    AND "ship_street" IS NOT NULL
  )
);

-- Đơn giao hàng lúc nào cũng phải có ít nhất một dạng địa chỉ
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_has_address" CHECK (
  "fulfillment_type" <> 'DELIVERY' OR "ship_address_raw" IS NOT NULL OR "ship_street" IS NOT NULL
);

-- Không lưu chuỗi rỗng vào các ô làm việc với hãng
ALTER TABLE "orders" ADD CONSTRAINT "orders_brand_fields_not_blank" CHECK (
  ("brand_order_ref" IS NULL OR btrim("brand_order_ref") <> '')
  AND ("brand_technician_note" IS NULL OR btrim("brand_technician_note") <> '')
  AND ("ship_address_raw" IS NULL OR btrim("ship_address_raw") <> '')
);

-- Hàng về không thể trước lúc đặt hãng
ALTER TABLE "orders" ADD CONSTRAINT "orders_brand_dates_order" CHECK (
  "goods_arrived_at" IS NULL OR "brand_ordered_at" IS NULL OR "goods_arrived_at" >= "brand_ordered_at"
);

-- Serial đã giao: không quá số lượng của dòng
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_serial_count"
  CHECK (cardinality("serial_numbers") <= "quantity");
