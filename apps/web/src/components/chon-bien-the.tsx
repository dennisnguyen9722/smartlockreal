'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { StorefrontOption, StorefrontVariant } from '@ktm/shared';
import { anhNho, boAnh, dinhDangTien } from '@/lib/api';

/**
 * Ảnh + chọn phiên bản + giá, gộp vào một thành phần phía máy khách.
 *
 * Gộp chung vì ba thứ này ràng nhau: chọn màu thì ảnh đổi, giá đổi, mã SKU đổi.
 * Tách ra thì phải đẩy trạng thái lên trang cha, mà trang cha là thành phần máy
 * chủ — không giữ trạng thái được.
 *
 * Giá trị nào ghép lại không ra phiên bản nào thì bị làm mờ và không bấm được.
 * Để khách bấm rồi mới báo "không có mẫu này" là bắt người ta mò.
 */

interface Props {
    name: string;
    images: string[];
    options: StorefrontOption[];
    variants: StorefrontVariant[];
    warrantyMonths: number;
    hotline: string | null;
    soHienThi: string | null;
}

export function ChonBienThe({
    name,
    images,
    options,
    variants,
    warrantyMonths,
    hotline,
    soHienThi,
}: Props) {
    // Mặc định chọn phiên bản rẻ nhất: khách thấy con số thấp nhất trước,
    // đúng với chữ "từ …" ở trang danh sách dẫn họ vào đây.
    const reNhat = useMemo(
        () => [...variants].sort((a, b) => a.price - b.price)[0],
        [variants],
    );

    const [daChon, setDaChon] = useState<Record<string, string>>(reNhat?.optionValues ?? {});
    const [anhDangXem, setAnhDangXem] = useState<string | null>(null);

    const bienThe = useMemo(
        () =>
            variants.find((item) =>
                options.every((option) => item.optionValues[option.code] === daChon[option.code]),
            ) ?? null,
        [variants, options, daChon],
    );

    /** Giá trị nào ghép với các lựa chọn CÒN LẠI mà vẫn ra phiên bản thật */
    const dungDuoc = useMemo(() => {
        const bang: Record<string, Set<string>> = {};
        for (const option of options) {
            const tap = new Set<string>();
            for (const item of variants) {
                const khopPhanConLai = options.every(
                    (khac) =>
                        khac.code === option.code ||
                        item.optionValues[khac.code] === daChon[khac.code],
                );
                if (khopPhanConLai) {
                    const giaTri = item.optionValues[option.code];
                    if (giaTri) tap.add(giaTri);
                }
            }
            bang[option.code] = tap;
        }
        return bang;
    }, [options, variants, daChon]);

    /** "Đen · App Tuya" — tên các giá trị đang chọn, viết liền cho khách đọc */
    const tenDangChon = useMemo(
        () =>
            options
                .map((option) => option.values.find((giaTri) => giaTri.code === daChon[option.code])?.value)
                .filter(Boolean)
                .join(' · '),
        [options, daChon],
    );

    /*
     * Nháy sáng dòng "Đang chọn" một nhịp mỗi khi đổi phiên bản.
     * Bỏ qua lần dựng đầu tiên, không thì vừa mở trang đã nháy vô cớ.
     */
    const [vuaDoi, setVuaDoi] = useState(false);
    const lanDau = useRef(true);
    useEffect(() => {
        if (lanDau.current) {
            lanDau.current = false;
            return;
        }
        setVuaDoi(true);
        const hen = setTimeout(() => setVuaDoi(false), 600);
        return () => clearTimeout(hen);
    }, [tenDangChon]);

    const anhChinh =
        anhDangXem ?? bienThe?.imageUrl ?? images[0] ?? null;

    const giaGach = bienThe?.compareAtPrice ?? null;
    const giaHienTai = bienThe?.price ?? reNhat?.price ?? 0;
    const coGiam = giaGach !== null && giaGach > giaHienTai;
    const phanTramGiam = coGiam ? Math.round(((giaGach - giaHienTai) / giaGach) * 100) : 0;

    return (
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            {/*
             * min-w-0 ở CẢ HAI cột là bắt buộc, không phải cho đẹp.
             *
             * Ô của lưới mặc định có min-width: auto, nghĩa là nó KHÔNG được phép
             * hẹp hơn phần nội dung hẹp nhất bên trong. Dải ảnh thu nhỏ bên dưới tuy
             * đã có overflow-x-auto để tự cuộn, nhưng nó là khối thường nằm trong ô
             * lưới chứ không phải ô lưới, nên bề rộng tối thiểu của nó vẫn bằng TỔNG
             * các ảnh cộng lại. Ô lưới phình theo, kéo cả trang phình theo.
             *
             * Đo thật trên điện thoại 364px với sản phẩm 10 ảnh: trang rộng 808px,
             * tràn 444px. Thanh điều hướng dưới cùng cũng bị kéo rộng 808px nên nút
             * Menu bị đẩy ra ngoài màn hình, bấm không tới — đó là lý do "menu bấm
             * không được", chứ bản thân cái nút không hỏng.
             *
             * min-w-0 cho phép ô lưới hẹp bằng đúng màn hình, dải ảnh quay về tự cuộn
             * ngang bên trong nó như thiết kế ban đầu.
             */}

            {/* ---------- Ảnh ---------- */}
            <div className="min-w-0">
                <div className="the-sp overflow-hidden rounded-3xl">
                    <div className="vung-anh aspect-square bg-white">
                        {anhChinh ? (
                            <img
                                {...boAnh(anhChinh)}
                                // Nửa bề ngang trên máy tính, tràn ngang trên điện thoại
                                sizes="(max-width: 1024px) 100vw, 620px"
                                alt={name}
                                // Ảnh lớn nhất màn hình đầu: tải ngay, đây là điểm LCP của trang
                                fetchPriority="high"
                                decoding="async"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-[var(--kt-ink-muted)]">
                                Chưa có ảnh
                            </div>
                        )}
                    </div>
                </div>

                {images.length > 1 && (
                    <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {images.map((anh) => (
                            <li key={anh}>
                                <button
                                    type="button"
                                    onClick={() => setAnhDangXem(anh)}
                                    aria-label="Xem ảnh này"
                                    aria-current={anh === anhChinh}
                                    className={`block size-18 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-colors ${
                                        anh === anhChinh ? 'border-[var(--kt-gold)]' : 'border-white/15'
                                    }`}
                                >
                                    {/* Ảnh thu nhỏ 72px: cỡ 400 là thừa sức, không cần srcSet */}
                                    <img
                                        src={anhNho(anh)}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full object-cover"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* ---------- Giá và lựa chọn ---------- */}
            <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-3">
                    <p className="so-lieu text-3xl font-bold text-white sm:text-4xl">
                        {dinhDangTien(giaHienTai)}
                    </p>
                    {coGiam && (
                        <>
                            <p className="so-lieu text-lg text-white/40 line-through">
                                {dinhDangTien(giaGach)}
                            </p>
                            <span className="so-lieu rounded-full bg-[#b3261e] px-2.5 py-1 text-xs font-bold text-white">
                                -{phanTramGiam}%
                            </span>
                        </>
                    )}
                </div>

                {/*
                 * Dòng "Đang chọn".
                 *
                 * Vì sao cần: nhiều sản phẩm có các phiên bản CÙNG GIÁ và KHÔNG có ảnh
                 * riêng. Bấm đổi màu thì thật ra máy đã đổi đúng, nhưng trên màn hình
                 * chỉ có mỗi dòng mã hàng chữ xám nhỏ nhúc nhích — khách tưởng bấm
                 * không ăn. Dòng này đổi chữ mỗi lần bấm nên luôn thấy được, và nháy
                 * sáng một nhịp cho chắc.
                 */}
                {(tenDangChon || bienThe) && (
                    <p
                        // Nháy NHANH khi bật (duration-75) rồi TẮT CHẬM (duration-700):
                        // bật chậm thì màu chưa kịp lên đã phải tắt, nhìn như không nháy.
                        className={`mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2 text-sm ring-1 transition-colors ${
                            vuaDoi
                                ? 'bg-[var(--kt-gold)]/30 ring-[var(--kt-gold)]/60 duration-75'
                                : 'bg-white/5 ring-white/10 duration-700'
                        }`}
                    >
                        <span className="text-white/50">Đang chọn</span>
                        {tenDangChon && <span className="font-semibold text-white">{tenDangChon}</span>}
                        {bienThe && <span className="so-lieu text-white/45">· {bienThe.sku}</span>}
                    </p>
                )}

                {options.map((option) => (
                    <fieldset key={option.code} className="mt-6">
                        <legend className="mb-2 text-sm font-semibold text-white/85">
                            {option.name}
                        </legend>
                        <div className="flex flex-wrap gap-2">
                            {option.values.map((giaTri) => {
                                const dangChon = daChon[option.code] === giaTri.code;
                                const batDuoc = dungDuoc[option.code]?.has(giaTri.code) ?? false;
                                return (
                                    <button
                                        key={giaTri.code}
                                        type="button"
                                        disabled={!batDuoc}
                                        aria-pressed={dangChon}
                                        onClick={() => {
                                            setDaChon((truoc) => ({ ...truoc, [option.code]: giaTri.code }));
                                            // Đổi lựa chọn thì quay về ảnh của phiên bản, bỏ ảnh đang xem tay
                                            setAnhDangXem(null);
                                        }}
                                        className={`rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                                            dangChon
                                                ? 'border-[var(--kt-gold)] bg-[var(--kt-gold)] font-semibold text-[var(--kt-navy-deep)]'
                                                : batDuoc
                                                  ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                                                  : 'cursor-not-allowed border-white/10 bg-white/5 text-white/25 line-through'
                                        }`}
                                    >
                                        {giaTri.value}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                ))}

                <ul className="mt-7 space-y-2 border-t border-white/10 pt-5 text-sm text-white/70">
                    {warrantyMonths > 0 && (
                        <li className="flex gap-2">
                            <span className="text-[var(--kt-gold-soft)]">✓</span>
                            Bảo hành chính hãng {warrantyMonths} tháng
                        </li>
                    )}
                    <li className="flex gap-2">
                        <span className="text-[var(--kt-gold-soft)]">✓</span>
                        Khảo sát cửa trước khi báo giá, lắp đặt tận nơi
                    </li>
                    <li className="flex gap-2">
                        <span className="text-[var(--kt-gold-soft)]">✓</span>
                        Giá trên chưa gồm công lắp, kỹ thuật viên báo rõ khi khảo sát
                    </li>
                </ul>

                {/*
                 * Ba nút liên hệ.
                 *
                 * Bản cũ xếp "Gọi 0902 330 328" và "Nhắn Zalo" cạnh nhau rồi "Để lại số,
                 * gọi lại sau" một hàng nữa — ba khối to bằng nhau, không biết đâu là
                 * việc chính. Trên điện thoại hẹp thì số điện thoại còn bị ngắt xuống
                 * hai dòng, nút phình cao gấp đôi, nhìn rất thô.
                 *
                 * Giờ phân vai rõ: GỌI là việc chính nên chiếm trọn một hàng, nền vàng,
                 * chữ to, có whitespace-nowrap để số không bao giờ bị ngắt dòng. Hai việc
                 * phụ xuống hàng dưới, nhỏ hơn, chia đôi.
                 */}
                <div className="mt-7 space-y-2.5">
                    {hotline && (
                        <a
                            href={`tel:${hotline.replace(/\D/g, '')}`}
                            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--kt-gold)] px-5 py-3.5 font-bold text-[var(--kt-navy-deep)] shadow-lg shadow-black/25 transition-transform hover:scale-[1.01]"
                        >
                            <IconDienThoai />
                            <span className="so-lieu whitespace-nowrap">Gọi {soHienThi}</span>
                        </a>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                        {hotline && (
                            <a
                                href={`https://zalo.me/${hotline.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-xl border border-white/18 bg-white/8 px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/14"
                            >
                                Nhắn Zalo
                            </a>
                        )}
                        <a
                            href="#hoi-gia"
                            className={`rounded-xl border border-white/18 bg-white/8 px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/14 ${
                                hotline ? '' : 'col-span-2'
                            }`}
                        >
                            Để lại số
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Biểu tượng điện thoại cho nút Gọi — vẽ thẳng, apps/web không cài thư viện biểu tượng */
function IconDienThoai() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" />
        </svg>
    );
}
