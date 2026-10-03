import type { Metadata } from 'next';
import type { StorefrontProduct } from '@ktm/shared';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    anhTuyetDoi,
    DIA_CHI_WEB,
    dinhDangDienThoai,
    layDuLieuChung,
    laySanPham,
    soGoi,
    timSanPhamAnToan,
} from '@/lib/api';
import { ChonBienThe } from '@/components/chon-bien-the';
import { FormTuVan } from '@/components/form-tu-van';
import { ProductCard } from '@/components/product-card';

/**
 * Trang chi tiết sản phẩm.
 *
 * Đây là trang Google đưa khách vào nhiều nhất, nên nó phải tự nói hết: tên
 * thương mại, giá, bảo hành, thông số, lắp được cho cửa nào, và một chỗ để lại
 * số ngay tại trang chứ không bắt khách quay về trang chủ.
 */

export const revalidate = 60;

const GOI_Y_COUNT = 4;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const sanPham = await laySanPham(slug).catch(() => null);
    if (!sanPham) return { title: 'Không tìm thấy sản phẩm' };

    const moTa =
        sanPham.seoDescription ??
        sanPham.shortDescription ??
        `${sanPham.name} chính hãng${sanPham.brand ? `, thương hiệu ${sanPham.brand.name}` : ''}${
            sanPham.warrantyMonths > 0 ? `, bảo hành ${sanPham.warrantyMonths} tháng` : ''
        }. Tư vấn chọn đúng loại cửa, lắp đặt tận nơi.`;

    return {
        title: sanPham.seoTitle ?? sanPham.name,
        description: moTa.slice(0, 320),
        alternates: { canonical: `/san-pham/${sanPham.slug}` },
        openGraph: {
            type: 'website',
            title: sanPham.seoTitle ?? sanPham.name,
            description: moTa.slice(0, 320),
            url: `/san-pham/${sanPham.slug}`,
            ...(sanPham.images[0] ? { images: [{ url: sanPham.images[0] }] } : {}),
        },
    };
}

export default async function TrangChiTiet({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const [sanPham, chung] = await Promise.all([
        laySanPham(slug).catch(() => null),
        layDuLieuChung(),
    ]);

    if (!sanPham) notFound();

    const soBam = chung.congTy.hotline ? soGoi(chung.congTy.hotline) : null;
    const soHienThi = chung.congTy.hotline ? dinhDangDienThoai(chung.congTy.hotline) : null;

    // Gợi ý sản phẩm cùng loại cửa; không có loại cửa thì lấy cùng hãng
    const loaiChinh = sanPham.doorTypes[0];
    const goiY = await timSanPhamAnToan({
        pageSize: GOI_Y_COUNT + 1,
        ...(loaiChinh ? { doorType: loaiChinh.slug } : {}),
        ...(!loaiChinh && sanPham.brand ? { brand: sanPham.brand.slug } : {}),
    });
    const dsGoiY = goiY.items.filter((item) => item.slug !== sanPham.slug).slice(0, GOI_Y_COUNT);

    return (
        <>
            <JsonLdSanPham sanPham={sanPham} />

            {/* ---------- Đường dẫn + tên ---------- */}
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
                    <nav aria-label="Đường dẫn" className="text-sm text-white/50">
                        <Link href="/" className="hover:text-white">
                            Trang chủ
                        </Link>
                        <span className="mx-2">/</span>
                        <Link href="/san-pham" className="hover:text-white">
                            Sản phẩm
                        </Link>
                        {loaiChinh && (
                            <>
                                <span className="mx-2">/</span>
                                <Link href={`/khoa/${loaiChinh.slug}`} className="hover:text-white">
                                    Khóa {loaiChinh.name.toLowerCase()}
                                </Link>
                            </>
                        )}
                    </nav>

                    {sanPham.brand && (
                        <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-[var(--kt-gold-soft)] uppercase">
                            {sanPham.brand.name}
                        </p>
                    )}
                    <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
                        {sanPham.name}
                    </h1>

                    {sanPham.ratingAverage !== null && sanPham.ratingCount > 0 && (
                        <p className="so-lieu mt-3 text-sm text-white/65">
                            <span className="font-bold text-[var(--kt-gold-soft)]">
                                {sanPham.ratingAverage.toFixed(1)}
                            </span>
                            {' / 5 — '}
                            {sanPham.ratingCount} đánh giá
                        </p>
                    )}

                    {sanPham.shortDescription && (
                        <p className="mt-4 max-w-2xl leading-relaxed text-white/70">
                            {sanPham.shortDescription}
                        </p>
                    )}
                </div>
            </section>

            {/* ---------- Ảnh, chọn phiên bản, giá ---------- */}
            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
                <ChonBienThe
                    name={sanPham.name}
                    images={sanPham.images}
                    options={sanPham.options}
                    variants={sanPham.variants}
                    warrantyMonths={sanPham.warrantyMonths}
                    hotline={soBam}
                    soHienThi={soHienThi}
                />

                {sanPham.doorTypes.length > 0 && (
                    <div className="mt-10 border-t border-white/10 pt-6">
                        <h2 className="text-sm font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Lắp được cho
                        </h2>
                        {/*
                         * gap-y-2.5 chứ không dùng chung gap-2 cho cả hai chiều: các ô
                         * này cao 40px, cách nhau 8px theo chiều dọc thì hai hàng dính
                         * vào nhau như một khối, mắt không tách ra được từng ô.
                         * Cách ngang thì 8px là vừa, rộng quá lại rời rạc.
                         */}
                        <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-2.5">
                            {sanPham.doorTypes.map((muc) => (
                                <li key={muc.slug}>
                                    <Link
                                        href={`/khoa/${muc.slug}`}
                                        className="inline-block rounded-xl border border-white/18 bg-white/8 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/15"
                                    >
                                        {muc.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {/* ---------- Điểm nổi bật ---------- */}
            {sanPham.highlights.length > 0 && (
                <section className="border-y border-white/10 bg-white/5">
                    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                        <h2 className="text-xl font-bold sm:text-2xl">Điểm nổi bật</h2>
                        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {sanPham.highlights.map((nhom) => (
                                <div key={nhom.title}>
                                    <h3 className="font-semibold text-[var(--kt-gold-soft)]">{nhom.title}</h3>
                                    <ul className="mt-2 space-y-1.5">
                                        {nhom.items.map((muc) => (
                                            <li key={muc} className="flex gap-2 text-sm leading-relaxed text-white/70">
                                                <span className="text-[var(--kt-gold-soft)]">•</span>
                                                {muc}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ---------- Thông số ---------- */}
            {sanPham.specs.length > 0 && (
                <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
                    <h2 className="text-xl font-bold sm:text-2xl">Thông số kỹ thuật</h2>
                    <dl className="mt-6 overflow-hidden rounded-2xl border border-white/12">
                        {sanPham.specs.map((muc, chiSo) => (
                            <div
                                key={muc.name}
                                className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 px-5 py-3.5 text-sm ${
                                    chiSo % 2 === 1 ? 'bg-white/5' : ''
                                }`}
                            >
                                <dt className="text-white/55">{muc.name}</dt>
                                <dd className="text-white">{muc.value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {/* ---------- Mô tả ---------- */}
            {sanPham.description && (
                <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6">
                    <h2 className="text-xl font-bold sm:text-2xl">Mô tả sản phẩm</h2>
                    <MoTaSanPham html={sanPham.description} />
                </section>
            )}

            {/* ---------- Để lại số ---------- */}
            <section id="hoi-gia" className="scroll-mt-20 border-y border-white/10 bg-[var(--kt-navy)]">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-14">
                    <div>
                        <h2 className="text-2xl font-bold text-balance sm:text-3xl">
                            Hỏi giá và tư vấn lắp đặt
                        </h2>
                        <p className="mt-4 max-w-xl leading-relaxed text-white/70">
                            Để lại số, kỹ thuật viên gọi lại hỏi vài câu về cánh cửa nhà bạn rồi báo giá
                            trọn gói kèm công lắp. Không thu phí tư vấn, không gọi làm phiền sau đó.
                        </p>
                        {soHienThi && (
                            <p className="mt-6 text-sm text-white/60">
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
                        kind="RETAIL"
                        tieuDe={`Hỏi giá ${sanPham.name}`}
                        mo="Chỉ cần họ tên và số điện thoại."
                        sourcePath={`/san-pham/${sanPham.slug}`}
                        productSlug={sanPham.slug}
                        productName={sanPham.name}
                        doorTypeName={loaiChinh?.name}
                    />
                </div>
            </section>

            {/* ---------- Gợi ý ---------- */}
            {dsGoiY.length > 0 && (
                <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <h2 className="text-xl font-bold sm:text-2xl">
                            {loaiChinh ? `Mẫu khác cho ${loaiChinh.name.toLowerCase()}` : 'Có thể bạn quan tâm'}
                        </h2>
                        {loaiChinh && (
                            <Link
                                href={`/khoa/${loaiChinh.slug}`}
                                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                            >
                                Xem tất cả
                            </Link>
                        )}
                    </div>
                    <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {dsGoiY.map((item) => (
                            <li key={item.slug}>
                                <ProductCard sanPham={item} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

/**
 * Đánh dấu Product cho Google: nhờ khối này mà kết quả tìm kiếm hiện được giá,
 * tình trạng còn hàng và số sao ngay dưới tiêu đề.
 * Chỉ khai những gì CÓ dữ liệu thật — khai khống là bị phạt.
 */
/** Có ít nhất một thẻ thật thì là HTML; "cửa < 45mm" không tính */
const CO_THE_HTML =
    /<(p|h[1-6]|ul|ol|li|table|tr|td|th|img|figure|blockquote|br|strong|em|b|i|u|s|a|div|span|hr|iframe)\b[^>]*>/i;

/**
 * Mô tả sản phẩm.
 *
 * Từ nay mô tả được soạn bằng TinyMCE và API lọc sạch HTML trước khi lưu (cùng bộ lọc
 * với bài viết), nên đổ thẳng ra được. Dùng chung lớp .bai-viet-html để mô tả sản phẩm
 * và bài viết trông giống nhau — cùng cỡ chữ, cùng kiểu bảng, cùng kiểu gạch đầu dòng.
 *
 * Sản phẩm cũ nhập trước khi có trình soạn thảo đang lưu VĂN BẢN THƯỜNG. Đổ văn bản
 * thường qua dangerouslySetInnerHTML thì mất hết dấu xuống dòng, nên nhận ra và hiện
 * theo kiểu cũ. Không cần chạy script chuyển đổi: mở sản phẩm ra lưu lại một lần là
 * nó tự thành HTML.
 */
function MoTaSanPham({ html }: { html: string }) {
    if (!CO_THE_HTML.test(html)) {
        return <div className="mt-4 leading-relaxed whitespace-pre-wrap text-white/70">{html}</div>;
    }

    return (
        <div
            className="bai-viet-html mt-4"
            // An toàn: chuỗi này đã qua sanitizeRichHtml ở API trước khi vào database
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function JsonLdSanPham({ sanPham }: { sanPham: StorefrontProduct }) {
    const diaChiWeb = DIA_CHI_WEB;
    const gia = sanPham.variants.map((item) => item.price);
    const thapNhat = gia.length > 0 ? Math.min(...gia) : sanPham.priceFrom;
    const caoNhat = gia.length > 0 ? Math.max(...gia) : sanPham.priceFrom;

    const duLieu: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: sanPham.name,
        url: `${diaChiWeb}/san-pham/${sanPham.slug}`,
        // Google đọc JSON-LD như dữ liệu thuần, không biết "/media/..." thuộc tên miền
        // nào — phải ghi đường dẫn đầy đủ, nếu không Google bỏ qua ảnh sản phẩm
        ...(sanPham.images.length > 0 && { image: sanPham.images.map(anhTuyetDoi) }),
        ...(sanPham.shortDescription && { description: sanPham.shortDescription }),
        ...(sanPham.brand && { brand: { '@type': 'Brand', name: sanPham.brand.name } }),
        ...(sanPham.variants[0] && { sku: sanPham.variants[0].sku }),
        offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'VND',
            lowPrice: thapNhat,
            highPrice: caoNhat,
            offerCount: sanPham.variants.length,
            availability: 'https://schema.org/InStock',
        },
        ...(sanPham.ratingAverage !== null &&
            sanPham.ratingCount > 0 && {
                aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: sanPham.ratingAverage,
                    reviewCount: sanPham.ratingCount,
                },
            }),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(duLieu) }}
        />
    );
}
