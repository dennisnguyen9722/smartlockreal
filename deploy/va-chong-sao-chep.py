#!/usr/bin/env python3
"""
Vá deploy/nginx-buoc2-https.conf — chống sao chép website.

THÊM BA THỨ

1. CHẶN LẤY ẢNH TỪ WEBSITE KHÁC (hotlink)
   Website khác nhúng ảnh của mình thì nhận về ảnh có chữ
   "Hình ảnh thuộc về khoathongminhchinhhang.vn". Áp cho cả ba khối
   web / admin / api vì cả ba đều phục vụ /media/.

   Vẫn CHO qua khi không có Referer ("none") hoặc Referer bị nhà mạng cắt
   ("blocked") — nhóm này là khách thật mở ảnh trực tiếp, dùng trình duyệt ẩn
   danh, hoặc qua ứng dụng. Chặn họ là tự chặn khách của mình.

2. GIỚI HẠN SỐ LƯỢT GỌI
   5 lượt/giây cho trang web, 10 lượt/giây cho API, tính theo từng IP.
   KHÔNG áp cho trang quản trị: nhân viên nhập hàng loạt, tải nhiều ảnh một
   lúc — bóp ở đó là tự làm khó mình, mà trang đó cũng phải đăng nhập mới vào.

3. CHẶN CÔNG CỤ TẢI CẢ WEBSITE
   HTTrack, wget -m, SiteSucker và họ hàng.

Cần có /etc/nginx/conf.d/ktm-chong-sao-chep.conf trước, vì các vùng đếm và
biến khai ở đó.

Chạy:
    cd /Users/dennis/Projects/huyhoang/khoathongminh
    python3 deploy/va-chong-sao-chep.py
"""

import pathlib
import sys

DICH = pathlib.Path("deploy/nginx-buoc2-https.conf")

# --------------------------------------------------------------------------
# 1. Khối /media/ — giống hệt nhau ở cả ba khối server, vá cả ba
# --------------------------------------------------------------------------
MEDIA_CU = '''    location /media/ {
        alias /var/www/khoathongminhchinhhang.vn/media/;
        access_log off;'''

MEDIA_MOI = '''    location /media/ {
        alias /var/www/khoathongminhchinhhang.vn/media/;

        # --- CHẶN WEBSITE KHÁC LẤY ẢNH CỦA MÌNH ------------------------------
        # none    = yêu cầu KHÔNG có Referer: mở ảnh trực tiếp, trình duyệt ẩn
        #           danh, một số ứng dụng di động. VẪN CHO — chặn nhóm này là
        #           tự chặn khách thật.
        # blocked = Referer bị tường lửa nhà mạng cắt mất. Cũng cho.
        # Còn lại: chỉ các tên miền của mình.
        valid_referers none blocked
                       khoathongminhchinhhang.vn
                       *.khoathongminhchinhhang.vn;
        if ($invalid_referer) {
            return 302 https://khoathongminhchinhhang.vn/chong-sao-chep.png;
        }

        # Một trang kéo vài chục ảnh cùng lúc nên KHÔNG giới hạn số lượt ở đây.
        # Chỉ hạn chế số kết nối đồng thời, đủ để chặn kiểu tải hàng loạt.
        limit_conn ktm_ketnoi 40;

        access_log off;'''

# --------------------------------------------------------------------------
# 2. Khối web (cổng 3100) — thêm ảnh thay thế, chặn công cụ, giới hạn lượt
# --------------------------------------------------------------------------
WEB_CU = '''    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;'''

WEB_MOI = '''    # Ảnh trả về cho website nào lấy trộm ảnh. Chỉ khai ở khối này; khối
    # admin và api chuyển hướng về đây nên không cần khai lại.
    location = /chong-sao-chep.png {
        root /var/www/khoathongminhchinhhang.vn/tinh;
        access_log off;
        # Chỉ một dòng Cache-Control: dùng kèm "expires" là nginx trả về HAI
        # dòng cache-control chồng nhau (đã dính một lần ở /media/).
        # Để 1 giờ thôi, không phải 1 năm: đổi nội dung ảnh cảnh báo thì muốn
        # nó lan nhanh.
        add_header Cache-Control "public, max-age=3600" always;
    }

    # Chặn công cụ tải cả website về máy. Danh sách và lý do xem trong
    # /etc/nginx/conf.d/ktm-chong-sao-chep.conf — cố ý KHÔNG chặn curl,
    # Googlebot hay Next.js gọi API.
    if ($ktm_cong_cu_sao_chep) {
        return 403;
    }

    location / {
        # 5 lượt/giây, cho dồn 20 lượt. Người thật mở một trang chỉ tốn 1-3
        # lượt ở đây (ảnh và file tĩnh nằm ở location khác, không tính vào
        # đây) nên không ai chạm trần; công cụ sao chép thì chạm ngay lượt đầu.
        limit_req zone=ktm_trang burst=20 nodelay;
        limit_req_status 429;
        limit_conn ktm_ketnoi 40;

        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;'''

# --------------------------------------------------------------------------
# 3. Khối api (cổng 4100) — đây mới là đường rút dữ liệu nhanh nhất
# --------------------------------------------------------------------------
API_CU = '''    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;'''

API_MOI = '''    if ($ktm_cong_cu_sao_chep) {
        return 403;
    }

    location / {
        # API trả JSON sạch, có cấu trúc — kẻ sao chép lấy ở đây dễ hơn nhiều
        # so với bóc tách HTML. 10 lượt/giây mỗi IP, cho dồn 30.
        #
        # Lượt dựng trang của chính máy chủ đã được miễn trừ THEO IP trong
        # /etc/nginx/conf.d/ktm-chong-sao-chep.conf. Không có phần miễn trừ đó,
        # mọi khách vào website đều bị gộp chung một trần vì SSR đi ra rồi vòng
        # lại từ đúng một địa chỉ IP.
        limit_req zone=ktm_api burst=30 nodelay;
        limit_req_status 429;
        limit_conn ktm_ketnoi 40;

        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;'''


BAN_VA = [
    (MEDIA_CU, MEDIA_MOI, 3, "chặn hotlink + giới hạn kết nối cho /media/ (3 khối)"),
    (WEB_CU, WEB_MOI, 1, "khối web: ảnh thay thế, chặn công cụ, 5 lượt/giây"),
    (API_CU, API_MOI, 1, "khối api: chặn công cụ, 10 lượt/giây"),
]


def main() -> int:
    if not DICH.exists():
        print(f"Không thấy {DICH}")
        print("Chạy lệnh này từ thư mục gốc dự án:")
        print("   cd /Users/dennis/Projects/huyhoang/khoathongminh")
        return 1

    van = DICH.read_text(encoding="utf-8")

    if "valid_referers" in van:
        print(f"{DICH} đã được vá trước đó rồi, không làm gì thêm.")
        return 0

    # Kiểm tra TOÀN BỘ trước khi ghi, để không rơi vào trạng thái vá nửa chừng
    for cu, _, can, mo_ta in BAN_VA:
        thay = van.count(cu)
        if thay != can:
            print(f"✗ '{mo_ta}': tìm thấy {thay} chỗ khớp, cần đúng {can}.")
            print("  KHÔNG sửa gì cả. File đã khác bản tôi biết — gửi tôi xem.")
            return 1

    for cu, moi, _, mo_ta in BAN_VA:
        van = van.replace(cu, moi)
        print(f"✓ {mo_ta}")

    DICH.write_text(van, encoding="utf-8")
    print()
    print(f"Đã vá {DICH}")
    print()
    print("Tiếp theo — máy Mac:")
    print("   git add -A")
    print('   git commit -m "chong sao chep: hotlink, gioi han luot, chan cong cu"')
    print("   git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
