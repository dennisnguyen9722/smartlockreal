#!/usr/bin/env python3
"""
Vá deploy/02-trien-khai.sh — build @ktm/database thay vì chỉ chạy prisma generate.

LỖI ĐANG CÓ
    pnpm --filter @ktm/database exec prisma generate

Gói @ktm/database khai trong package.json:
    "main":  "./dist/index.js"
    "types": "./dist/index.d.ts"

nên nó phải được BIÊN DỊCH ra dist/ thì nơi khác mới dùng được. "prisma generate"
chỉ sinh Prisma Client vào src/generated/prisma, hoàn toàn không tạo dist/.

Hậu quả trên VPS vừa clone về (máy lập trình không thấy vì dist/ đã có sẵn từ
lúc phát triển):

    error TS2307: Cannot find module '@ktm/database'

rồi kéo theo hơn 200 lỗi ăn theo kiểu "implicitly has an 'any' type" — vì mất
kiểu của Prisma thì mọi tham số row/tx/item đều thành any, mà noImplicitAny
đang bật. Tổng cộng 233 lỗi, tất cả từ một nguyên nhân.

CÁCH SỬA
    pnpm --filter @ktm/database run build

Lệnh build của chính gói đã là "prisma generate --no-hints && tsc -p tsconfig.json",
tức là bao trọn việc cũ và làm thêm phần còn thiếu.

Chạy:
    cd /Users/dennis/Projects/huyhoang/khoathongminh
    python3 deploy/va-build-database.py
"""

import pathlib
import sys

DICH = pathlib.Path("deploy/02-trien-khai.sh")

CU = '''pnpm --filter @ktm/database exec prisma generate
xong "prisma generate"
'''

MOI = '''# @ktm/database xuất bản dist/ (main: ./dist/index.js, types: ./dist/index.d.ts)
# nên BẮT BUỘC phải biên dịch, không chỉ sinh Prisma Client.
#
# Bản cũ chỉ chạy "prisma generate" — sinh Prisma Client vào src/generated/prisma
# nhưng không tạo dist/. Trên máy lập trình không lộ ra vì dist/ đã có sẵn từ
# trước; trên VPS vừa clone về thì API báo:
#     error TS2307: Cannot find module '@ktm/database'
# rồi kéo theo hơn 200 lỗi "implicitly has an 'any' type" ăn theo — mất kiểu
# Prisma thì mọi tham số row/tx/item đều thành any.
#
# Lệnh build của chính gói là "prisma generate --no-hints && tsc", bao trọn
# việc cũ và làm nốt phần còn thiếu.
pnpm --filter @ktm/database run build
xong "@ktm/database (prisma generate + tsc)"
'''


def main() -> int:
    if not DICH.exists():
        print(f"Không thấy {DICH}")
        print("Chạy lệnh này từ thư mục gốc dự án:")
        print("   cd /Users/dennis/Projects/huyhoang/khoathongminh")
        return 1

    van = DICH.read_text(encoding="utf-8")

    if "--filter @ktm/database run build" in van:
        print(f"{DICH} đã được vá trước đó rồi, không làm gì thêm.")
        return 0

    if van.count(CU) != 1:
        print(f"Không tìm thấy đúng đoạn cần sửa trong {DICH}")
        print(f"(tìm thấy {van.count(CU)} lần, cần đúng 1)")
        print("File có thể đã bị sửa tay — gửi tôi xem phần 'Build thư viện dùng chung'.")
        return 1

    DICH.write_text(van.replace(CU, MOI), encoding="utf-8")
    print(f"Đã vá {DICH}")
    print("  prisma generate  ->  pnpm --filter @ktm/database run build")
    print()
    print("Tiếp theo:")
    print("   git add deploy/02-trien-khai.sh deploy/va-build-database.py")
    print('   git commit -m "build @ktm/database truoc khi build API"')
    print("   git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
