import Link from 'next/link';
import type { ReactNode } from 'react';
import type {
    StorefrontBanner,
    StorefrontBrandSection,
    StorefrontCard,
    StorefrontFaq,
    StorefrontPost,
    StorefrontReview,
    StorefrontShowroom,
} from '@ktm/shared';
import { ProductCard } from '@/components/product-card';
import { boAnh, dinhDangDienThoai, soGoi } from '@/lib/api';
import { FormTuVan } from '@/components/form-tu-van';

/**
 * Các khối nội dung của trang chủ.
 * Tách khỏi page.tsx để page.tsx chỉ còn việc ghép thứ tự các khối —
 * nhìn một màn hình là biết trang chủ có gì, không phải cuộn 700 dòng.
 *
 * Tất cả đều là thành phần máy chủ: không gửi JavaScript nào về máy khách.
 * Phần đóng/mở câu hỏi dùng thẻ <details> có sẵn của trình duyệt.
 */

/* ===================== Mảnh dùng chung ===================== */

export function TieuDeKhoi({ nhan, tieuDe, mo }: { nhan: string; tieuDe: string; mo?: string }) {
    return (
        <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                {nhan}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                {tieuDe}
            </h2>
            {mo && <p className="mt-3 leading-relaxed text-white/65">{mo}</p>}
        </div>
    );
}

export function SoLieu({ so, nhan }: { so: string; nhan: string }) {
    return (
        <div>
            <dt className="sr-only">{nhan}</dt>
            <dd>
                <span className="so-lieu block text-2xl font-bold text-[var(--kt-gold-soft)] sm:text-3xl">
                    {so}
                </span>
                <span className="mt-1 block text-sm text-white/60">{nhan}</span>
            </dd>
        </div>
    );
}

export function CamKet({ icon, tieuDe, mo }: { icon: ReactNode; tieuDe: string; mo: string }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[var(--kt-gold-soft)]">{icon}</span>
            <span>
                <span className="block font-semibold text-white">{tieuDe}</span>
                <span className="mt-1 block text-sm leading-relaxed text-white/60">{mo}</span>
            </span>
        </li>
    );
}

/* ===================== Dải dự án (B2B) ===================== */

const VIEC_DU_AN = [
    'Kỹ sư đến khảo sát cánh cửa và hệ thống điện tại công trình',
    'Báo giá theo số lượng, có chiết khấu bậc thang và điều khoản thanh toán',
    'Cấp hồ sơ kỹ thuật, CO/CQ và chứng nhận chính hãng cho hồ sơ nghiệm thu',
    'Lắp đặt theo tiến độ bàn giao, bảo hành tập trung một đầu mối',
];

/**
 * Khối dành cho nhà thầu và chủ đầu tư.
 * Để trên nền navy nhạt hơn phần còn lại và có gạch vàng bên trái:
 * khách lẻ cuộn qua sẽ nhận ra ngay "phần này không dành cho mình",
 * còn nhà thầu thì thấy nổi bật giữa trang bán lẻ.
 */
export function DaiDuAn({ hotline }: { hotline: string | null }) {
    const soBam = hotline ? soGoi(hotline) : null;
    const soHienThi = hotline ? dinhDangDienThoai(hotline) : null;

    return (
        <section id="bao-gia-du-an" className="scroll-mt-20 border-y border-white/10 bg-[var(--kt-navy)]">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
                <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
                    <div>
                        <div className="border-l-2 border-[var(--kt-gold)] pl-6">
                            <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                                Dành cho nhà thầu và chủ đầu tư
                            </p>
                            <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                                Làm chung cư, khách sạn hay văn phòng?
                            </h2>
                            <p className="mt-4 leading-relaxed text-white/70">
                                Từ 20 bộ khóa trở lên, chúng tôi làm việc theo quy trình dự án: khảo
                                sát trước, báo giá theo số lượng, lắp theo tiến độ bàn giao và bảo hành
                                qua một đầu mối duy nhất.
                            </p>
                        </div>

                        <ul className="mt-7 space-y-3">
                            {VIEC_DU_AN.map((viec) => (
                                <li key={viec} className="flex gap-3">
                                    <span className="mt-0.5 shrink-0 text-[var(--kt-gold-soft)]">
                                        <IconDau />
                                    </span>
                                    <span className="text-sm leading-relaxed text-white/75">{viec}</span>
                                </li>
                            ))}
                        </ul>

                        {soBam && (
                            <p className="mt-7 text-sm text-white/60">
                                Cần gấp thì gọi thẳng{' '}
                                <a
                                    href={`tel:${soBam}`}
                                    className="so-lieu font-bold text-[var(--kt-gold-soft)] underline-offset-4 hover:underline"
                                >
                                    {soHienThi}
                                </a>
                            </p>
                        )}
                    </div>

                    <FormTuVan
                        kind="PROJECT"
                        tieuDe="Gửi yêu cầu báo giá"
                        mo="Để lại số, kỹ sư gọi lại trong giờ làm việc. Chỉ cần họ tên và số điện thoại, phần còn lại hỏi trong cuộc gọi cũng được."
                        sourcePath="/#bao-gia-du-an"
                    />
                </div>
            </div>
        </section>
    );
}

/* ===================== Banner khuyến mãi giữa trang ===================== */

export function BangKhuyenMai({ banners }: { banners: StorefrontBanner[] }) {
    if (banners.length === 0) return null;

    return (
        <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
            <ul className={banners.length > 1 ? 'grid gap-4 md:grid-cols-2' : ''}>
                {banners.map((banner, chiSo) => {
                    const anh = (
                        <picture>
                            {banner.mobileImageUrl && (
                                <source media="(max-width: 639px)" srcSet={banner.mobileImageUrl} />
                            )}
                            <img
                                src={banner.imageUrl ?? banner.mobileImageUrl ?? ''}
                                alt={banner.title}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full rounded-3xl object-cover"
                            />
                        </picture>
                    );

                    return (
                        <li key={`${banner.title}-${chiSo}`} className="overflow-hidden rounded-3xl">
                            {banner.linkUrl ? (
                                <a href={banner.linkUrl} aria-label={banner.title}>
                                    {anh}
                                </a>
                            ) : (
                                anh
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/* ===================== Showroom ===================== */

export function KhoiShowroom({ showrooms }: { showrooms: StorefrontShowroom[] }) {
    if (showrooms.length === 0) return null;

    return (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
            <TieuDeKhoi
                nhan="Xem tận tay"
                tieuDe="Đến showroom thử trực tiếp"
                mo="Khóa là thứ cầm vào mới biết có ưng không. Mời bạn đến bấm thử, mở thử, so sánh vài mẫu cạnh nhau rồi hẵng quyết."
            />

            <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {showrooms.map((showroom) => (
                    <li key={showroom.slug} className="kinh flex flex-col overflow-hidden rounded-3xl">
                        {showroom.imageUrl && (
                            <img
                                {...boAnh(showroom.imageUrl)}
                                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
                                alt={showroom.name}
                                loading="lazy"
                                decoding="async"
                                className="aspect-[16/10] w-full object-cover"
                            />
                        )}

                        <div className="flex flex-1 flex-col gap-3 p-5">
                            <h3 className="text-lg font-bold text-white">{showroom.name}</h3>

                            <p className="flex gap-2 text-sm leading-relaxed text-white/65">
                                <span className="mt-0.5 shrink-0 text-[var(--kt-gold-soft)]">
                                    <IconGhim />
                                </span>
                                {showroom.address}
                            </p>

                            {showroom.openingHours.length > 0 && (
                                <ul className="space-y-0.5 text-sm text-white/55">
                                    {showroom.openingHours.map((dong) => (
                                        <li key={dong} className="so-lieu">
                                            {dong}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="mt-auto flex flex-wrap gap-2 pt-3">
                                {showroom.phone && (
                                    <a
                                        href={`tel:${soGoi(showroom.phone)}`}
                                        className="so-lieu rounded-xl bg-[var(--kt-gold)] px-4 py-2 text-sm font-bold text-[var(--kt-navy-deep)]"
                                    >
                                        {dinhDangDienThoai(showroom.phone)}
                                    </a>
                                )}
                                {showroom.directionsUrl && (
                                    <a
                                        href={showroom.directionsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
                                    >
                                        Chỉ đường
                                    </a>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ===================== Đánh giá khách hàng ===================== */

export function KhoiDanhGia({
    reviews,
    tongSo,
    diemTrungBinh,
}: {
    reviews: StorefrontReview[];
    tongSo: number;
    diemTrungBinh: number | null;
}) {
    if (reviews.length === 0) return null;

    return (
        <section className="nen-sang-mo border-y border-white/10">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <TieuDeKhoi nhan="Khách đã lắp nói gì" tieuDe="Đánh giá thật từ khách hàng" />
                    {diemTrungBinh !== null && (
                        <p className="so-lieu text-sm text-white/65">
                            <span className="text-2xl font-bold text-[var(--kt-gold-soft)]">
                                {diemTrungBinh.toFixed(1)}
                            </span>
                            {' / 5 — '}
                            {tongSo} đánh giá
                        </p>
                    )}
                </div>

                {/* Kéo ngang trên điện thoại, lưới trên máy tính: 9 thẻ xếp dọc là quá dài */}
                <ul className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
                    {reviews.map((danhGia, chiSo) => (
                        <li
                            key={`${danhGia.product.slug}-${chiSo}`}
                            className="kinh flex w-[85%] shrink-0 snap-start flex-col gap-3 rounded-3xl p-5 sm:w-[48%] lg:w-auto"
                        >
                            <ChamSao diem={danhGia.rating} />

                            {danhGia.content && (
                                <p className="line-clamp-5 text-sm leading-relaxed text-white/75">
                                    {danhGia.content}
                                </p>
                            )}

                            {danhGia.photoUrls.length > 0 && (
                                <ul className="flex gap-2">
                                    {danhGia.photoUrls.slice(0, 3).map((anh) => (
                                        <li key={anh}>
                                            <img
                                                src={anh}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                className="h-16 w-16 rounded-xl object-cover"
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="mt-auto pt-2">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                                    {danhGia.reviewerName}
                                    {danhGia.verifiedPurchase && (
                                        <span className="rounded-full bg-[var(--kt-gold)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--kt-gold-soft)]">
                                            Đã mua hàng
                                        </span>
                                    )}
                                </p>
                                <Link
                                    href={`/san-pham/${danhGia.product.slug}`}
                                    className="mt-1 block text-xs text-white/50 hover:text-white/80"
                                >
                                    {danhGia.product.name}
                                </Link>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

function ChamSao({ diem }: { diem: number }) {
    return (
        <p className="flex gap-0.5" aria-label={`${diem} trên 5 sao`}>
            {[1, 2, 3, 4, 5].map((vi_tri) => (
                <svg
                    key={vi_tri}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill={vi_tri <= diem ? 'var(--kt-gold)' : 'rgba(255,255,255,0.2)'}
                >
                    <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8Z" />
                </svg>
            ))}
        </p>
    );
}

/* ===================== Bài viết ===================== */

export function KhoiBaiViet({ posts }: { posts: StorefrontPost[] }) {
    if (posts.length === 0) return null;

    return (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <TieuDeKhoi
                    nhan="Kinh nghiệm chọn khóa"
                    tieuDe="Đọc trước khi mua"
                    mo="Những điều nên biết về độ dày cánh, nguồn điện, chuẩn khóa và cách chọn cho đúng."
                />
                <Link
                    href="/bai-viet"
                    className="rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                    Xem tất cả
                </Link>
            </div>

            <ul className="mt-10 grid gap-4 md:grid-cols-3">
                {posts.map((baiViet) => (
                    <li key={baiViet.slug}>
                        <Link
                            href={`/bai-viet/${baiViet.slug}`}
                            className="kinh group flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1"
                        >
                            {baiViet.coverUrl && (
                                <img
                                    {...boAnh(baiViet.coverUrl)}
                                    sizes="(max-width: 768px) 100vw, 400px"
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            )}
                            <div className="flex flex-1 flex-col gap-2 p-5">
                                {baiViet.categoryName && (
                                    <p className="text-xs font-semibold tracking-wide text-[var(--kt-gold-soft)] uppercase">
                                        {baiViet.categoryName}
                                    </p>
                                )}
                                <h3 className="line-clamp-2 font-semibold text-white">
                                    {baiViet.title}
                                </h3>
                                {baiViet.excerpt && (
                                    <p className="line-clamp-3 text-sm leading-relaxed text-white/60">
                                        {baiViet.excerpt}
                                    </p>
                                )}
                                {baiViet.publishedAt && (
                                    <time
                                        dateTime={baiViet.publishedAt}
                                        className="so-lieu mt-auto pt-3 text-xs text-white/45"
                                    >
                                        {new Intl.DateTimeFormat('vi-VN', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                        }).format(new Date(baiViet.publishedAt))}
                                    </time>
                                )}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ===================== Sản phẩm theo hãng ===================== */

/**
 * Mỗi hãng một dải 4 sản phẩm.
 * Khách thường vào với một cái tên trong đầu ("nghe nói Hyundai tốt") — dải này
 * để họ thấy ngay hãng mình muốn, khỏi phải vào trang lọc rồi chọn lại.
 * Hãng nào chưa có sản phẩm đang bán thì không hiện.
 */
export function KhoiTheoHang({ sections }: { sections: StorefrontBrandSection[] }) {
    const coHang = sections.filter((muc) => muc.products.length > 0);
    if (coHang.length === 0) return null;

    return (
        <div className="border-t border-white/10">
            {coHang.map((muc, chiSo) => (
                <section
                    key={muc.brand.slug}
                    // Đích nhảy của dải chip thương hiệu phía trên.
                    // scroll-mt-20 để thanh điều hướng dính không che mất tiêu đề khi nhảy tới.
                    id={`hang-${muc.brand.slug}`}
                    className={`scroll-mt-20 border-b border-white/10${chiSo % 2 === 1 ? ' nen-sang-mo' : ''}`}
                >
                    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:py-16">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                                    Thương hiệu
                                </p>
                                <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                                    Khóa {muc.brand.name}
                                </h2>
                                {muc.brand.description ? (
                                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
                                        {muc.brand.description}
                                    </p>
                                ) : (
                                    <p className="so-lieu mt-2 text-sm text-white/55">
                                        {muc.brand.productCount} mẫu đang bán
                                    </p>
                                )}
                            </div>
                            <Link
                                href={`/san-pham?brand=${muc.brand.slug}`}
                                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                            >
                                Xem {muc.brand.productCount} mẫu {muc.brand.name}
                            </Link>
                        </div>

                        <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                            {muc.products.map((sanPham: StorefrontCard) => (
                                <li key={sanPham.slug}>
                                    <ProductCard sanPham={sanPham} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ))}
        </div>
    );
}

/* ===================== Câu hỏi thường gặp ===================== */

/**
 * Dùng <details>/<summary> của trình duyệt, không viết JavaScript đóng mở.
 * Được ba thứ: không tốn JavaScript, bàn phím và trình đọc màn hình chạy đúng
 * sẵn, và Ctrl+F của trình duyệt tìm được chữ nằm trong phần đang đóng.
 */
export function KhoiCauHoi({ faqs }: { faqs: StorefrontFaq[] }) {
    if (faqs.length === 0) return null;

    return (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
            <TieuDeKhoi nhan="Hỏi đáp" tieuDe="Câu hỏi thường gặp" />

            {/* Khung ngoài rộng bằng các khối khác để lề trái thẳng hàng,
                nhưng danh sách hẹp lại cho dễ đọc một dòng chữ dài */}
            <ul className="mt-10 max-w-3xl space-y-3">
                {faqs.map((cauHoi) => (
                    <li key={cauHoi.question}>
                        <details className="kinh group rounded-2xl px-5 [&_summary::-webkit-details-marker]:hidden">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-white">
                                {cauHoi.question}
                                <span className="shrink-0 text-[var(--kt-gold-soft)] transition-transform group-open:rotate-45">
                                    <IconCong />
                                </span>
                            </summary>
                            <div
                                className="noi-dung-html pb-5 text-sm leading-relaxed text-white/70"
                                // answerHtml do trang quản trị lọc sạch trước khi lưu
                                dangerouslySetInnerHTML={{ __html: cauHoi.answerHtml }}
                            />
                        </details>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ===================== Biểu tượng ===================== */

function IconDau() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
        </svg>
    );
}

function IconGhim() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

function IconCong() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}
