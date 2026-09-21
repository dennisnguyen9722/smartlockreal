-- This is an empty migration.-- ============================================================
-- Thông tin công ty: dùng cho trang in báo giá (Bước 7), website và hóa đơn.
-- CHỈ THÊM DỮ LIỆU, không đổi cấu trúc bảng. Giá trị tạm: sửa ở trang Cấu hình (Bước 8)
-- hoặc tạm thời bằng `pnpm --filter @ktm/database db:studio` -> bảng system_settings.
-- Cột value kiểu JSON: chuỗi phải nằm trong nháy kép, vd '"Công ty ABC"'.
-- ON CONFLICT DO NOTHING: chạy lại không ghi đè giá trị đã sửa.
-- ============================================================
INSERT INTO "system_settings" ("key", "value", "description", "updated_at") VALUES
  ('company.name',              '"CÔNG TY TNHH HUY HOÀNG GROUP"', 'Tên pháp lý của công ty (in trên báo giá, hóa đơn)', now()),
  ('company.brand_name',        '"Khóa Thông Minh Chính Hãng"',   'Tên thương hiệu hiển thị trên website', now()),
  ('company.tax_code',          '"Chưa cập nhật"',                'Mã số thuế công ty', now()),
  ('company.address',           '"Chưa cập nhật"',                'Địa chỉ trụ sở (in trên báo giá)', now()),
  ('company.hotline',           '"Chưa cập nhật"',                'Hotline bán hàng', now()),
  ('company.email',             '"Chưa cập nhật"',                'Email liên hệ', now()),
  ('company.website',           '"khoathongminhchinhhang.vn"',    'Tên miền website', now()),
  ('company.logo_url',          '""',                             'Đường dẫn logo (trống = chỉ in tên công ty)', now()),
  ('company.bank_name',         '"Chưa cập nhật"',                'Ngân hàng nhận chuyển khoản', now()),
  ('company.bank_account',      '"Chưa cập nhật"',                'Số tài khoản nhận chuyển khoản', now()),
  ('company.bank_account_name', '"Chưa cập nhật"',                'Chủ tài khoản', now())
ON CONFLICT ("key") DO NOTHING;
