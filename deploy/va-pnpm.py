#!/usr/bin/env python3
"""
Vá deploy/01-chuan-bi-vps.sh — sửa bước 3 (cài pnpm).

LỖI ĐANG CÓ
    /opt/node24/bin/npm install -g --silent pnpm@10.34.5
    xong "pnpm $(/opt/node24/bin/pnpm -v)"

Hai chỗ sai:

1. Thiếu "--prefix /opt/node24". npm đọc prefix từ file .npmrc của máy
   (/root/.npmrc, /usr/etc/npmrc...). Máy nào đã cài Node theo cách khác thì
   file đó thường trỏ sang chỗ khác, nên pnpm bị cài ra ngoài — tức là GHI ĐÈ
   pnpm toàn cục mà các ứng dụng khác trên VPS đang dùng, còn
   /opt/node24/bin/pnpm thì vẫn trống.

2. Không kiểm tra lại sau khi cài. Lệnh "$(...)" trong đối số của hàm in ra
   màn hình nếu thất bại chỉ trả về chuỗi rỗng chứ KHÔNG làm script dừng, nên
   script in dấu ✓ cho một việc đã hỏng. Đây là lỗi tệ hơn cả lỗi 1: nó giấu
   sự cố thay vì phơi ra.

Chạy:
    cd /Users/dennis/Projects/huyhoang/khoathongminh
    python3 deploy/va-pnpm.py
"""

import pathlib
import sys

DICH = pathlib.Path("deploy/01-chuan-bi-vps.sh")

CU = '''    /opt/node24/bin/npm install -g --silent pnpm@10.34.5
    xong "pnpm $(/opt/node24/bin/pnpm -v)"
'''

MOI = '''    # --prefix /opt/node24 là BẮT BUỘC.
    #
    # Không có nó, npm lấy prefix từ .npmrc của máy (/root/.npmrc, /usr/etc/npmrc).
    # Trên VPS đang chạy nhiều website, prefix đó thường trỏ vào chỗ cài chung —
    # nghĩa là lệnh này sẽ GHI ĐÈ pnpm toàn cục mà các app khác đang dùng, mà
    # /opt/node24/bin/pnpm thì vẫn không có. Đúng thứ cần tránh.
    #
    # Bỏ luôn --silent: lỗi cài đặt phải hiện ra, không được nuốt.
    /opt/node24/bin/npm install -g --prefix /opt/node24 pnpm@10.34.5

    # Kiểm tra lại cho chắc. Bản cũ in thẳng "pnpm $(...)" nên khi lệnh bên
    # trong hỏng, nó chỉ ra chuỗi rỗng và script vẫn báo ✓ — che mất sự cố.
    if [[ ! -x /opt/node24/bin/pnpm ]]; then
        loi "Đã chạy lệnh cài nhưng không thấy /opt/node24/bin/pnpm"
        loi "Xem npm đang cài vào đâu:  /opt/node24/bin/npm config get prefix"
        exit 1
    fi
    ban_pnpm="$(/opt/node24/bin/pnpm -v)"
    if [[ $ban_pnpm != 10.34.5 ]]; then
        loi "Cài ra pnpm $ban_pnpm, không phải 10.34.5"
        exit 1
    fi
    xong "pnpm $ban_pnpm"
'''


def main() -> int:
    if not DICH.exists():
        print(f"Không thấy {DICH}")
        print("Chạy lệnh này từ thư mục gốc dự án:")
        print("   cd /Users/dennis/Projects/huyhoang/khoathongminh")
        return 1

    van = DICH.read_text(encoding="utf-8")

    if "--prefix /opt/node24" in van:
        print(f"{DICH} đã được vá trước đó rồi, không làm gì thêm.")
        return 0

    if van.count(CU) != 1:
        print(f"Không tìm thấy đúng đoạn cần sửa trong {DICH}")
        print(f"(tìm thấy {van.count(CU)} lần, cần đúng 1)")
        print("File có thể đã bị sửa tay — gửi lại nội dung bước 3 cho tôi xem.")
        return 1

    DICH.write_text(van.replace(CU, MOI), encoding="utf-8")
    print(f"Đã vá {DICH}")
    print("  - thêm --prefix /opt/node24  (không ghi đè pnpm toàn cục nữa)")
    print("  - bỏ --silent                (lỗi cài đặt hiện ra)")
    print("  - thêm kiểm tra sau khi cài  (không báo ✓ khi đã hỏng)")
    print()
    print("Tiếp theo:")
    print("   git add deploy/01-chuan-bi-vps.sh deploy/va-pnpm.py")
    print('   git commit -m "sua buoc cai pnpm: ep prefix va kiem tra ket qua"')
    print("   git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
