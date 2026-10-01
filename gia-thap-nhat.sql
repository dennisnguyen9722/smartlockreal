-- ============================================================
-- Cột "giá thấp nhất" trên bảng sản phẩm
--
-- Vì sao cần: giá nằm ở biến thể, nên không thể ORDER BY giá ở bảng
-- sản phẩm. Không có cột này thì "sắp theo giá" chỉ đúng trong phạm vi
-- một trang — khách bấm "giá thấp đến cao" sẽ thấy kết quả sai.
--
-- Trigger tự cập nhật khi biến thể đổi giá, bật/tắt, thêm hoặc xóa,
-- nên không có đường nào làm số này lệch — kể cả sửa thẳng trong SQL.
--
-- Chạy SAU khi đã prisma migrate dev thêm trường priceFrom.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION products_refresh_price_from() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target uuid;
BEGIN
  target := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE products
  SET price_from = COALESCE(
    (SELECT MIN(v.price) FROM product_variants v
      WHERE v.product_id = target AND v.is_active),
    0)
  WHERE id = target;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION products_refresh_price_from() IS
  'Giữ products.price_from bằng giá thấp nhất của các biến thể đang bật';

DROP TRIGGER IF EXISTS product_variants_price_from ON product_variants;

CREATE TRIGGER product_variants_price_from
AFTER INSERT OR DELETE OR UPDATE OF price, is_active, product_id
ON product_variants
FOR EACH ROW
EXECUTE FUNCTION products_refresh_price_from();

-- Nạp lại cho toàn bộ sản phẩm đang có
UPDATE products p
SET price_from = COALESCE(
  (SELECT MIN(v.price) FROM product_variants v
    WHERE v.product_id = p.id AND v.is_active),
  0);

COMMIT;

\echo ''
\echo '--- Kiểm tra: 5 sản phẩm rẻ nhất đang bán ---'
SELECT p.name, p.price_from
FROM products p
WHERE p.status = 'ACTIVE' AND p.price_from > 0
ORDER BY p.price_from ASC
LIMIT 5;

\echo ''
\echo '--- Đối chiếu: có sản phẩm nào lệch không (phải ra 0 dòng) ---'
SELECT p.name, p.price_from AS cot, MIN(v.price) AS thuc_te
FROM products p
JOIN product_variants v ON v.product_id = p.id AND v.is_active
GROUP BY p.id, p.name, p.price_from
HAVING p.price_from IS DISTINCT FROM MIN(v.price);
