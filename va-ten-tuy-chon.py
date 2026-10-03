#!/usr/bin/env python3
"""
VÁ TRÌNH NHẬP EXCEL: đừng lấy MÃ tùy chọn làm TÊN HIỂN THỊ nữa.

VÌ SAO:
Ô tùy chọn trong file Excel chỉ có mã, không có tên nhóm:
    mau=vang-ho-phach:Vàng hổ phách | app=tuya:App Tuya
Giá trị thì có tên đẹp ("Vàng hổ phách") nhưng NHÓM thì không, nên
import.service.ts đang làm thế này:

    const option = optionMap.get(optionCode) ?? { name: optionCode, ... };

Kết quả: website hiện chữ "mau" ngay trên hàng nút chọn màu.

Sau khi vá, nhóm được đặt tên theo một bảng tra. Mã lạ không có trong bảng thì
đổi gạch ngang thành khoảng trắng và viết hoa chữ đầu — không đoán thêm dấu
tiếng Việt, vì đoán sai còn tệ hơn.

Bảng tra này CÓ BẢN SAO ở packages/database/scripts/sua-ten-tuy-chon.mjs
(script sửa dữ liệu đã nhập). Sửa bên này nhớ sửa bên kia.

Chạy từ THƯ MỤC GỐC dự án:  python3 va-ten-tuy-chon.py
Chạy lại nhiều lần vẫn an toàn. Bản gốc giữ ở *.bak.
"""
import shutil
import sys
from pathlib import Path

GOC = Path.cwd()
TEP = 'apps/api/src/catalog/import/import.service.ts'

HAM = '''
/**
 * Tên hiển thị cho NHÓM tùy chọn.
 *
 * File Excel chỉ mang mã nhóm ("mau"), không mang tên. Trước đây lấy luôn mã làm
 * tên nên website hiện chữ "mau" trên đầu hàng nút chọn màu.
 *
 * Bảng tra này có bản sao ở packages/database/scripts/sua-ten-tuy-chon.mjs
 * (script sửa những sản phẩm đã lỡ nhập). Sửa bên này nhớ sửa bên kia.
 */
const TEN_NHOM_TUY_CHON: Record<string, string> = {
  mau: 'Màu sắc',
  'mau-sac': 'Màu sắc',
  color: 'Màu sắc',
  app: 'Ứng dụng',
  'ung-dung': 'Ứng dụng',
  'ket-noi': 'Kết nối',
  kieu: 'Kiểu mở',
  'kieu-mo': 'Kiểu mở',
  'kieu-khoa': 'Kiểu khóa',
  loai: 'Loại',
  'loai-khoa': 'Loại khóa',
  size: 'Kích thước',
  'kich-thuoc': 'Kích thước',
  'kich-co': 'Kích cỡ',
  'chat-lieu': 'Chất liệu',
  'vat-lieu': 'Vật liệu',
  'phien-ban': 'Phiên bản',
  version: 'Phiên bản',
  'tay-nam': 'Tay nắm',
  'tay-cam': 'Tay cầm',
  the: 'Thẻ từ',
  'the-tu': 'Thẻ từ',
  'do-day': 'Độ dày',
  'chieu-day': 'Độ dày',
  huong: 'Chiều mở',
  'chieu-mo': 'Chiều mở',
  remote: 'Điều khiển từ xa',
  'dieu-khien': 'Điều khiển',
  camera: 'Camera',
  pin: 'Nguồn điện',
  'van-tay': 'Vân tay',
  'man-hinh': 'Màn hình',
};

function tenTuyChon(ma: string): string {
  const biet = TEN_NHOM_TUY_CHON[ma];
  if (biet) return biet;
  // Mã lạ: "chat-lieu-dac-biet" -> "Chat lieu dac biet". Không tự thêm dấu tiếng
  // Việt vì đoán sai thì tên sai hiện thẳng lên website; nhân viên sửa lại trong
  // trang quản trị là xong.
  const chu = ma.replace(/-+/g, ' ').trim();
  return chu ? chu.charAt(0).toUpperCase() + chu.slice(1) : ma;
}

'''

CU = "const option = optionMap.get(optionCode) ?? { name: optionCode, values: new Map() };"
MOI = "const option = optionMap.get(optionCode) ?? { name: tenTuyChon(optionCode), values: new Map() };"

NEO_HAM = '@Injectable()\nexport class ImportService {'


def main() -> None:
    p = GOC / TEP
    if not p.exists():
        print(f'✗ Không thấy {TEP}')
        print('  Script phải chạy từ THƯ MỤC GỐC dự án (chỗ có thư mục apps/ và packages/).')
        sys.exit(1)

    s = p.read_text(encoding='utf-8')

    if 'function tenTuyChon' in s and MOI in s:
        print('\n· File đã vá rồi, không phải sửa gì.\n')
        return

    if NEO_HAM not in s:
        print(f'✗ {TEP} có cấu trúc khác dự kiến. Dừng lại, chưa sửa gì.')
        print(f'  Không tìm thấy đoạn: {NEO_HAM!r}')
        sys.exit(1)

    if CU not in s and MOI not in s:
        print(f'✗ {TEP} có cấu trúc khác dự kiến. Dừng lại, chưa sửa gì.')
        print(f'  Không tìm thấy dòng:\n  {CU}')
        sys.exit(1)

    if 'function tenTuyChon' not in s:
        s = s.replace(NEO_HAM, HAM.lstrip('\n') + NEO_HAM, 1)
    if CU in s:
        s = s.replace(CU, MOI, 1)

    shutil.copy(p, str(p) + '.bak')
    p.write_text(s, encoding='utf-8')

    print(f'\n✓ Đã vá {TEP}')
    print('  - thêm bảng tra TEN_NHOM_TUY_CHON và hàm tenTuyChon()')
    print('  - nhóm tùy chọn lấy tên từ bảng tra thay vì lấy mã\n')
    print('Chạy lại máy chủ API:')
    print('    pnpm --filter @ktm/api dev\n')


main()
