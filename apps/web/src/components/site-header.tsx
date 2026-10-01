'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StorefrontTaxonomy } from '@ktm/shared';
import { dinhDangDienThoai, soGoi } from '@/lib/api';

/**
 * Thanh điều hướng dính trên đầu trang.
 * Đây là phần tử DUY NHẤT trong website dùng backdrop-filter (class .kinh-thanh):
 * một phần tử, vùng nhỏ, luôn hiện — trình duyệt chịu được.
 * Thẻ sản phẩm dùng .kinh (kính giả, không làm mờ nền) vì có hàng chục cái một trang.
 */

interface Props {
    loaiCua: StorefrontTaxonomy[];
    hotline: string | null;
}

// Thương hiệu không nằm ở đây: đã có cả dải thương hiệu ở trang chủ và ở chân trang.
// Thanh điều hướng quá 5 mục là khách không đọc nữa, chỉ lướt qua.
const LIEN_KET = [
    { href: '/san-pham', nhan: 'Tất cả sản phẩm' },
    { href: '/showroom', nhan: 'Showroom' },
    { href: '/bai-viet', nhan: 'Bài viết' },
    { href: '/lien-he', nhan: 'Liên hệ' },
];

export function SiteHeader({ loaiCua, hotline }: Props) {
    const [moMenu, setMoMenu] = useState(false);
    const duongDan = usePathname();

    // Chuyển trang thì đóng menu điện thoại lại, không thì nó che mất trang mới
    useEffect(() => {
        setMoMenu(false);
    }, [duongDan]);

    // Mở menu thì khóa cuộn nền, tránh cuộn hai lớp cùng lúc trên điện thoại
    useEffect(() => {
        if (!moMenu) return;
        const cu = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = cu;
        };
    }, [moMenu]);

    const soHienThi = hotline ? dinhDangDienThoai(hotline) : null;
    const soBam = hotline ? soGoi(hotline) : null;

    return (
        <header className="kinh-thanh sticky top-0 z-50">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-20 lg:gap-8">
                <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Về trang chủ">
                    {/* Dùng <img> chứ không dùng next/image: file SVG tĩnh, không cần tối ưu lại */}
                    <img
                        src="/logo-bieu-tuong-sang.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="h-9 w-9 lg:h-11 lg:w-11"
                    />
                    <span className="hidden text-left leading-tight sm:block">
                        <span className="block text-sm font-bold tracking-tight text-white lg:text-base">
                            Khóa Thông Minh
                        </span>
                        <span className="block text-[11px] font-medium tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Chính hãng
                        </span>
                    </span>
                </Link>

                <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
                    <MenuLoaiCua loaiCua={loaiCua} />
                    {LIEN_KET.map((muc) => (
                        <Link
                            key={muc.href}
                            href={muc.href}
                            className="rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            {muc.nhan}
                        </Link>
                    ))}
                </nav>

                {soBam && (
                    <a
                        href={`tel:${soBam}`}
                        className="ml-auto flex items-center gap-2 rounded-2xl bg-[var(--kt-gold)] px-3 py-2 text-sm font-bold text-[var(--kt-navy-deep)] shadow-lg shadow-black/25 transition-transform hover:scale-[1.03] lg:ml-0 lg:px-4 lg:py-2.5"
                    >
                        <IconDienThoai />
                        {/* Màn hình hẹp chỉ hiện biểu tượng, chữ số chiếm chỗ của menu */}
                        <span className="hidden sm:inline">{soHienThi}</span>
                    </a>
                )}

                <button
                    type="button"
                    onClick={() => setMoMenu((truoc) => !truoc)}
                    aria-expanded={moMenu}
                    aria-controls="menu-dien-thoai"
                    aria-label={moMenu ? 'Đóng menu' : 'Mở menu'}
                    className="rounded-xl border border-white/20 bg-white/10 p-2 text-white lg:hidden"
                >
                    {moMenu ? <IconDong /> : <IconMenu />}
                </button>
            </div>

            {moMenu && (
                <div
                    id="menu-dien-thoai"
                    className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-[var(--kt-navy-deep)] px-4 pb-6 lg:hidden"
                >
                    <p className="pt-4 pb-2 text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                        Chọn theo loại cửa
                    </p>
                    <ul className="grid grid-cols-2 gap-2">
                        {loaiCua.map((muc) => (
                            <li key={muc.slug}>
                                <Link
                                    href={`/khoa-${muc.slug}`}
                                    className="block rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-sm font-medium text-white"
                                >
                                    {muc.name}
                                    <span className="mt-0.5 block text-xs font-normal text-white/55">
                                        {muc.productCount} sản phẩm
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <ul className="mt-4 space-y-1 border-t border-white/10 pt-4">
                        {LIEN_KET.map((muc) => (
                            <li key={muc.href}>
                                <Link
                                    href={muc.href}
                                    className="block rounded-xl px-2 py-2.5 text-sm font-medium text-white/85"
                                >
                                    {muc.nhan}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
}

/**
 * Menu đổ xuống cho loại cửa.
 * Mở bằng group-hover (chuột) VÀ focus-within (bàn phím) — không dùng useState,
 * nên không có nhấp nháy khi trang vừa tải xong.
 */
function MenuLoaiCua({ loaiCua }: { loaiCua: StorefrontTaxonomy[] }) {
    if (loaiCua.length === 0) return null;

    return (
        <div className="group relative">
            <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition-colors group-hover:bg-white/10 group-hover:text-white"
                aria-haspopup="true"
            >
                Theo loại cửa
                <IconMuiTenXuong />
            </button>

            {/* invisible + opacity thay vì hidden: giữ được hiệu ứng mờ dần và vẫn chặn bấm nhầm */}
            <div className="invisible absolute top-full left-0 z-10 w-[30rem] pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <ul className="grid grid-cols-2 gap-1 rounded-3xl border border-white/15 bg-[var(--kt-navy-deep)] p-2 shadow-2xl shadow-black/50">
                    {loaiCua.map((muc) => (
                        <li key={muc.slug}>
                            <Link
                                href={`/khoa-${muc.slug}`}
                                className="block rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/10"
                            >
                                <span className="block text-sm font-semibold text-white">{muc.name}</span>
                                <span className="block text-xs text-white/55">{muc.productCount} sản phẩm</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/* Biểu tượng vẽ thẳng bằng SVG: apps/web không cài lucide-react, thêm thư viện
   chỉ để lấy 4 cái biểu tượng là không đáng. */

function IconDienThoai() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" />
        </svg>
    );
}

function IconMuiTenXuong() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

function IconMenu() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
    );
}

function IconDong() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}
