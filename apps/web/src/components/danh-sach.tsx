import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    STOREFRONT_SORTS,
    STOREFRONT_SORT_LABEL,
    type StorefrontSort,
    type StorefrontTaxonomy,
} from '@ktm/shared';
import type { DanhSachSanPham } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

/**
 * Lưới sản phẩm kèm bộ lọc, dùng chung cho /san-pham và /khoa/<loại cửa>.
 *
 * Toàn bộ bộ lọc là THẺ LINK, không phải JavaScript. Ba cái lợi:
 *  - Mỗi tổ hợp lọc là một địa chỉ riêng, gửi Zalo cho khách được, Google vào được.
 *  - Bấm nút Quay lại của trình duyệt chạy đúng như người ta mong đợi.
 *  - Trang không cần một byte JavaScript nào để lọc.
 * Ô tìm kiếm dùng thẻ <form method="get">, cũng chạy khi tắt JavaScript.
 */

export const KHOANG_GIA = [
    { ma: 'duoi-5', nhan: 'Dưới 5 triệu', minPrice: undefined, maxPrice: 5_000_000 },
    { ma: '5-10', nhan: '5 – 10 triệu', minPrice: 5_000_000, maxPrice: 10_000_000 },
    { ma: '10-20', nhan: '10 – 20 triệu', minPrice: 10_000_000, maxPrice: 20_000_000 },
    { ma: 'tren-20', nhan: 'Trên 20 triệu', minPrice: 20_000_000, maxPrice: undefined },
] as const;

interface Props {
    ketQua: DanhSachSanPham;
    loaiCua: StorefrontTaxonomy[];
    hang: StorefrontTaxonomy[];
    /** '/san-pham' hoặc '/khoa/cua-go' */
    duongDanGoc: string;
    /** Các tham số đang có trên URL (không gồm cái đã nằm trong đường dẫn) */
    thamSo: Record<string, string>;
    /** Trang loại cửa: ẩn bộ lọc loại cửa vì đã nằm trong đường dẫn */
    anLocLoaiCua?: boolean;
}

function lamUrl(
    goc: string,
    hienTai: Record<string, string>,
    thayDoi: Record<string, string | undefined>,
    giuTrang = false,
) {
    const p = new URLSearchParams(hienTai);
    for (const [khoa, giaTri] of Object.entries(thayDoi)) {
        if (giaTri === undefined || giaTri === '') p.delete(khoa);
        else p.set(khoa, giaTri);
    }
    // Đổi bộ lọc mà giữ nguyên số trang thì dễ rơi vào trang trống
    if (!giuTrang) p.delete('page');
    const chuoi = p.toString();
    return chuoi ? `${goc}?${chuoi}` : goc;
}

export function DanhSachSanPhamView({
    ketQua,
    loaiCua,
    hang,
    duongDanGoc,
    thamSo,
    anLocLoaiCua = false,
}: Props) {
    const sort = (thamSo.sort as StorefrontSort) ?? 'moi-nhat';
    const soTrang = Math.max(1, Math.ceil(ketQua.total / Math.max(1, ketQua.pageSize)));
    const trang = ketQua.page;

    const giaDangChon = KHOANG_GIA.find(
        (muc) =>
            String(muc.minPrice ?? '') === (thamSo.minPrice ?? '') &&
            String(muc.maxPrice ?? '') === (thamSo.maxPrice ?? ''),
    );

    const coLocGi =
        Boolean(thamSo.q) ||
        Boolean(thamSo.brand) ||
        Boolean(thamSo.minPrice) ||
        Boolean(thamSo.maxPrice) ||
        (!anLocLoaiCua && Boolean(thamSo.doorType));

    return (
        <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
            {/* ---------- Ô tìm kiếm ---------- */}
            <form action={duongDanGoc} method="get" className="mb-6 flex flex-wrap gap-2">
                {/* Giữ lại các bộ lọc khác khi gửi form; q nhập mới nên không đưa vào đây */}
                {Object.entries(thamSo)
                    .filter(([khoa]) => khoa !== 'q' && khoa !== 'page')
                    .map(([khoa, giaTri]) => (
                        <input key={khoa} type="hidden" name={khoa} value={giaTri} />
                    ))}
                <input
                    type="search"
                    name="q"
                    defaultValue={thamSo.q ?? ''}
                    placeholder="Tìm theo tên hoặc mã model, ví dụ KL-989F"
                    className="min-w-56 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[var(--kt-gold-soft)] focus:outline-none"
                />
                <button
                    type="submit"
                    className="rounded-2xl bg-[var(--kt-gold)] px-6 py-3 text-sm font-bold text-[var(--kt-navy-deep)]"
                >
                    Tìm
                </button>
            </form>

            {/* ---------- Bộ lọc ---------- */}
            <div className="space-y-4">
                {!anLocLoaiCua && loaiCua.length > 0 && (
                    <Hang nhan="Loại cửa">
                        <Chip href={lamUrl(duongDanGoc, thamSo, { doorType: undefined })} dangChon={!thamSo.doorType}>
                            Tất cả
                        </Chip>
                        {loaiCua.map((muc) => (
                            <Chip
                                key={muc.slug}
                                href={lamUrl(duongDanGoc, thamSo, { doorType: muc.slug })}
                                dangChon={thamSo.doorType === muc.slug}
                            >
                                {muc.name}
                                <span className="so-lieu ml-1.5 text-xs opacity-60">{muc.productCount}</span>
                            </Chip>
                        ))}
                    </Hang>
                )}

                {hang.length > 0 && (
                    <Hang nhan="Thương hiệu">
                        <Chip href={lamUrl(duongDanGoc, thamSo, { brand: undefined })} dangChon={!thamSo.brand}>
                            Tất cả
                        </Chip>
                        {hang.map((muc) => (
                            <Chip
                                key={muc.slug}
                                href={lamUrl(duongDanGoc, thamSo, { brand: muc.slug })}
                                dangChon={thamSo.brand === muc.slug}
                            >
                                {muc.name}
                                <span className="so-lieu ml-1.5 text-xs opacity-60">{muc.productCount}</span>
                            </Chip>
                        ))}
                    </Hang>
                )}

                <Hang nhan="Khoảng giá">
                    <Chip
                        href={lamUrl(duongDanGoc, thamSo, { minPrice: undefined, maxPrice: undefined })}
                        dangChon={!giaDangChon}
                    >
                        Tất cả
                    </Chip>
                    {KHOANG_GIA.map((muc) => (
                        <Chip
                            key={muc.ma}
                            href={lamUrl(duongDanGoc, thamSo, {
                                minPrice: muc.minPrice ? String(muc.minPrice) : undefined,
                                maxPrice: muc.maxPrice ? String(muc.maxPrice) : undefined,
                            })}
                            dangChon={giaDangChon?.ma === muc.ma}
                        >
                            {muc.nhan}
                        </Chip>
                    ))}
                </Hang>

                <Hang nhan="Sắp xếp">
                    {STOREFRONT_SORTS.map((muc) => (
                        <Chip
                            key={muc}
                            href={lamUrl(duongDanGoc, thamSo, { sort: muc === 'moi-nhat' ? undefined : muc })}
                            dangChon={sort === muc}
                        >
                            {STOREFRONT_SORT_LABEL[muc]}
                        </Chip>
                    ))}
                </Hang>
            </div>

            {/* ---------- Kết quả ---------- */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
                <p className="so-lieu text-sm text-white/65">
                    {ketQua.total > 0 ? (
                        <>
                            <span className="font-semibold text-white">{ketQua.total}</span> sản phẩm
                            {soTrang > 1 && ` · trang ${trang}/${soTrang}`}
                        </>
                    ) : (
                        'Không có sản phẩm nào khớp'
                    )}
                </p>
                {coLocGi && (
                    <Link
                        href={duongDanGoc}
                        className="text-sm text-[var(--kt-gold-soft)] underline-offset-4 hover:underline"
                    >
                        Bỏ hết bộ lọc
                    </Link>
                )}
            </div>

            {ketQua.items.length === 0 ? (
                <div className="kinh mt-6 rounded-3xl p-10 text-center">
                    <p className="font-semibold text-white">Không tìm thấy sản phẩm nào</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">
                        Thử bỏ bớt bộ lọc, hoặc gọi hotline để chúng tôi tìm giúp — nhiều mẫu còn hàng
                        mà chưa kịp lên website.
                    </p>
                </div>
            ) : (
                <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {ketQua.items.map((sanPham, chiSo) => (
                        <li key={sanPham.slug}>
                            <ProductCard sanPham={sanPham} uuTienAnh={chiSo < 4} />
                        </li>
                    ))}
                </ul>
            )}

            {soTrang > 1 && (
                <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Phân trang">
                    <NutTrang
                        href={lamUrl(duongDanGoc, thamSo, { page: String(trang - 1) }, true)}
                        tat={trang <= 1}
                    >
                        Trang trước
                    </NutTrang>
                    {soTrangHienThi(trang, soTrang).map((so, chiSo) =>
                        so === null ? (
                            <span key={`cach-${chiSo}`} className="px-2 text-white/40">
                                …
                            </span>
                        ) : (
                            <Link
                                key={so}
                                href={lamUrl(duongDanGoc, thamSo, { page: so === 1 ? undefined : String(so) }, true)}
                                aria-current={so === trang ? 'page' : undefined}
                                className={`so-lieu min-w-10 rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                                    so === trang
                                        ? 'bg-[var(--kt-gold)] text-[var(--kt-navy-deep)]'
                                        : 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                                }`}
                            >
                                {so}
                            </Link>
                        ),
                    )}
                    <NutTrang
                        href={lamUrl(duongDanGoc, thamSo, { page: String(trang + 1) }, true)}
                        tat={trang >= soTrang}
                    >
                        Trang sau
                    </NutTrang>
                </nav>
            )}
        </div>
    );
}

/** Luôn hiện trang đầu, trang cuối và vài trang quanh trang hiện tại; chỗ cách thì "…" */
function soTrangHienThi(hienTai: number, tong: number): (number | null)[] {
    if (tong <= 7) return Array.from({ length: tong }, (_, i) => i + 1);
    const tap = new Set([1, tong, hienTai, hienTai - 1, hienTai + 1]);
    const ds = [...tap].filter((so) => so >= 1 && so <= tong).sort((a, b) => a - b);
    const ra: (number | null)[] = [];
    let truoc = 0;
    for (const so of ds) {
        if (truoc && so - truoc > 1) ra.push(null);
        ra.push(so);
        truoc = so;
    }
    return ra;
}

function Hang({ nhan, children }: { nhan: string; children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-xs font-semibold tracking-[0.14em] text-white/45 uppercase">
                {nhan}
            </span>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

function Chip({
    href,
    dangChon,
    children,
}: {
    href: string;
    dangChon: boolean;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-current={dangChon ? 'true' : undefined}
            className={`rounded-xl px-3.5 py-2 text-sm transition-colors ${
                dangChon
                    ? 'bg-[var(--kt-gold)] font-semibold text-[var(--kt-navy-deep)]'
                    : 'border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
            }`}
        >
            {children}
        </Link>
    );
}

function NutTrang({
    href,
    tat,
    children,
}: {
    href: string;
    tat: boolean;
    children: ReactNode;
}) {
    if (tat) {
        return (
            <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/25">
                {children}
            </span>
        );
    }
    return (
        <Link
            href={href}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
        >
            {children}
        </Link>
    );
}
