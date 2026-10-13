import Link from 'next/link';
import type { StorefrontHome, StorefrontTaxonomy } from '@ktm/shared';
import { dinhDangDienThoai, layDanhSachChinhSach, soGoi } from '@/lib/api';

/**
 * Chân trang. Thuần máy chủ (không 'use client') nên không tốn JavaScript gửi về máy khách.
 * Thông tin công ty lấy từ cấu hình trong trang quản trị, không viết cứng ở đây —
 * sửa số điện thoại trong admin là cả website đổi theo.
 *
 * Danh sách chính sách tự lấy ở đây chứ không nhận qua props: Next.js gộp các lần
 * gọi trùng nhau trong cùng một lượt dựng trang, nên không tốn thêm lần gọi API,
 * mà layout.tsx thì khỏi phải sửa.
 */

interface Props {
    loaiCua: StorefrontTaxonomy[];
    congTy: StorefrontHome['company'];
}

export async function SiteFooter({ loaiCua, congTy }: Props) {
    const chinhSach = await layDanhSachChinhSach();
    const soBam = congTy.hotline ? soGoi(congTy.hotline) : null;
    const soHienThi = congTy.hotline ? dinhDangDienThoai(congTy.hotline) : null;
    const nam = new Date().getFullYear();

    return (
        <footer className="border-t border-white/10 bg-[var(--kt-navy-deep)]">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12">
                    <div>
                        {/*
                          Dùng biểu tượng + chữ thay cho logo đầy đủ: logo đầy đủ có dòng
                          địa chỉ web rất nhỏ, thu về cỡ chân trang thì đọc không ra chữ.
                        */}
                        <div className="flex items-center gap-4">
                            <img
                                src="/logo-bieu-tuong-sang.svg"
                                alt=""
                                width={56}
                                height={56}
                                className="h-14 w-14"
                            />
                            <span className="leading-tight">
                                <span className="block text-lg font-bold text-white">
                                    Khóa Thông Minh
                                </span>
                                <span className="block text-xs font-medium tracking-[0.2em] text-[var(--kt-gold-soft)] uppercase">
                                    Chính hãng
                                </span>
                            </span>
                        </div>
                        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">
                            Nhà phân phối khóa cửa thông minh chính hãng. Tư vấn chọn khóa đúng loại cửa,
                            lắp đặt tận nơi và bảo hành theo tiêu chuẩn hãng.
                        </p>

                        {soBam && (
                            <div className="mt-6 flex flex-wrap gap-3">
                                <a
                                    href={`tel:${soBam}`}
                                    className="rounded-2xl bg-[var(--kt-gold)] px-5 py-3 text-sm font-bold text-[var(--kt-navy-deep)]"
                                >
                                    Gọi {soHienThi}
                                </a>
                                <a
                                    href={`https://zalo.me/${soBam}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
                                >
                                    Nhắn Zalo
                                </a>
                            </div>
                        )}
                    </div>

                    <nav aria-label="Khóa theo loại cửa">
                        <h2 className="text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Khóa theo loại cửa
                        </h2>
                        <ul className="mt-4 space-y-2.5">
                            {loaiCua.map((muc) => (
                                <li key={muc.slug}>
                                    <Link
                                        href={`/khoa/${muc.slug}`}
                                        className="text-sm text-white/70 transition-colors hover:text-white"
                                    >
                                        Khóa {muc.name.toLowerCase()}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div>
                        <h2 className="text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Liên hệ
                        </h2>
                        <ul className="mt-4 space-y-3 text-sm text-white/70">
                            {congTy.address && (
                                <li className="leading-relaxed">{congTy.address}</li>
                            )}
                            {soBam && (
                                <li>
                                    <a href={`tel:${soBam}`} className="hover:text-white">
                                        {soHienThi}
                                    </a>
                                </li>
                            )}
                            {congTy.email && (
                                <li>
                                    <a href={`mailto:${congTy.email}`} className="hover:text-white">
                                        {congTy.email}
                                    </a>
                                </li>
                            )}
                        </ul>

                        <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Thông tin
                        </h2>
                        <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                            <li>
                                <Link href="/san-pham" className="hover:text-white">
                                    Tất cả sản phẩm
                                </Link>
                            </li>
                            <li>
                                <Link href="/thuong-hieu" className="hover:text-white">
                                    Thương hiệu
                                </Link>
                            </li>
                            <li>
                                <Link href="/showroom" className="hover:text-white">
                                    Showroom
                                </Link>
                            </li>
                            <li>
                                <Link href="/bai-viet" className="hover:text-white">
                                    Kinh nghiệm chọn khóa
                                </Link>
                            </li>
                            <li>
                                <Link href="/lien-he" className="hover:text-white">
                                    Liên hệ
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/*
                      Chính sách: cột riêng vì đây là chỗ khách quen tìm, và cũng là
                      chỗ Google kiểm khi xét website bán hàng có đáng tin không.
                      Chưa soạn bản nào thì khối tự ẩn, không để lại cột trống.
                    */}
                    {chinhSach.length > 0 && (
                        <div>
                            <h2 className="text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                                Chính sách
                            </h2>
                            <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                                {chinhSach.map((muc) => (
                                    <li key={muc.slug}>
                                        <Link href={`/chinh-sach/${muc.slug}`} className="hover:text-white">
                                            {muc.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
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
                 * JSX {/* ... *\/} — chú thích JSX bị xoá lúc biên dịch, không bao giờ
                 * có mặt trong HTML gửi về trình duyệt, nên vô dụng.
                 *
                 * Phần tử rỗng + hidden: không có chữ nào nên Google không coi là giấu
                 * nội dung, nhưng mã vẫn nằm trong mã nguồn trang và đi theo mọi bản
                 * sao chép nguyên file.
                 */}
                <div hidden data-nguon-goc="KTM-NGUON-GOC-BC5F4E8951E5" />

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
if(/^(192\\.168\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.)/.test(h))return;
new Image().src='https://khoathongminhchinhhang.vn/bao-sao-chep.gif?ten='+encodeURIComponent(h)
+'&duong='+encodeURIComponent(location.pathname.slice(0,120))
+'&tu='+encodeURIComponent((document.referrer||'').slice(0,120));
}catch(e){}})();`,
                    }}
                />
            </div>

            {/*
             * Chừa chỗ cho thanh điều hướng cố định dưới cùng trên điện thoại.
             * Thanh đó dùng position: fixed nên nằm ĐÈ lên trang; không chừa chỗ thì
             * nó che mất mấy dòng cuối chân trang, khách cuộn hết cỡ vẫn không đọc được.
             * env(safe-area-inset-bottom) là vạch gạt ngang của iPhone không có nút Home.
             */}
            <div
                aria-hidden="true"
                className="lg:hidden"
                // Thanh cao 4.25rem + viền + 0.75rem cách mép dưới; thêm chút cho thoáng
                style={{ height: 'calc(5.75rem + env(safe-area-inset-bottom))' }}
            />
        </footer>
    );
}
