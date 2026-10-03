import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { StorefrontPostDetail } from '@ktm/shared';
import { anhTuyetDoi, boAnh, DIA_CHI_WEB, layBaiViet, layDanhSachBaiViet } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { FormTuVan } from '@/components/form-tu-van';
import { TheBaiViet } from '@/components/the-bai-viet';

/**
 * Trang chi tiết bài viết.
 *
 * Phần đáng giá nhất không phải bài viết mà là KHỐI SẢN PHẨM bài đó nhắc tới:
 * khách đọc xong "chọn khóa cho cửa gỗ thế nào" là đang sẵn sàng xem hàng. Gắn
 * sản phẩm vào bài trong trang quản trị thì khối đó tự hiện ở đây.
 */

export const revalidate = 300;

export async function generateStaticParams() {
    const ds = await layDanhSachBaiViet({ pageSize: 24 });
    return ds.items.map((muc) => ({ slug: muc.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const bai = await layBaiViet(slug).catch(() => null);
    if (!bai) return { title: 'Không tìm thấy bài viết' };

    const moTa = bai.seoDescription ?? bai.excerpt ?? undefined;
    return {
        title: bai.seoTitle ?? bai.title,
        ...(moTa ? { description: moTa.slice(0, 320) } : {}),
        alternates: { canonical: `/bai-viet/${bai.slug}` },
        openGraph: {
            type: 'article',
            title: bai.seoTitle ?? bai.title,
            ...(moTa ? { description: moTa.slice(0, 320) } : {}),
            url: `/bai-viet/${bai.slug}`,
            ...(bai.publishedAt ? { publishedTime: bai.publishedAt } : {}),
            ...(bai.coverUrl ? { images: [{ url: bai.coverUrl }] } : {}),
        },
    };
}

export default async function TrangBaiVietChiTiet({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const bai = await layBaiViet(slug).catch(() => null);
    if (!bai) notFound();

    const ngay = bai.publishedAt
        ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
              new Date(bai.publishedAt),
          )
        : null;

    return (
        <>
            <JsonLdBaiViet bai={bai} />

            <article>
                <header className="nen-sang-mo border-b border-white/10">
                    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
                        <nav aria-label="Đường dẫn" className="text-sm text-white/50">
                            <Link href="/" className="hover:text-white">
                                Trang chủ
                            </Link>
                            <span className="mx-2">/</span>
                            <Link href="/bai-viet" className="hover:text-white">
                                Bài viết
                            </Link>
                            {bai.categoryName && bai.categorySlug && (
                                <>
                                    <span className="mx-2">/</span>
                                    <Link
                                        href={`/bai-viet?category=${bai.categorySlug}`}
                                        className="hover:text-white"
                                    >
                                        {bai.categoryName}
                                    </Link>
                                </>
                            )}
                        </nav>

                        <h1 className="mt-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                            {bai.title}
                        </h1>

                        <p className="so-lieu mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50">
                            {ngay && <time dateTime={bai.publishedAt ?? undefined}>{ngay}</time>}
                            {bai.authorName && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span>{bai.authorName}</span>
                                </>
                            )}
                        </p>

                        {bai.excerpt && (
                            <p className="mt-5 text-lg leading-relaxed text-white/70">{bai.excerpt}</p>
                        )}
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
                    {bai.coverUrl && (
                        <img
                            {...boAnh(bai.coverUrl)}
                            sizes="(max-width: 768px) 100vw, 768px"
                            alt=""
                            fetchPriority="high"
                            decoding="async"
                            className="mb-10 aspect-[16/9] w-full rounded-3xl object-cover"
                        />
                    )}

                    {/* contentHtml do trang quản trị lọc sạch trước khi lưu */}
                    <div
                        className="bai-viet-html"
                        dangerouslySetInnerHTML={{ __html: bai.contentHtml }}
                    />
                </div>
            </article>

            {bai.products.length > 0 && (
                <section className="nen-sang-mo border-y border-white/10">
                    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                        <h2 className="text-xl font-bold sm:text-2xl">Sản phẩm nhắc tới trong bài</h2>
                        <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                            {bai.products.map((sanPham) => (
                                <li key={sanPham.slug}>
                                    <ProductCard sanPham={sanPham} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            <section className="border-b border-white/10 bg-[var(--kt-navy)]">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-14">
                    <div>
                        <h2 className="text-2xl font-bold text-balance sm:text-3xl">
                            Vẫn chưa chắc chọn mẫu nào?
                        </h2>
                        <p className="mt-4 max-w-xl leading-relaxed text-white/70">
                            Bài viết nói chung cho mọi nhà. Cửa nhà bạn thì có số đo riêng — để lại số,
                            kỹ thuật viên hỏi vài câu rồi chốt đúng mẫu lắp vừa.
                        </p>
                    </div>
                    <FormTuVan
                        kind="RETAIL"
                        tieuDe="Hỏi kỹ thuật viên"
                        mo="Chỉ cần họ tên và số điện thoại."
                        sourcePath={`/bai-viet/${bai.slug}`}
                    />
                </div>
            </section>

            {bai.related.length > 0 && (
                <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
                    <h2 className="text-xl font-bold sm:text-2xl">Bài khác cùng chủ đề</h2>
                    <ul className="mt-6 grid gap-5 md:grid-cols-3">
                        {bai.related.map((item) => (
                            <li key={item.slug}>
                                <TheBaiViet bai={item} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

/** Đánh dấu Article: giúp Google hiện ngày đăng và ảnh bìa trong kết quả tìm kiếm */
function JsonLdBaiViet({ bai }: { bai: StorefrontPostDetail }) {
    const diaChiWeb = DIA_CHI_WEB;

    const duLieu: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: bai.title.slice(0, 110),
        url: `${diaChiWeb}/bai-viet/${bai.slug}`,
        mainEntityOfPage: `${diaChiWeb}/bai-viet/${bai.slug}`,
        ...(bai.excerpt && { description: bai.excerpt }),
        // Đường dẫn đầy đủ: Google đọc JSON-LD như dữ liệu thuần, "/media/..." thì bỏ qua
        ...(bai.coverUrl && { image: [anhTuyetDoi(bai.coverUrl)] }),
        ...(bai.publishedAt && { datePublished: bai.publishedAt }),
        ...(bai.authorName && { author: { '@type': 'Person', name: bai.authorName } }),
        publisher: {
            '@type': 'Organization',
            name: 'Khóa Thông Minh Chính Hãng',
            logo: { '@type': 'ImageObject', url: `${diaChiWeb}/logo-bieu-tuong.svg` },
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(duLieu) }}
        />
    );
}
