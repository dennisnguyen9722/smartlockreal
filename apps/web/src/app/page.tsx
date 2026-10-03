import Link from 'next/link';
import type { Metadata } from 'next';
import type { StorefrontHome } from '@ktm/shared';
import { layTrangChu, soGoi, dinhDangDienThoai } from '@/lib/api';
import { BannerSlider } from '@/components/banner-slider';
import { ProductCard } from '@/components/product-card';
import { LogoHang } from '@/components/logo-hang';
import {
    BangKhuyenMai,
    CamKet,
    DaiDuAn,
    KhoiBaiViet,
    KhoiCauHoi,
    KhoiDanhGia,
    KhoiShowroom,
    KhoiTheoHang,
    SoLieu,
    TieuDeKhoi,
} from '@/components/home-sections';

/**
 * Trang chủ — "Hướng A": nền xanh navy kiểu phòng trưng bày cao cấp.
 *
 * Thứ tự các khối đi theo đúng đường một người đi tới chỗ quyết định mua:
 *   thấy hàng (banner) → tôi mua cho cửa nào → xem mẫu → (nhà thầu rẽ nhánh ở đây)
 *   → khuyến mãi → sờ tận tay ở showroom → người khác mua thấy sao
 *   → xem hết hàng theo hãng → đọc thêm cho chắc → thắc mắc còn lại → gọi.
 *
 * Khối bài viết nằm SAU toàn bộ phần hàng hóa: khách vào trang chủ là để xem khóa,
 * chặn một dải bài đọc vào giữa đường là đẩy mấy dải sản phẩm xuống dưới tầm mắt.
 * Ai muốn đọc thì vẫn còn mục "Bài viết" trên thanh menu.
 *
 * Mỗi khối tự ẩn khi chưa có dữ liệu, nên trang không bao giờ hiện ô trống.
 */

export const metadata: Metadata = {
    alternates: { canonical: '/' },
};

/** Trang được dựng lại tối đa mỗi 60 giây, khách không phải chờ gọi API */
export const revalidate = 60;

const DU_PHONG: StorefrontHome = {
    doorTypes: [],
    brands: [],
    banners: [],
    promoBanners: [],
    featured: [],
    featuredIsAuto: true,
    byBrand: [],
    showrooms: [],
    reviews: [],
    posts: [],
    faqs: [],
    company: { name: 'Khóa Thông Minh Chính Hãng', hotline: null, email: null, address: null },
    totals: { products: 0, brands: 0, showrooms: 0, reviews: 0, ratingAverage: null },
};

export default async function HomePage() {
    let home: StorefrontHome;
    try {
        home = await layTrangChu();
    } catch (error) {
        // API chết thì vẫn phải hiện được trang và số điện thoại, không trắng màn hình
        console.error('[web] Không lấy được dữ liệu trang chủ:', error);
        home = DU_PHONG;
    }

    const soBam = home.company.hotline ? soGoi(home.company.hotline) : null;
    const soHienThi = home.company.hotline ? dinhDangDienThoai(home.company.hotline) : null;

    return (
        <>
            <JsonLd home={home} />

            <BannerSlider banners={home.banners} />

            {/* ===================== Màn hình đầu ===================== */}
            <section className="nen-sang-mo relative overflow-hidden">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
                    <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                        Nhà phân phối chính hãng
                    </p>

                    <h1 className="mt-4 max-w-3xl text-4xl leading-[1.12] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                        Khóa cửa thông minh{' '}
                        <span className="text-[var(--kt-gold-soft)]">đúng loại cửa nhà bạn</span>
                    </h1>

                    <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                        Cửa gỗ, cửa nhôm, cửa nhựa hay cửa kính — mỗi loại cửa cần một kiểu khóa khác
                        nhau. Để lại số điện thoại, kỹ thuật viên sẽ gọi lại tư vấn miễn phí và báo giá
                        kèm công lắp đặt.
                    </p>

                    <div className="mt-9 flex flex-wrap items-center gap-3">
                        {soBam && (
                            <>
                                <a
                                    href={`tel:${soBam}`}
                                    className="rounded-2xl bg-[var(--kt-gold)] px-6 py-3.5 text-base font-bold text-[var(--kt-navy-deep)] shadow-xl shadow-black/30 transition-transform hover:scale-[1.03]"
                                >
                                    Gọi tư vấn {soHienThi}
                                </a>
                                <a
                                    href={`https://zalo.me/${soBam}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/15"
                                >
                                    Nhắn Zalo
                                </a>
                            </>
                        )}
                        <Link
                            href="/san-pham"
                            className="rounded-2xl px-6 py-3.5 text-base font-semibold text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
                        >
                            Xem toàn bộ sản phẩm →
                        </Link>
                    </div>

                    <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
                        <SoLieu so={`${home.totals.products}+`} nhan="Mẫu khóa đang bán" />
                        <SoLieu so={`${home.totals.brands}`} nhan="Thương hiệu phân phối" />
                        {home.totals.ratingAverage !== null ? (
                            <SoLieu
                                so={home.totals.ratingAverage.toFixed(1)}
                                nhan={`Điểm từ ${home.totals.reviews} đánh giá`}
                            />
                        ) : (
                            <SoLieu so="24" nhan="Tháng bảo hành" />
                        )}
                    </dl>
                </div>
            </section>

            {/* ===================== Dải cam kết ===================== */}
            <section className="border-y border-white/10 bg-white/5">
                <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                    <CamKet
                        icon={<IconKhien />}
                        tieuDe="Hàng chính hãng"
                        mo="Nhập khẩu chính ngạch, đầy đủ tem và phiếu bảo hành."
                    />
                    <CamKet
                        icon={<IconThuoc />}
                        tieuDe="Tư vấn theo loại cửa"
                        mo="Khảo sát độ dày cánh, loại khóa cũ trước khi báo giá."
                    />
                    <CamKet
                        icon={<IconCoLe />}
                        tieuDe="Lắp đặt tận nơi"
                        mo="Thợ kỹ thuật đến tận nhà, lắp xong hướng dẫn sử dụng."
                    />
                    <CamKet
                        icon={<IconTaiNghe />}
                        tieuDe="Hỗ trợ sau bán"
                        mo="Hỏng hóc trong thời gian bảo hành được xử lý tại chỗ."
                    />
                </ul>
            </section>

            {/* ===================== Chọn theo loại cửa ===================== */}
            {home.doorTypes.length > 0 && (
                <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
                    <TieuDeKhoi
                        nhan="Bắt đầu từ đây"
                        tieuDe="Nhà bạn đang dùng cửa gì?"
                        mo="Chọn đúng loại cửa để chỉ xem những mẫu khóa lắp vừa — khỏi mất công lọc lại."
                    />

                    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {home.doorTypes.map((loai) => (
                            <li key={loai.slug}>
                                <Link
                                    href={`/khoa/${loai.slug}`}
                                    className="kinh group flex h-full flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1"
                                >
                                    <span className="so-lieu text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                                        {loai.productCount} sản phẩm
                                    </span>
                                    <h3 className="mt-3 text-xl font-bold text-white">
                                        Khóa {loai.name.toLowerCase()}
                                    </h3>
                                    {loai.description && (
                                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">
                                            {loai.description}
                                        </p>
                                    )}
                                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--kt-gold-soft)]">
                                        Xem mẫu khóa
                                        <span className="transition-transform group-hover:translate-x-1">→</span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ===================== Sản phẩm nổi bật ===================== */}
            {home.featured.length > 0 && (
                <section className="nen-sang-mo border-y border-white/10">
                    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <TieuDeKhoi
                                nhan="Mới về"
                                tieuDe="Sản phẩm nổi bật"
                                mo="Những mẫu khóa đang được hỏi nhiều nhất trong tháng."
                            />
                            <Link
                                href="/san-pham"
                                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                            >
                                Xem tất cả
                            </Link>
                        </div>

                        <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
                            {home.featured.map((sanPham, chiSo) => (
                                <li key={sanPham.slug}>
                                    <ProductCard sanPham={sanPham} uuTienAnh={chiSo < 4} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            {/* ===================== Nhà thầu và dự án ===================== */}
            <DaiDuAn hotline={home.company.hotline} />

            <BangKhuyenMai banners={home.promoBanners} />

            <KhoiShowroom showrooms={home.showrooms} />

            <KhoiDanhGia
                reviews={home.reviews}
                tongSo={home.totals.reviews}
                diemTrungBinh={home.totals.ratingAverage}
            />

            {/* ===================== Thương hiệu ===================== */}
            {home.brands.length > 0 && (
                <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
                    <TieuDeKhoi
                        nhan="Phân phối chính hãng"
                        tieuDe="Thương hiệu đang có"
                        mo="Bấm vào một hãng để nhảy xuống dải sản phẩm của hãng đó."
                    />

                    {/*
                      Điện thoại: xếp HAI CỘT. Bản cũ dùng flex-wrap nên mỗi ô rộng
                      bằng nội dung của nó (~200px), màn hình 364px không nhét nổi
                      hai ô — thành ra mỗi hãng một hàng, 5 hãng là 5 hàng, kéo dài
                      lê thê mà chẳng chứa thêm thông tin gì.
                      Máy tính vẫn flex-wrap như cũ, ở đó xếp hàng ngang mới đẹp.
                    */}
                    <ul className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-9 sm:flex sm:flex-wrap sm:gap-3">
                        {home.brands.map((hang) => (
                            <li key={hang.slug}>
                                <a
                                    href={`#hang-${hang.slug}`}
                                    className="kinh flex h-full items-center gap-2.5 rounded-2xl p-2.5 transition-all hover:-translate-y-0.5 sm:gap-3 sm:p-3 sm:pr-5"
                                >
                                    <LogoHang hang={hang} co="xs" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-white sm:text-base">
                                            {hang.name}
                                        </span>
                                        <span className="so-lieu block text-[11px] text-white/50 sm:text-xs">
                                            {hang.productCount} mẫu
                                        </span>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <KhoiTheoHang sections={home.byBrand} />

            {/* Bài viết: đặt sau hết phần hàng hóa (nổi bật + theo hãng) */}
            <KhoiBaiViet posts={home.posts} />

            <KhoiCauHoi faqs={home.faqs} />

            {/* ===================== Gọi tư vấn ===================== */}
            {soBam && (
                <section className="border-t border-white/10 bg-[var(--kt-navy)]">
                    <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:py-16">
                        <div>
                            <h2 className="text-2xl font-bold text-balance sm:text-3xl">
                                Chưa biết chọn mẫu nào?
                            </h2>
                            <p className="mt-3 max-w-xl text-white/70">
                                Gọi hoặc nhắn Zalo, mô tả loại cửa và nhu cầu — chúng tôi báo giá kèm
                                công lắp trong vòng 15 phút, không thu phí tư vấn.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-3">
                            <a
                                href={`tel:${soBam}`}
                                className="so-lieu rounded-2xl bg-[var(--kt-gold)] px-6 py-3.5 font-bold text-[var(--kt-navy-deep)]"
                            >
                                {soHienThi}
                            </a>
                            <a
                                href={`https://zalo.me/${soBam}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 font-semibold text-white"
                            >
                                Nhắn Zalo
                            </a>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}

/* ============================ Dữ liệu cho Google ============================ */

/**
 * Hai khối đánh dấu:
 *  - Store: để kết quả tìm kiếm hiện tên, điện thoại, địa chỉ và điểm đánh giá.
 *  - FAQPage: để Google hiện luôn câu hỏi — đáp ngay trong trang kết quả.
 * Chỉ khai những gì CÓ dữ liệu thật; khai khống là bị Google phạt.
 */
function JsonLd({ home }: { home: StorefrontHome }) {
    const diaChiWeb = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://khoathongminhchinhhang.vn';

    const cuaHang: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: home.company.name ?? 'Khóa Thông Minh Chính Hãng',
        url: diaChiWeb,
        logo: `${diaChiWeb}/logo-bieu-tuong.svg`,
        ...(home.company.hotline && { telephone: home.company.hotline }),
        ...(home.company.email && { email: home.company.email }),
        ...(home.company.address && {
            address: {
                '@type': 'PostalAddress',
                streetAddress: home.company.address,
                addressCountry: 'VN',
            },
        }),
        ...(home.totals.ratingAverage !== null &&
            home.totals.reviews > 0 && {
                aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: home.totals.ratingAverage,
                    reviewCount: home.totals.reviews,
                },
            }),
        ...(home.showrooms.length > 0 && {
            department: home.showrooms.map((showroom) => ({
                '@type': 'Store',
                name: showroom.name,
                address: { '@type': 'PostalAddress', streetAddress: showroom.address, addressCountry: 'VN' },
                ...(showroom.phone && { telephone: showroom.phone }),
            })),
        }),
    };

    const khoi: Record<string, unknown>[] = [cuaHang];

    if (home.faqs.length > 0) {
        khoi.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: home.faqs.map((cauHoi) => ({
                '@type': 'Question',
                name: cauHoi.question,
                acceptedAnswer: { '@type': 'Answer', text: cauHoi.answerHtml },
            })),
        });
    }

    return (
        <>
            {khoi.map((duLieu, chiSo) => (
                <script
                    key={chiSo}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(duLieu) }}
                />
            ))}
        </>
    );
}

/* ============================ Biểu tượng ============================ */

function IconKhien() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

function IconThuoc() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7h18v10H3z" />
            <path d="M7 7v3M11 7v5M15 7v3M19 7v5" />
        </svg>
    );
}

function IconCoLe() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a4 4 0 0 0 5 5L21 10v4l-7.5 7.5a2.1 2.1 0 0 1-3-3L18 11" />
            <path d="M9 3 3 9l4 4 6-6z" />
        </svg>
    );
}

function IconTaiNghe() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
            <path d="M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2zM20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" />
            <path d="M18 18v1a3 3 0 0 1-3 3h-3" />
        </svg>
    );
}
