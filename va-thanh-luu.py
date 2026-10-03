#!/usr/bin/env python3
"""
LÀM LẠI THANH "LƯU THAY ĐỔI" DÍNH Ở ĐÁY TRONG TRANG QUẢN TRỊ.

VÌ SAO:
Thanh cũ chỉ là một dải phẳng, nền trắng đặc, phía trên có đúng một đường kẻ 1px:

    sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background py-3

Nó dán sát đáy khung cuộn và chạy hết bề ngang cột nội dung, nên nhìn như đang
CẮT NGANG giữa trang — ô nhập phía trên bị chặt mất nửa dưới mà không có dấu
hiệu gì cho biết đó là một lớp nổi bên trên. Nút thì chạm sát mép, không có lề.

Sau khi vá, thanh thành một khối nổi rõ ràng:
  - bo góc, có viền và đổ bóng  -> mắt nhận ra ngay đây là lớp nổi bên trên
  - cách đáy 8px (bottom-2)     -> không dán chết vào mép khung cuộn
  - px-4                        -> nút không chạm mép
  - nền bg-card/90 + backdrop-blur -> nội dung phía dưới mờ đi chứ không bị chặt cụt
  - flex-wrap                   -> màn hình hẹp thì chữ và nút tự xuống dòng

Vá 3 chỗ dùng y hệt đoạn này:
  apps/admin/src/components/product-info-tab.tsx          (sửa thông tin sản phẩm)
  apps/admin/src/components/settings/settings-group-form.tsx  (trang Cấu hình)
  apps/admin/src/app/showroom/[id]/page.tsx               (sửa showroom)

Chạy từ THƯ MỤC GỐC dự án:  python3 va-thanh-luu.py
Chạy lại nhiều lần vẫn an toàn. Bản gốc giữ ở *.bak cạnh mỗi file.
"""
import shutil
import sys
from pathlib import Path

GOC = Path.cwd()

CU = (
    'sticky bottom-0 z-10 flex items-center justify-end gap-2 '
    'border-t bg-background py-3'
)
MOI = (
    'sticky bottom-2 z-20 flex flex-wrap items-center justify-end gap-2 '
    'rounded-xl border bg-card/90 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-md'
)

CAC_TEP = [
    'apps/admin/src/components/product-info-tab.tsx',
    'apps/admin/src/components/settings/settings-group-form.tsx',
    'apps/admin/src/app/showroom/[id]/page.tsx',
]

da_va = []
bo_qua = []
thieu = []

for duong_dan in CAC_TEP:
    p = GOC / duong_dan
    if not p.exists():
        thieu.append(duong_dan)
        continue

    s = p.read_text(encoding='utf-8')

    if MOI in s:
        bo_qua.append(duong_dan)
        continue

    if CU not in s:
        print(f'✗ {duong_dan} có cấu trúc khác dự kiến. Dừng lại, CHƯA file nào bị sửa.')
        print(f'  Không tìm thấy đoạn:\n  {CU}')
        sys.exit(1)

    shutil.copy(p, str(p) + '.bak')
    p.write_text(s.replace(CU, MOI), encoding='utf-8')
    da_va.append(duong_dan)

print()
for muc in da_va:
    print(f'✓ Đã vá   {muc}')
for muc in bo_qua:
    print(f'· Có sẵn  {muc}')
for muc in thieu:
    print(f'! Không thấy {muc} — bỏ qua')

if thieu and not da_va and not bo_qua:
    print('\nKhông thấy file nào. Script phải chạy từ THƯ MỤC GỐC dự án')
    print('(chỗ có thư mục apps/ và packages/).\n')
    sys.exit(1)

print('\nXong. Trang quản trị tự tải lại, không cần khởi động lại gì.\n')
