#!/usr/bin/env python3
"""
Vá 3 file — gài DẤU CHÌM và ĐÈN BÁO để phát hiện website bị sao chép.

VÌ SAO LÀ "PHÁT HIỆN" CHỨ KHÔNG PHẢI "NGĂN CHẶN"
Nội dung công khai thì không ngăn được việc sao chép — ai cũng lưu được thứ
trình duyệt hiển thị. Thứ làm được, và có giá trị thật, là BIẾT NGAY khi nó
xảy ra và CÓ BẰNG CHỨNG có ngày giờ.

GÀI BA THỨ

1. ĐÈN BÁO (apps/web/src/components/site-footer.tsx)
   Một đoạn mã nhỏ: nếu trang đang chạy trên tên miền KHÔNG phải của mình, nó
   lặng lẽ gọi một tấm ảnh 1x1 trên máy chủ của mình, kèm tên miền lạ đó.
   nginx ghi lại vào một file nhật ký riêng. Không cần endpoint mới, không cần
   sửa NestJS — chính nhật ký nginx là hệ thống báo động.

   Kẻ sao chép bằng HTTrack giữ nguyên JavaScript nên đèn này sẽ sáng. Mỗi
   lượt khách của họ là một dòng trong nhật ký của mình, kèm ngày giờ và IP.

   KHÔNG theo dõi khách của chính mình: mã chỉ chạy khi tên miền KHÁC, và chạy
   xong thì thoát ngay. Trên website thật nó không gửi đi đâu một byte nào.

2. DẤU CHÌM (cùng file)
   - Một dòng bản quyền NHÌN THẤY ĐƯỢC, có chứa tên miền. Cố ý để nhìn thấy:
     Google chỉ lập chỉ mục chữ hiển thị, nên gõ đúng câu đó vào Google là ra
     mọi bản sao. Chữ ẩn thì Google coi là gian lận, hại SEO — không dùng.
   - Một chú thích HTML mang mã nhận dạng duy nhất, làm lớp thứ hai cho trường
     hợp họ sửa dòng bản quyền.

3. NƠI NHẬN (deploy/nginx-*.conf)
   location cho tấm ảnh 1x1, ghi nhật ký riêng để không lẫn với nhật ký thường.

Chạy:
    cd /Users/dennis/Projects/huyhoang/khoathongminh
    python3 deploy/va-den-bao-sao-chep.py
"""

import pathlib
import sys

MA_NHAN_DANG = "KTM-NGUON-GOC-BC5F4E8951E5"

CHAN_TRANG = pathlib.Path("apps/web/src/components/site-footer.tsx")
NGINX_SITE = pathlib.Path("deploy/nginx-buoc2-https.conf")
NGINX_CONFD = pathlib.Path("deploy/nginx-conf-d-chong-sao-chep.conf")

# ---------------------------------------------------------------------------
# 1 + 2. Chân trang: dòng bản quyền + chú thích nhận dạng + đèn báo
# ---------------------------------------------------------------------------
CHAN_CU = '''                <p className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
                    © {nam} {congTy.name ?? 'Khóa Thông Minh Chính Hãng'}. Mọi quyền được bảo lưu.
                </p>'''

CHAN_MOI = '''                <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
                    <p>
                        © {nam} {congTy.name ?? 'Khóa Thông Minh Chính Hãng'}. Mọi quyền được bảo lưu.
                    </p>
                    {/*
                     * DẤU CHÌM — câu này cố ý để NHÌN THẤY ĐƯỢC.
                     * Google chỉ lập chỉ mục chữ hiển thị, nên gõ nguyên câu này vào
                     * Google là ra mọi bản sao đã được lập chỉ mục. Giấu chữ đi thì
                     * Google coi là gian lận và phạt SEO — lợi bất cập hại.
                     * Câu này cũng chính là lời tuyên bố bản quyền, nên để ở đây là
                     * đúng chỗ chứ không phải mẹo vặt.
                     */}
                    <p className="mt-1.5">
                        Toàn bộ nội dung, hình ảnh và dữ liệu sản phẩm thuộc bản quyền
                        của khoathongminhchinhhang.vn.
                    </p>
                </div>

                {/*
                 * LỚP NHẬN DẠNG THỨ HAI, phòng khi dòng bản quyền bên trên bị sửa.
                 *
                 * Phải là THUỘC TÍNH trên một phần tử thật, KHÔNG được dùng chú thích
                 * JSX {/* ... *\\/} — chú thích JSX bị xoá lúc biên dịch, không bao giờ
                 * có mặt trong HTML gửi về trình duyệt, nên vô dụng.
                 *
                 * Phần tử rỗng + hidden: không có chữ nào nên Google không coi là giấu
                 * nội dung, nhưng mã vẫn nằm trong mã nguồn trang và đi theo mọi bản
                 * sao chép nguyên file.
                 */}
                <div hidden data-nguon-goc="''' + MA_NHAN_DANG + '''" />

                {/*
                 * ĐÈN BÁO SAO CHÉP.
                 *
                 * Chạy ở máy khách. Nếu tên miền đang mở KHÔNG phải của mình thì gọi
                 * một tấm ảnh 1x1 trên máy chủ của mình, kèm theo tên miền lạ đó;
                 * nginx ghi vào logs/bao-sao-chep.log. Ngược lại thoát ngay, không
                 * gửi đi đâu một byte nào — KHÔNG theo dõi khách của chính mình.
                 *
                 * Dùng ảnh thay vì fetch: không vướng CORS, không cần endpoint mới ở
                 * NestJS, và chạy được cả trên trình duyệt cũ.
                 */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{
var h=location.hostname;
var oke=['khoathongminhchinhhang.vn','www.khoathongminhchinhhang.vn','admin.khoathongminhchinhhang.vn','localhost','127.0.0.1','[::1]'];
if(oke.indexOf(h)>=0)return;
if(/^(192\\\\.168\\\\.|10\\\\.|172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.)/.test(h))return;
new Image().src='https://khoathongminhchinhhang.vn/bao-sao-chep.gif?ten='+encodeURIComponent(h)
+'&duong='+encodeURIComponent(location.pathname.slice(0,120))
+'&tu='+encodeURIComponent((document.referrer||'').slice(0,120));
}catch(e){}})();`,
                    }}
                />'''

# ---------------------------------------------------------------------------
# 3a. nginx: nơi nhận tín hiệu — đặt cạnh ảnh chống sao chép trong khối web
# ---------------------------------------------------------------------------
SITE_CU = '''    location = /chong-sao-chep.png {'''

SITE_MOI = '''    # NƠI NHẬN TÍN HIỆU ĐÈN BÁO.
    # Trang chạy trên tên miền lạ sẽ gọi tấm ảnh 1x1 này kèm tên miền đó.
    # Ghi ra file nhật ký RIÊNG để không lẫn vào hàng nghìn dòng thường ngày.
    # no-store: bắt buộc, không thì trình duyệt lưu lại và chỉ báo đúng một lần.
    location = /bao-sao-chep.gif {
        root /var/www/khoathongminhchinhhang.vn/tinh;
        access_log /var/www/khoathongminhchinhhang.vn/logs/bao-sao-chep.log ktm_bao;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
    }

    location = /chong-sao-chep.png {'''

# ---------------------------------------------------------------------------
# 3b. nginx conf.d: khuôn ghi nhật ký (chỉ khai được ở mức http)
# ---------------------------------------------------------------------------
CONFD_CU = '''# -----------------------------------------------------------------------------
# 3. NHẬN DIỆN CÔNG CỤ SAO CHÉP CẢ WEBSITE'''

CONFD_MOI = '''# -----------------------------------------------------------------------------
# 3. KHUÔN GHI NHẬT KÝ CHO ĐÈN BÁO SAO CHÉP
#
# Chỉ ghi đúng thứ cần cho việc đối chiếu sau này: thời điểm, IP của người xem
# bản sao, tham số (có tên miền lạ), và trình duyệt. Không ghi gì thêm.
# log_format chỉ khai được ở mức http nên phải nằm trong file này.
# -----------------------------------------------------------------------------
log_format ktm_bao '$time_iso8601  ip=$remote_addr  $request_uri  ua="$http_user_agent"';


# -----------------------------------------------------------------------------
# 4. NHẬN DIỆN CÔNG CỤ SAO CHÉP CẢ WEBSITE'''


# Mỗi file có DẤU NHẬN BIẾT riêng để kiểm tra "đã vá chưa". Dùng chung một
# chuỗi cho cả ba là sai: file nginx conf.d không hề chứa mã nhận dạng.
BAN_VA = [
    (CHAN_TRANG, CHAN_CU, CHAN_MOI, MA_NHAN_DANG,
     "chân trang: dấu chìm + đèn báo"),
    (NGINX_SITE, SITE_CU, SITE_MOI, "location = /bao-sao-chep.gif",
     "nginx: nơi nhận tín hiệu đèn báo"),
    (NGINX_CONFD, CONFD_CU, CONFD_MOI, "log_format ktm_bao",
     "nginx: khuôn ghi nhật ký riêng"),
]


def main() -> int:
    if not pathlib.Path("pnpm-workspace.yaml").exists():
        print("Chạy lệnh này từ thư mục gốc dự án:")
        print("   cd /Users/dennis/Projects/huyhoang/khoathongminh")
        return 1

    ke_hoach = []
    for duong, cu, moi, dau_nhan_biet, mo_ta in BAN_VA:
        if not duong.exists():
            print(f"✗ Không thấy file {duong}")
            return 1

        van = duong.read_text(encoding="utf-8")

        if dau_nhan_biet in van:
            print(f"• {duong} — đã vá trước đó, bỏ qua")
            continue

        so_lan = van.count(cu)
        if so_lan != 1:
            print(f"✗ {duong}: tìm thấy {so_lan} chỗ khớp, cần đúng 1.")
            print("  KHÔNG sửa file nào cả. Gửi tôi xem file đó rồi tôi chỉnh bản vá.")
            return 1

        ke_hoach.append((duong, van.replace(cu, moi), mo_ta))

    if not ke_hoach:
        print("\nKhông có gì để vá — cả 3 file đã sửa xong từ trước.")
        return 0

    # Chỉ ghi khi CẢ BA file đều khớp, tránh trạng thái vá nửa chừng
    for duong, noi_dung, mo_ta in ke_hoach:
        duong.write_text(noi_dung, encoding="utf-8")
        print(f"✓ {duong}")
        print(f"    {mo_ta}")

    print()
    print(f"Mã nhận dạng của website này: {MA_NHAN_DANG}")
    print("Lưu mã đó lại. Gõ nó vào Google sau vài tuần để dò bản sao.")
    print()
    print("Tiếp theo:")
    print("   git add -A")
    print('   git commit -m "gai dau chim va den bao phat hien sao chep"')
    print("   git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
