#!/usr/bin/env python3
"""
Vá deploy/nginx-buoc2-https.conf — cho WebSocket (Socket.IO) đi qua khối api.

LỖI
    Khối server của api.khoathongminhchinhhang.vn thiếu hai dòng:
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $ktm_connection_upgrade;

    Thiếu chúng, nginx chuyển tiếp yêu cầu như một yêu cầu HTTP bình thường và
    KHÔNG thực hiện bắt tay nâng cấp giao thức, nên trình duyệt báo:
        WebSocket connection to 'wss://api.../socket.io/...' failed

    Socket.IO tự lùi về chế độ hỏi liên tục (polling) nên trang vẫn chạy —
    đó là lý do lỗi chỉ hiện trong console chứ không làm hỏng giao diện. Cái giá
    phải trả: mỗi lần hỏi là một vòng HTTP mới, tốn kết nối và chậm hơn hẳn.

    Biến $ktm_connection_upgrade đã khai sẵn ở đầu file (khối map), không cần
    thêm gì nữa.

VÌ SAO TÔI BỎ SÓT
    Tôi thêm hai dòng này cho khối web và admin — hai chỗ Next.js chỉ cần khi
    chạy dev — mà quên đúng khối api, nơi NestJS thật sự chạy Socket.IO.

Chạy:
    cd /Users/dennis/Projects/huyhoang/khoathongminh
    python3 deploy/va-websocket-api.py
"""

import pathlib
import sys

DICH = pathlib.Path("deploy/nginx-buoc2-https.conf")

# proxy_pass tới cổng 4100 chỉ xuất hiện trong khối api (web 3100, admin 3101)
CU = '''    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }'''

MOI = '''    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;

        # BẮT BUỘC cho WebSocket (Socket.IO của NestJS chạy ở đây).
        # Thiếu hai dòng này, nginx chuyển tiếp như yêu cầu HTTP thường và không
        # bắt tay nâng cấp giao thức -> trình duyệt báo "WebSocket connection
        # failed", Socket.IO lùi về chế độ hỏi liên tục: vẫn chạy nhưng tốn
        # kết nối và chậm hơn nhiều.
        # $ktm_connection_upgrade khai ở khối map đầu file này.
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $ktm_connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Kết nối WebSocket nằm im giữa hai nhịp ping. Socket.IO ping mỗi 25
        # giây nên 300s vốn đã đủ, nhưng để 1 giờ cho chắc: nginx cắt giữa
        # chừng thì client phải nối lại, người dùng thấy giao diện khựng.
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;

        proxy_buffering off;
    }'''


def main() -> int:
    if not DICH.exists():
        print(f"Không thấy {DICH}")
        print("Chạy lệnh này từ thư mục gốc dự án:")
        print("   cd /Users/dennis/Projects/huyhoang/khoathongminh")
        return 1

    van = DICH.read_text(encoding="utf-8")

    if "proxy_pass http://127.0.0.1:4100;" not in van:
        print(f"✗ {DICH} không có khối api trỏ tới cổng 4100 — file đã khác bản tôi biết.")
        return 1

    if "$ktm_connection_upgrade" in van.split("proxy_pass http://127.0.0.1:4100;")[1]:
        print(f"{DICH} đã được vá trước đó rồi, không làm gì thêm.")
        return 0

    so_lan = van.count(CU)
    if so_lan != 1:
        print(f"✗ Tìm thấy {so_lan} chỗ khớp, cần đúng 1. KHÔNG sửa gì cả.")
        print("  Gửi tôi xem khối server của api trong file đó.")
        return 1

    DICH.write_text(van.replace(CU, MOI), encoding="utf-8")
    print(f"Đã vá {DICH}")
    print("  + proxy_set_header Upgrade / Connection   (bắt tay WebSocket)")
    print("  + proxy_read_timeout / proxy_send_timeout 3600s")
    print()
    print("Tiếp theo — máy Mac:")
    print("   git add deploy/nginx-buoc2-https.conf deploy/va-websocket-api.py")
    print('   git commit -m "cho websocket di qua khoi api cua nginx"')
    print("   git push")
    print()
    print("Rồi trên VPS:")
    print("   cd /var/www/khoathongminhchinhhang.vn/app && git pull")
    print("   cp deploy/nginx-buoc2-https.conf \\")
    print("      /etc/nginx/sites-available/khoathongminhchinhhang.vn")
    print("   nginx -t && systemctl reload nginx")
    return 0


if __name__ == "__main__":
    sys.exit(main())
