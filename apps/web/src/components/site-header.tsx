'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { StorefrontTaxonomy } from '@ktm/shared';
import { dinhDangDienThoai, soGoi } from '@/lib/api';

/**
 * Điều hướng chính. HAI dạng khác hẳn nhau tùy bề ngang màn hình:
 *
 *   Máy tính (lg trở lên): thanh dính TRÊN ĐẦU trang như cũ.
 *   Điện thoại:            thanh cố định DƯỚI CÙNG màn hình, trên đầu không có gì.
 *
 * Vì sao đổi: trên điện thoại thanh trên ăn mất 64px chỗ đẹp nhất màn hình, đẩy
 * tên sản phẩm và ảnh xuống dưới. Mà ngón tay cầm điện thoại thì với tới mép
 * DƯỚI dễ hơn mép trên nhiều. Đưa xuống dưới được cả hai: nội dung bắt đầu từ
 * sát mép trên, còn nút Gọi thì nằm ngay chỗ ngón cái.
 *
 * Logo vẫn còn, nằm ở ô đầu tiên của thanh dưới và đóng vai nút "Trang chủ".
 *
 * .kinh-thanh (backdrop-filter) chỉ dùng cho MỘT phần tử duy nhất trong cả website
 * — ở đây là thanh này. Thẻ sản phẩm dùng .kinh (kính giả) vì có hàng chục cái
 * một trang, làm mờ nền hàng chục lần là máy yếu giật.
 */

interface Props {
    loaiCua: StorefrontTaxonomy[];
    hotline: string | null;
}

// Thương hiệu KHÔNG nằm ở đây mà ở chân trang: trang chủ đã có cả dải logo
// thương hiệu rồi, còn thanh menu quá 5 mục là khách không đọc nữa, chỉ lướt qua.
const LIEN_KET = [
    { href: '/san-pham', nhan: 'Tất cả sản phẩm' },
    { href: '/showroom', nhan: 'Showroom' },
    { href: '/bai-viet', nhan: 'Bài viết' },
    { href: '/lien-he', nhan: 'Liên hệ' },
];

export function SiteHeader({ loaiCua, hotline }: Props) {
    const [moMenu, setMoMenu] = useState(false);
    const [moLoaiCua, setMoLoaiCua] = useState(false);
    const duongDan = usePathname();

    // Chuyển trang thì đóng cả hai menu lại, không thì nó che mất trang mới
    useEffect(() => {
        setMoMenu(false);
        setMoLoaiCua(false);
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

    const dangOTrangChu = duongDan === '/';
    const dangXemHang = duongDan.startsWith('/san-pham') || duongDan.startsWith('/khoa/');

    return (
        <>
        {/* ======================= Máy tính: thanh trên ======================= */}
        <header className="kinh-thanh sticky top-0 z-50 hidden lg:block">
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
                    <MenuLoaiCua loaiCua={loaiCua} dangMo={moLoaiCua} setDangMo={setMoLoaiCua} />
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
                        className="flex items-center gap-2 rounded-2xl bg-[var(--kt-gold)] px-4 py-2.5 text-sm font-bold text-[var(--kt-navy-deep)] shadow-lg shadow-black/25 transition-transform hover:scale-[1.03]"
                    >
                        <IconDienThoai />
                        {soHienThi}
                    </a>
                )}
            </div>
        </header>

        {/*
          * Điện thoại: chừa một khoảng ở MÉP TRÊN.
          *
          * Bỏ thanh trên rồi thì nội dung bắt đầu từ pixel đầu tiên — mà chỗ đó
          * trên iPhone là thanh giờ/pin và tai thỏ, trên Android là thanh trạng thái.
          * Chữ chui xuống dưới mấy thứ đó, nhìn chật và bẩn.
          *
          * env(safe-area-inset-top) là phần hệ điều hành báo "đừng vẽ gì vào đây",
          * máy không có tai thỏ thì bằng 0 nên vẫn còn 0.75rem cho thoáng.
          */}
        <div
            aria-hidden="true"
            className="lg:hidden"
            style={{ height: 'calc(0.75rem + env(safe-area-inset-top))' }}
        />

        {/* ===================== Điện thoại: thanh dưới ===================== */}

        {/*
          * Lớp phủ: bấm ra ngoài là đóng menu. Dùng <button> chứ không dùng <div>
          * để bàn phím và trình đọc màn hình cũng đóng được.
          */}
        {moMenu && (
            <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMoMenu(false)}
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
        )}

        {/*
          * Thanh NỔI, không dán vào ba mép màn hình: chừa 0.75rem mỗi bên và
          * dưới (cộng thêm vạch gạt ngang của iPhone). Nhìn nhẹ hơn hẳn so với
          * dán sát đáy, và ngón tay không bị trượt ra ngoài mép màn hình khi bấm.
          */}
        <div
            className="fixed inset-x-0 bottom-0 z-50 px-3 lg:hidden"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
            {/*
              * Tấm menu trượt lên từ dưới. Đặt là anh em NGAY TRÊN thanh trong cùng
              * một khối fixed, nên nó tự nằm đúng trên thanh — khỏi phải đo chiều cao
              * thanh rồi tính bottom cho khớp, kiểu đó sai ngay khi iPhone có vạch gạt.
              */}
            {moMenu && (
                <div
                    id="menu-dien-thoai"
                    className="mb-2 max-h-[70vh] overflow-y-auto rounded-3xl border border-white/12 bg-[var(--kt-navy-deep)] px-4 pb-5 shadow-2xl shadow-black/60"
                >
                    {/* Vạch kéo: dấu hiệu quen thuộc cho biết đây là tấm trượt, kéo xuống được */}
                    <div className="sticky top-0 -mx-4 bg-[var(--kt-navy-deep)] pt-3 pb-2">
                        <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-white/25" />
                    </div>

                    <p className="pt-2 pb-2 text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                        Chọn theo loại cửa
                    </p>
                    <ul className="grid grid-cols-2 gap-2">
                        {loaiCua.map((muc) => (
                            <li key={muc.slug}>
                                <Link
                                    href={`/khoa/${muc.slug}`}
                                    onClick={() => setMoMenu(false)}
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
                                    onClick={() => setMoMenu(false)}
                                    className="block rounded-xl px-2 py-2.5 text-sm font-medium text-white/85"
                                >
                                    {muc.nhan}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <nav
                aria-label="Điều hướng chính"
                className="kinh-thanh overflow-hidden rounded-3xl shadow-2xl shadow-black/50"
                style={{
                    // .kinh-thanh chỉ đặt border-bottom vì nó sinh ra cho thanh dính
                    // TRÊN ĐẦU trang. Thanh này nổi giữa màn hình nên cần viền đủ bốn
                    // cạnh. Khai bằng style chứ không bằng class Tailwind: .kinh-thanh
                    // viết ngoài @layer nên theo thứ tự xếp chồng của CSS, nó thắng
                    // mọi class tiện ích — border-0 của Tailwind không gỡ được.
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                }}
            >
                <div className="mx-auto flex h-[4.25rem] max-w-md items-stretch gap-1 px-2">
                    <OTrongThanh href="/" nhan="Trang chủ" dangChon={dangOTrangChu}>
                        {/* Dùng <img> chứ không dùng next/image: file SVG tĩnh, không cần tối ưu lại */}
                        <img src="/logo-bieu-tuong-sang.svg" alt="" width={26} height={26} className="h-6.5 w-6.5" />
                    </OTrongThanh>

                    <OTrongThanh href="/san-pham" nhan="Sản phẩm" dangChon={dangXemHang}>
                        <IconHop />
                    </OTrongThanh>

                    {soBam && (
                        <a
                            href={`tel:${soBam}`}
                            aria-label={soHienThi ? `Gọi ${soHienThi}` : 'Gọi tư vấn'}
                            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-[var(--kt-gold)] text-[var(--kt-navy-deep)]"
                        >
                            <IconDienThoai co={22} />
                            <span className="text-[11px] leading-none font-bold">Gọi tư vấn</span>
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={() => setMoMenu((truoc) => !truoc)}
                        aria-expanded={moMenu}
                        aria-controls="menu-dien-thoai"
                        className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
                            moMenu ? 'bg-white/12 text-white' : 'text-white/70'
                        }`}
                    >
                        {moMenu ? <IconDong /> : <IconMenu />}
                        <span className="text-[11px] leading-none font-medium">
                            {moMenu ? 'Đóng' : 'Menu'}
                        </span>
                    </button>
                </div>
            </nav>
        </div>
        </>
    );
}

/** Một ô trong thanh dưới: biểu tượng ở trên, chữ ở dưới, cả ô là vùng bấm */
function OTrongThanh({
    href,
    nhan,
    dangChon,
    children,
}: {
    href: string;
    nhan: string;
    dangChon: boolean;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-current={dangChon ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
                dangChon ? 'bg-white/10 text-white' : 'text-white/70'
            }`}
        >
            {children}
            <span className="text-[11px] leading-none font-medium">{nhan}</span>
        </Link>
    );
}

/**
 * Menu đổ xuống cho loại cửa.
 *
 * Bản đầu mở/đóng bằng CSS thuần (group-hover + group-focus-within). Gọn, nhưng
 * sai: bấm vào một mục thì thẻ <a> NHẬN FOCUS, mà còn focus thì focus-within
 * còn đúng, nên menu vẫn mở sau khi đã chuyển trang — phải bấm ra chỗ khác mới
 * mất. CSS thuần không biết được "vừa chuyển trang xong".
 *
 * Phân biệt chuột với cảm ứng bằng pointerType, đo thật trên trình duyệt:
 *   chuột bấm   → pointerenter "mouse", click "mouse",  detail 1
 *   chạm tay    → pointerenter "touch", click "touch",  detail 1
 *   bàn phím    → (không có pointerenter), click "",    detail 0
 * Nên: chuột thì rê vào là mở, bấm nút không làm gì (rê vào đã mở rồi, bấm nữa
 * thành đóng ngay thì vô lý). Chạm và bàn phím thì bấm nút để đóng mở.
 *
 * Đóng trong năm trường hợp: chuột rời ra, bấm vào một mục, bấm Esc, Tab ra
 * khỏi hẳn, và chuyển trang (useEffect ở SiteHeader lo).
 */
function MenuLoaiCua({
    loaiCua,
    dangMo,
    setDangMo,
}: {
    loaiCua: StorefrontTaxonomy[];
    dangMo: boolean;
    setDangMo: Dispatch<SetStateAction<boolean>>;
}) {
    const nutRef = useRef<HTMLButtonElement>(null);

    if (loaiCua.length === 0) return null;

    return (
        <div
            className="relative"
            onPointerEnter={(sukien) => {
                if (sukien.pointerType === 'mouse') setDangMo(true);
            }}
            onPointerLeave={(sukien) => {
                if (sukien.pointerType === 'mouse') setDangMo(false);
            }}
            // Tab ra khỏi hẳn khối này thì đóng. relatedTarget là nơi focus SẮP tới;
            // còn nằm trong khối thì giữ nguyên để đi tiếp trong menu được.
            onBlur={(sukien) => {
                if (!sukien.currentTarget.contains(sukien.relatedTarget as Node | null)) {
                    setDangMo(false);
                }
            }}
            onKeyDown={(sukien) => {
                if (sukien.key !== 'Escape' || !dangMo) return;
                setDangMo(false);
                // Trả focus về nút, không để focus rơi vào khoảng không
                nutRef.current?.focus();
            }}
        >
            <button
                ref={nutRef}
                type="button"
                // Cũng bắt ở ngay nút, không chỉ ở khối ngoài: bấm xong một mục thì
                // menu đóng, nhưng con trỏ vẫn nằm TRONG khối ngoài, nên rê lên nút
                // sẽ không sinh ra pointerenter ở khối ngoài và menu không mở lại.
                onPointerEnter={(sukien) => {
                    if (sukien.pointerType === 'mouse') setDangMo(true);
                }}
                onClick={(sukien) => {
                    // Chuột đã có rê vào lo rồi; chỉ chạm và bàn phím mới cần bấm
                    if ((sukien.nativeEvent as PointerEvent).pointerType === 'mouse') return;
                    setDangMo((truoc) => !truoc);
                }}
                aria-haspopup="true"
                aria-expanded={dangMo}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    dangMo ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
            >
                Theo loại cửa
                <span className={`transition-transform ${dangMo ? 'rotate-180' : ''}`}>
                    <IconMuiTenXuong />
                </span>
            </button>

            {/* invisible + opacity thay vì hidden: giữ được hiệu ứng mờ dần và vẫn chặn bấm nhầm */}
            <div
                className={`absolute top-full left-0 z-10 w-[30rem] pt-2 transition-opacity ${
                    dangMo ? 'visible opacity-100' : 'invisible opacity-0'
                }`}
            >
                <ul
                    // Bấm vào mục nào cũng đóng, kể cả khi bấm đúng loại cửa đang xem
                    // (lúc đó đường dẫn không đổi nên useEffect không chạy)
                    onClick={() => setDangMo(false)}
                    className="grid grid-cols-2 gap-1 rounded-3xl border border-white/15 bg-[var(--kt-navy-deep)] p-2 shadow-2xl shadow-black/50"
                >
                    {loaiCua.map((muc) => (
                        <li key={muc.slug}>
                            <Link
                                href={`/khoa/${muc.slug}`}
                                // Menu đang đóng thì các mục bên trong không được nhận phím Tab
                                tabIndex={dangMo ? undefined : -1}
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

function IconDienThoai({ co = 16 }: { co?: number }) {
    return (
        <svg width={co} height={co} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
    );
}

/** Thùng hàng — ô "Sản phẩm" ở thanh dưới */
function IconHop() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
    );
}

function IconDong() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}
