'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StorefrontBanner } from '@ktm/shared';

/**
 * Dải banner đầu trang.
 *
 * Chuyển ảnh bằng ĐỘ MỜ (opacity), không bằng dịch chuyển (transform).
 * Lý do: thanh điều hướng phía trên có backdrop-filter — nó phải lấy mẫu lại vùng
 * nền mỗi khi vùng đó đổi. Dịch chuyển cả dải ảnh rộng 3 màn hình làm vùng lấy mẫu
 * đổi liên tục trong suốt 500ms; đổi độ mờ tại chỗ thì trình duyệt xử lý trên card
 * đồ họa, không phải vẽ lại bố cục.
 *
 * Ảnh thứ nhất tải ngay (nằm ngay đầu trang, ảnh hưởng trực tiếp điểm LCP của Google),
 * các ảnh sau để trình duyệt tự hoãn.
 *
 * Tỉ lệ khung khớp đúng kích thước mà hệ thống khai báo cho vị trí HOME_HERO:
 * máy tính 1920×640 (3:1), điện thoại 800×1000 (4:5). Lệch tỉ lệ là ảnh bị cắt.
 */

interface Props {
    banners: StorefrontBanner[];
}

const GIAY_DOI_ANH = 6000;

export function BannerSlider({ banners }: Props) {
    const [hienTai, setHienTai] = useState(0);
    const [tamDung, setTamDung] = useState(false);

    const soLuong = banners.length;

    const den = useCallback(
        (chiSo: number) => {
            setHienTai(((chiSo % soLuong) + soLuong) % soLuong);
        },
        [soLuong],
    );

    useEffect(() => {
        if (soLuong < 2 || tamDung) return;

        // Người dùng đã tắt hiệu ứng chuyển động trong hệ điều hành thì không tự chạy
        const thichIt = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (thichIt.matches) return;

        const dongHo = window.setInterval(() => {
            // Tab đang ẩn thì đứng yên, đỡ tốn pin và không "nhảy" mấy tấm khi quay lại
            if (document.hidden) return;
            setHienTai((truoc) => (truoc + 1) % soLuong);
        }, GIAY_DOI_ANH);

        return () => window.clearInterval(dongHo);
    }, [soLuong, tamDung]);

    if (soLuong === 0) return null;

    return (
        <section
            aria-roledescription="carousel"
            aria-label="Banner khuyến mãi"
            className="relative"
            onMouseEnter={() => setTamDung(true)}
            onMouseLeave={() => setTamDung(false)}
            onFocus={() => setTamDung(true)}
            onBlur={() => setTamDung(false)}
        >
            <div
                className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--kt-navy-deep)] sm:aspect-[3/1]"
            >
                {banners.map((banner, chiSo) => (
                    <div
                        key={`${banner.title}-${chiSo}`}
                        className="absolute inset-0 transition-opacity duration-700"
                        style={{
                            opacity: chiSo === hienTai ? 1 : 0,
                            // Tấm đang ẩn không nhận chuột, nếu không sẽ chặn mất tấm đang hiện
                            pointerEvents: chiSo === hienTai ? 'auto' : 'none',
                        }}
                        aria-hidden={chiSo !== hienTai}
                    >
                        <NoiDungBanner banner={banner} uuTien={chiSo === 0} />
                    </div>
                ))}
            </div>

            {soLuong > 1 && (
                <>
                    <NutChuyen huong="trai" onClick={() => den(hienTai - 1)} />
                    <NutChuyen huong="phai" onClick={() => den(hienTai + 1)} />

                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-5">
                        {banners.map((banner, chiSo) => (
                            <button
                                key={`cham-${banner.title}-${chiSo}`}
                                type="button"
                                onClick={() => den(chiSo)}
                                aria-label={`Xem banner ${chiSo + 1}`}
                                aria-current={chiSo === hienTai}
                                className="h-2 rounded-full transition-all"
                                style={{
                                    width: chiSo === hienTai ? 28 : 8,
                                    backgroundColor:
                                        chiSo === hienTai ? 'var(--kt-gold)' : 'rgba(255,255,255,0.5)',
                                }}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

function NoiDungBanner({ banner, uuTien }: { banner: StorefrontBanner; uuTien: boolean }) {
    const anh = (
        <picture>
            {/* Ảnh riêng cho điện thoại nếu có: ảnh ngang 1440×450 cắt trên màn hình dọc rất xấu */}
            {banner.mobileImageUrl && (
                <source media="(max-width: 639px)" srcSet={banner.mobileImageUrl} />
            )}
            <img
                src={banner.imageUrl ?? banner.mobileImageUrl ?? ''}
                alt={banner.title}
                loading={uuTien ? 'eager' : 'lazy'}
                fetchPriority={uuTien ? 'high' : 'low'}
                decoding="async"
                className="h-full w-full object-cover"
            />
        </picture>
    );

    if (!banner.imageUrl && !banner.mobileImageUrl) return null;

    if (banner.linkUrl) {
        return (
            <a href={banner.linkUrl} className="block h-full w-full" aria-label={banner.title}>
                {anh}
            </a>
        );
    }

    return anh;
}

function NutChuyen({ huong, onClick }: { huong: 'trai' | 'phai'; onClick: () => void }) {
    const laTrai = huong === 'trai';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={laTrai ? 'Banner trước' : 'Banner sau'}
            className={`absolute top-1/2 hidden -translate-y-1/2 rounded-2xl border border-white/25 bg-black/35 p-2.5 text-white transition-colors hover:bg-black/55 sm:block ${
                laTrai ? 'left-4' : 'right-4'
            }`}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d={laTrai ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
            </svg>
        </button>
    );
}
