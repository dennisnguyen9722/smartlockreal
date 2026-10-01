import Link from 'next/link';
import type { StorefrontCard } from '@ktm/shared';
import { dinhDangGiaTu, dinhDangTien } from '@/lib/api';

/**
 * Thẻ sản phẩm kiểu "kính".
 * Dùng class .kinh — trong mờ + viền sáng + vệt sáng mép trên, KHÔNG có backdrop-filter.
 * Mắt thường gần như không phân biệt được với kính thật, nhưng trình duyệt không phải
 * vẽ lại vùng nền mỗi lần cuộn, nên một trang 24 thẻ vẫn cuộn mượt trên điện thoại.
 *
 * Toàn bộ là thành phần máy chủ: không gửi thêm một byte JavaScript nào về máy khách.
 */

interface Props {
    sanPham: StorefrontCard;
    /** Ảnh ở màn hình đầu tiên nên tải ngay; ảnh phía dưới để trình duyệt tự hoãn */
    uuTienAnh?: boolean;
}

export function ProductCard({ sanPham, uuTienAnh = false }: Props) {
    // Gán ra biến const trước khi so sánh: TypeScript tự hiểu trong nhánh `coGiam`
    // thì giaGach chắc chắn là số, khỏi phải ép kiểu bằng `as number`.
    const giaGach = sanPham.compareAtPrice;
    const coGiam = giaGach !== null && giaGach > sanPham.priceFrom;
    const phanTramGiam = coGiam ? Math.round(((giaGach - sanPham.priceFrom) / giaGach) * 100) : 0;

    return (
        <Link
            href={`/san-pham/${sanPham.slug}`}
            className="the-sp group flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1"
        >
            {/*
              Khung VUÔNG và ảnh tràn hết khung, không đệm.
              Ảnh sản phẩm là ảnh thiết kế sẵn dạng vuông (viền xanh, logo hãng,
              tem bảo hành in sẵn trong ảnh) chứ không phải ảnh chụp nền trong.
              Khung 4/5 cũ cao hơn ảnh nên thừa hai dải trắng trên dưới, cộng
              thêm đệm p-4, làm ảnh trông bé và trôi giữa thẻ.
            */}
            <div className="vung-anh relative aspect-square overflow-hidden bg-white">
                {sanPham.imageUrl ? (
                    // <img> thường chứ không phải next/image: ảnh nằm trên máy chủ lưu trữ riêng,
                    // dùng next/image sẽ phải khai báo remotePatterns và tốn thêm một vòng xử lý ảnh.
                    <img
                        src={sanPham.imageUrl}
                        alt={sanPham.name}
                        loading={uuTienAnh ? 'eager' : 'lazy'}
                        fetchPriority={uuTienAnh ? 'high' : 'auto'}
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--kt-ink-muted)]">
                        Chưa có ảnh
                    </div>
                )}

                {/*
                  Chỉ còn nhãn giảm giá đè lên ảnh. Nhãn bảo hành bỏ khỏi đây vì
                  ảnh của bạn đã in sẵn tem "36 tháng bảo hành" — đè thêm một cái
                  nữa là nói hai lần cùng một chuyện và che mất ảnh.
                */}
                {coGiam && phanTramGiam > 0 && (
                    <span className="so-lieu absolute top-2.5 left-2.5 rounded-full bg-[#b3261e] px-2 py-0.5 text-[11px] font-bold text-white shadow-lg shadow-black/25 sm:top-3 sm:left-3 sm:px-2.5 sm:py-1 sm:text-xs">
                        -{phanTramGiam}%
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-wide text-[var(--kt-gold-soft)] uppercase">
                    {sanPham.brandName ?? sanPham.categoryName}
                    {sanPham.warrantyMonths > 0 && (
                        <span className="so-lieu font-medium text-white/40 normal-case">
                            BH {sanPham.warrantyMonths} tháng
                        </span>
                    )}
                </p>

                {/*
                  Chốt chiều cao đúng 2 dòng: tên dài ngắn khác nhau mà không chốt
                  thì giá ở các thẻ cùng hàng nằm lệch nhau, nhìn rất lộn xộn.
                */}
                <h3 className="line-clamp-2 min-h-[2.6rem] text-[15px] leading-snug font-semibold text-white">
                    {sanPham.name}
                </h3>

                {sanPham.colorLabels.length > 0 && (
                    <ChamMau nhanMau={sanPham.colorLabels} />
                )}

                <div className="mt-auto pt-2">
                    <p className="so-lieu text-[15px] leading-snug font-bold text-white sm:text-lg">
                        {dinhDangGiaTu(sanPham.priceFrom, sanPham.variantCount > 1)}
                    </p>
                    {coGiam && (
                        <p className="so-lieu mt-1 text-sm text-white/45 line-through">
                            {dinhDangTien(giaGach)}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}

/** Tối đa 5 chấm, dư thì hiện "+n" — nhiều hơn nữa là vỡ hàng trên điện thoại */
function ChamMau({ nhanMau }: { nhanMau: string[] }) {
    const hien = nhanMau.slice(0, 5);
    const con = nhanMau.length - hien.length;

    return (
        <ul className="flex items-center gap-1.5" aria-label="Màu có sẵn">
            {hien.map((nhan) => (
                <li
                    key={nhan}
                    title={nhan}
                    aria-label={nhan}
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-white/35"
                    style={{ backgroundColor: maTuNhan(nhan) }}
                />
            ))}
            {con > 0 && <li className="text-xs text-white/55">+{con}</li>}
        </ul>
    );
}

/**
 * Đoán mã màu từ tên màu tiếng Việt.
 * Bỏ dấu rồi dò từ khóa, nên "Xám xanh", "xam xanh", "XÁM XANH" đều ra một kết quả.
 * Thứ tự quan trọng: "xám xanh" phải xét trước "xám", "vàng hồng" trước "vàng".
 */
const BANG_MAU: [RegExp, string][] = [
    [/vang hong|rose/, '#b76e79'],
    [/xam xanh|blue ?grey|blue ?gray/, '#5c6b7a'],
    [/xanh la|xanh luc|green/, '#2f6b4f'],
    [/xanh|blue|navy/, '#2d4a7a'],
    [/den|black/, '#1b1d21'],
    [/trang|white/, '#f2f3f5'],
    [/titan/, '#6e7073'],
    [/bac|silver|inox/, '#c6cad1'],
    [/xam|grey|gray/, '#8a8f98'],
    [/vang|gold/, '#c9a227'],
    [/dong|copper|bronze/, '#a3673a'],
    [/nau|brown|cafe/, '#5a3b28'],
    [/do|red/, '#a62b2b'],
    [/kem|be\b|cream|ivory/, '#e6dcc8'],
];

function maTuNhan(nhan: string): string {
    const chuan = nhan
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .trim();

    for (const [mau, ma] of BANG_MAU) {
        if (mau.test(chuan)) return ma;
    }
    return '#7a8292';
}
