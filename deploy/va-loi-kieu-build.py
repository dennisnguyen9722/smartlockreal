#!/usr/bin/env python3
"""
Vá 3 lỗi kiểu làm hỏng "next build" của web và admin.

VÌ SAO TỚI GIỜ MỚI LỘ
    "next dev" không kiểm tra kiểu toàn dự án, chỉ "next build" mới làm. Ba lỗi
    này nằm im từ lúc viết cho tới lần build thật đầu tiên trên VPS.

GỐC CHUNG
    tsconfig.base.json bật "noUncheckedIndexedAccess", nên mọi phép truy cập
    mảng bằng chỉ số đều có kiểu "T | undefined". Đây là thiết lập TỐT — nó bắt
    đúng loại lỗi hay gây màn hình trắng lúc chạy thật — nên cách sửa là viết
    code chịu được undefined, KHÔNG phải tắt nó đi hay rắc dấu "!".

ĐÃ KIỂM CHỨNG bằng TypeScript 5.9.3 với đúng thiết lập đó:
    - "mang.length > 0" KHÔNG thu hẹp được kiểu của mang[0]   -> vẫn lỗi
    - "mang[0] &&"       CÓ thu hẹp được                       -> hết lỗi
    - bản vietTat mới cho kết quả giống hệt bản cũ trên mọi tên hãng thật

Chạy:
    cd /Users/dennis/Projects/huyhoang/khoathongminh
    python3 deploy/va-loi-kieu-build.py
"""

import pathlib
import sys

# --------------------------------------------------------------------------
# 1. apps/web/src/components/logo-hang.tsx
#    tu[0] có kiểu "string | undefined" nên tu[0][0] là lỗi.
# --------------------------------------------------------------------------
LOGO_CU = '''function vietTat(ten: string): string {
    const tu = ten.trim().split(/\\s+/);
    if (tu.length >= 2) return (tu[0][0] + tu[1][0]).toUpperCase();
    return ten.slice(0, 2).toUpperCase();
}'''

LOGO_MOI = '''function vietTat(ten: string): string {
    // filter(Boolean) để chuỗi toàn khoảng trắng không sinh ra phần tử rỗng.
    const tu = ten.trim().split(/\\s+/).filter(Boolean);
    // noUncheckedIndexedAccess đang bật: tu[0] có kiểu "string | undefined",
    // nên viết thẳng tu[0][0] là lỗi kiểu. Lấy ra biến rồi kiểm tra mới là sửa
    // thật — dùng dấu "!" chỉ làm TypeScript im lặng chứ không bớt rủi ro.
    const dau = tu[0]?.[0];
    const hai = tu[1]?.[0];
    if (dau && hai) return (dau + hai).toUpperCase();
    return ten.trim().slice(0, 2).toUpperCase();
}'''

# --------------------------------------------------------------------------
# 2. apps/web/src/app/showroom/[slug]/page.tsx
#    TypeScript không suy ra được "length > 0 thì phần tử 0 tồn tại".
#    Kiểm tra thẳng phần tử 0 thì nó thu hẹp được. Hiển thị không đổi:
#    mảng có phần tử đầu khác rỗng <=> length > 0 (đường dẫn ảnh không rỗng).
# --------------------------------------------------------------------------
SHOW_CU = '''{showroom.images.length > 0 && (
                            <>
                                <img
                                    {...boAnh(showroom.images[0])}'''

SHOW_MOI = '''{/* Kiểm tra THẲNG images[0], không dùng images.length > 0: TypeScript
                            thu hẹp được kiểu khi truy cập mảng bằng chỉ số hằng, nhưng
                            không suy ra được "length > 0 thì phần tử 0 tồn tại". */}
                        {showroom.images[0] && (
                            <>
                                <img
                                    {...boAnh(showroom.images[0])}'''

# --------------------------------------------------------------------------
# 3. apps/admin/src/app/noi-bat/page.tsx
#    Phép hoán đổi gán "SanPham | undefined" vào ô kiểu "SanPham".
# --------------------------------------------------------------------------
NOIBAT_CU = '''            const sao = [...truoc];
            [sao[tu], sao[den]] = [sao[den], sao[tu]];
            return sao;'''

NOIBAT_MOI = '''            const sao = [...truoc];
            // noUncheckedIndexedAccess: sao[den] có kiểu "SanPham | undefined",
            // gán thẳng vào sao[tu] là lỗi kiểu.
            //
            // Tiện thể vá một lỗ thật, không chỉ là chuyện kiểu: hàm này chỉ
            // kiểm tra "den", không kiểm tra "tu". Gọi với "tu" ngoài khoảng là
            // ghi undefined vào danh sách và làm hỏng khối sản phẩm nổi bật.
            // Thiếu phần tử thì trả nguyên mảng cũ, không đổi gì.
            const a = sao[tu];
            const b = sao[den];
            if (!a || !b) return truoc;
            sao[tu] = b;
            sao[den] = a;
            return sao;'''


BAN_VA = [
    ("apps/web/src/components/logo-hang.tsx", LOGO_CU, LOGO_MOI,
     "vietTat: tu[0][0] -> lấy ra biến rồi kiểm tra"),
    ("apps/web/src/app/showroom/[slug]/page.tsx", SHOW_CU, SHOW_MOI,
     "images.length > 0 -> images[0]"),
    ("apps/admin/src/app/noi-bat/page.tsx", NOIBAT_CU, NOIBAT_MOI,
     "doiCho: hoán đổi an toàn, có kiểm tra cả hai đầu"),
]


def main() -> int:
    if not pathlib.Path("pnpm-workspace.yaml").exists():
        print("Không thấy pnpm-workspace.yaml — chạy lệnh này từ thư mục gốc dự án:")
        print("   cd /Users/dennis/Projects/huyhoang/khoathongminh")
        return 1

    ke_hoach = []
    for duong_dan, cu, moi, mo_ta in BAN_VA:
        f = pathlib.Path(duong_dan)
        if not f.exists():
            print(f"✗ Không thấy file {duong_dan}")
            return 1

        van = f.read_text(encoding="utf-8")

        if moi in van:
            print(f"• {duong_dan} — đã vá trước đó, bỏ qua")
            continue

        so_lan = van.count(cu)
        if so_lan != 1:
            print(f"✗ {duong_dan}: tìm thấy {so_lan} chỗ khớp, cần đúng 1.")
            print("  File có thể đã khác bản tôi đọc. KHÔNG sửa gì cả.")
            print("  Gửi tôi xem đoạn đó rồi tôi chỉnh lại bản vá.")
            return 1

        ke_hoach.append((f, van.replace(cu, moi), duong_dan, mo_ta))

    if not ke_hoach:
        print("\nKhông có gì để vá — cả 3 file đã sửa xong từ trước.")
        return 0

    # Chỉ ghi khi CẢ BA file đều khớp, để không rơi vào trạng thái vá nửa chừng
    for f, noi_dung, duong_dan, mo_ta in ke_hoach:
        f.write_text(noi_dung, encoding="utf-8")
        print(f"✓ {duong_dan}")
        print(f"    {mo_ta}")

    print()
    print("Tiếp theo:")
    print("   git add -A")
    print('   git commit -m "sua 3 loi kieu lam hong next build"')
    print("   git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
