import type { StorefrontBrand } from '@ktm/shared';
import { anhNho } from '@/lib/api';

/**
 * Logo hãng trên nền tối.
 *
 * Logo hãng gần như luôn là chữ sẫm trên nền trong suốt — đặt thẳng lên nền
 * navy là mất hút. Nên đặt trên KHAY TRẮNG bo góc. Cách này còn giữ đúng màu
 * thương hiệu của hãng; làm trắng logo bằng filter thì nhìn thì nổi, nhưng là
 * sửa logo của người ta, nhiều hãng không cho phép.
 *
 * Hãng chưa có logo thì hiện chữ viết tắt trên cùng khay đó, để hàng logo không
 * bị thủng một ô trống.
 */

const CO = {
    /** Dùng cho ô thương hiệu xếp hai cột trên điện thoại — hẹp hơn để còn chỗ cho tên */
    xs: { khay: 'h-9 w-16', chu: 'text-xs' },
    sm: { khay: 'h-10 w-20', chu: 'text-sm' },
    md: { khay: 'h-14 w-28', chu: 'text-lg' },
    lg: { khay: 'h-20 w-40', chu: 'text-2xl' },
} as const;

/** "Avo Lock" → "AL", "Hubert" → "HU" */
function vietTat(ten: string): string {
    const tu = ten.trim().split(/\s+/);
    if (tu.length >= 2) return (tu[0][0] + tu[1][0]).toUpperCase();
    return ten.slice(0, 2).toUpperCase();
}

export function LogoHang({
    hang,
    co = 'md',
}: {
    hang: Pick<StorefrontBrand, 'name' | 'logoUrl'>;
    co?: keyof typeof CO;
}) {
    const kich = CO[co];

    if (!hang.logoUrl) {
        return (
            <span
                aria-hidden="true"
                className={`flex ${kich.khay} shrink-0 items-center justify-center rounded-xl bg-white/10 font-bold tracking-wider text-white/70 ${kich.chu}`}
            >
                {vietTat(hang.name)}
            </span>
        );
    }

    return (
        <span className={`flex ${kich.khay} shrink-0 items-center justify-center rounded-xl bg-white p-2`}>
            <img
                src={anhNho(hang.logoUrl)}
                // Tên hãng đã nằm ngay cạnh logo nên alt để trống, tránh trình đọc
                // màn hình đọc tên hãng hai lần
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain"
            />
        </span>
    );
}
