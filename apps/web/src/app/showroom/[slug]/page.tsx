import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { StorefrontShowroomDetail } from '@ktm/shared';
import {
    anhNho,
    anhTuyetDoi,
    boAnh,
    DIA_CHI_WEB,
    dinhDangDienThoai,
    layDanhSachShowroom,
    layDuLieuChung,
    layShowroom,
    soGoi,
} from '@/lib/api';
import { FormTuVan } from '@/components/form-tu-van';

/**
 * Trang chi tiết một showroom.
 *
 * Đây là trang ăn tìm kiếm theo địa phương: khách gõ "khóa vân tay quận 7" thì
 * Google cần một trang có đúng tên phường, địa chỉ, giờ mở cửa và số điện thoại.
 * Vì vậy có đánh dấu dữ liệu LocalBusiness ở cuối trang.
 */

export const revalidate = 300;

export async function generateStaticParams() {
    const ds = await layDanhSachShowroom();
    return ds.map((muc) => ({ slug: muc.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const showroom = await layShowroom(slug).catch(() => null);
    if (!showroom) return { title: 'Không tìm thấy showroom' };

    return {
        title: showroom.name,
        description:
            showroom.description ??
            `${showroom.name} — ${showroom.address}. Xem và thử trực tiếp khóa cửa thông minh chính hãng trước khi mua.`,
        alternates: { canonical: `/showroom/${showroom.slug}` },
    };
}

export default async function TrangShowroomChiTiet({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const [showroom, chung] = await Promise.all([
        layShowroom(slug).catch(() => null),
        layDuLieuChung(),
    ]);

    if (!showroom) notFound();

    const soBam = showroom.phone ? soGoi(showroom.phone) : null;
    const soHienThi = showroom.phone ? dinhDangDienThoai(showroom.phone) : null;

    return (
        <>
            <JsonLdShowroom showroom={showroom} />

            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
                    <nav aria-label="Đường dẫn" className="text-sm text-white/50">
                        <Link href="/" className="hover:text-white">
                            Trang chủ
                        </Link>
                        <span className="mx-2">/</span>
                        <Link href="/showroom" className="hover:text-white">
                            Showroom
                        </Link>
                    </nav>

                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        {showroom.name}
                    </h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-white/70">{showroom.address}</p>

                    <div className="mt-7 flex flex-wrap gap-3">
                        {soBam && (
                            <a
                                href={`tel:${soBam}`}
                                className="so-lieu rounded-2xl bg-[var(--kt-gold)] px-6 py-3.5 font-bold text-[var(--kt-navy-deep)]"
                            >
                                Gọi {soHienThi}
                            </a>
                        )}
                        {showroom.directionsUrl && (
                            <a
                                href={showroom.directionsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 font-semibold text-white"
                            >
                                Chỉ đường
                            </a>
                        )}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
                    <div>
                        {/* Kiểm tra THẲNG images[0], không dùng images.length > 0: TypeScript
                            thu hẹp được kiểu khi truy cập mảng bằng chỉ số hằng, nhưng
                            không suy ra được "length > 0 thì phần tử 0 tồn tại". */}
                        {showroom.images[0] && (
                            <>
                                <img
                                    {...boAnh(showroom.images[0])}
                                    sizes="(max-width: 1024px) 100vw, 760px"
                                    alt={showroom.name}
                                    fetchPriority="high"
                                    decoding="async"
                                    className="aspect-[16/10] w-full rounded-3xl object-cover"
                                />
                                {showroom.images.length > 1 && (
                                    <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                        {showroom.images.slice(1).map((anh) => (
                                            <li key={anh}>
                                                <img
                                                    src={anhNho(anh)}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="size-24 shrink-0 rounded-xl object-cover"
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}

                        {showroom.description && (
                            <div className="mt-8 leading-relaxed whitespace-pre-wrap text-white/70">
                                {showroom.description}
                            </div>
                        )}

                        {showroom.mapEmbedUrl && (
                            <div className="mt-8 overflow-hidden rounded-3xl border border-white/12">
                                <iframe
                                    src={showroom.mapEmbedUrl}
                                    title={`Bản đồ ${showroom.name}`}
                                    // lazy: bản đồ nặng, chỉ tải khi khách cuộn tới
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    className="aspect-[16/9] w-full border-0"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="kinh rounded-3xl p-6">
                            <h2 className="text-sm font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                                Giờ mở cửa
                            </h2>
                            {showroom.openingHours.length > 0 ? (
                                <ul className="mt-4 space-y-1.5 text-sm text-white/75">
                                    {showroom.openingHours.map((dong) => (
                                        <li key={dong} className="so-lieu">
                                            {dong}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-sm text-white/55">
                                    Gọi trước khi đến để chắc chắn có người trực.
                                </p>
                            )}

                            <h2 className="mt-7 text-sm font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                                Liên hệ
                            </h2>
                            <ul className="mt-4 space-y-2 text-sm text-white/75">
                                <li className="leading-relaxed">{showroom.address}</li>
                                {soBam && soHienThi && (
                                    <li>
                                        <a href={`tel:${soBam}`} className="so-lieu hover:underline">
                                            {soHienThi}
                                        </a>
                                    </li>
                                )}
                                {showroom.email && (
                                    <li>
                                        <a href={`mailto:${showroom.email}`} className="hover:underline">
                                            {showroom.email}
                                        </a>
                                    </li>
                                )}
                            </ul>
                        </div>

                        <div className="mt-6">
                            <FormTuVan
                                kind="RETAIL"
                                tieuDe="Hẹn trước khi đến"
                                mo="Để lại số, chúng tôi chuẩn bị sẵn vài mẫu hợp cửa nhà bạn để xem cho nhanh."
                                sourcePath={`/showroom/${showroom.slug}`}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {chung.loaiCua.length > 0 && (
                <section className="mx-auto max-w-7xl border-t border-white/10 px-4 py-12 sm:px-6">
                    <h2 className="text-sm font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                        Xem trước khi đến
                    </h2>
                    <ul className="mt-4 flex flex-wrap gap-2">
                        {chung.loaiCua.map((muc) => (
                            <li key={muc.slug}>
                                <Link
                                    href={`/khoa/${muc.slug}`}
                                    className="kinh flex items-baseline gap-2 rounded-2xl px-5 py-3 transition-all hover:-translate-y-0.5"
                                >
                                    <span className="font-semibold text-white">
                                        Khóa {muc.name.toLowerCase()}
                                    </span>
                                    <span className="so-lieu text-xs text-white/50">{muc.productCount}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

/**
 * Đánh dấu LocalBusiness: để Google hiện showroom này trên bản đồ và trong kết
 * quả "gần tôi". Giờ mở cửa phải ở dạng máy đọc được, nên dựng lại từ các dòng
 * chữ đã gộp thì không được — ở đây chỉ khai những trường chắc chắn đúng.
 */
function JsonLdShowroom({ showroom }: { showroom: StorefrontShowroomDetail }) {
    const diaChiWeb = DIA_CHI_WEB;

    const duLieu: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: showroom.name,
        url: `${diaChiWeb}/showroom/${showroom.slug}`,
        address: {
            '@type': 'PostalAddress',
            streetAddress: showroom.address,
            addressCountry: 'VN',
        },
        ...(showroom.phone && { telephone: showroom.phone }),
        ...(showroom.email && { email: showroom.email }),
        // Đường dẫn đầy đủ: Google đọc JSON-LD như dữ liệu thuần, "/media/..." thì bỏ qua
        ...(showroom.images.length > 0 && { image: showroom.images.map(anhTuyetDoi) }),
        ...(showroom.description && { description: showroom.description }),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(duLieu) }}
        />
    );
}
