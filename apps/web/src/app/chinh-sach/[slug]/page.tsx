import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { layChinhSach, layDanhSachChinhSach } from '@/lib/api';

/**
 * Trang chi tiết một chính sách.
 *
 * Nội dung do trang quản trị soạn bằng trình soạn thảo và ĐÃ ĐƯỢC LỌC SẠCH HTML
 * ở API trước khi lưu (cùng bộ lọc với bài viết), nên đổ thẳng ra được.
 *
 * Luôn hiện ngày bắt đầu áp dụng và số phiên bản: chính sách là thứ khách có thể
 * phải đối chiếu khi khiếu nại, không ghi rõ bản nào thì cãi nhau không có căn cứ.
 */

export const revalidate = 1800;

export async function generateStaticParams() {
    const danhSach = await layDanhSachChinhSach();
    return danhSach.map((muc) => ({ slug: muc.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const chinhSach = await layChinhSach(slug).catch(() => null);
    if (!chinhSach) return { title: 'Không tìm thấy chính sách' };

    return {
        title: chinhSach.label,
        description: `${chinhSach.label} của Khóa Thông Minh Chính Hãng, bản ${chinhSach.version}.`,
        alternates: { canonical: `/chinh-sach/${chinhSach.slug}` },
        // Chính sách không phải nội dung đi tìm kiếm, nhưng vẫn phải cho Google đọc
        // được để website đủ tin cậy; chỉ bỏ phần xem trước ảnh lớn.
        robots: { index: true, follow: true },
    };
}

function ngayVn(iso: string): string {
    if (!iso) return '';
    const ngay = new Date(iso);
    if (Number.isNaN(ngay.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).format(ngay);
}

export default async function TrangChinhSach({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const [chinhSach, danhSach] = await Promise.all([
        layChinhSach(slug).catch(() => null),
        layDanhSachChinhSach(),
    ]);

    if (!chinhSach) notFound();

    const khac = danhSach.filter((muc) => muc.slug !== chinhSach.slug);

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
                    <nav aria-label="Đường dẫn" className="text-sm text-white/50">
                        <Link href="/" className="hover:text-white">
                            Trang chủ
                        </Link>
                        <span className="mx-2">/</span>
                        <Link href="/chinh-sach" className="hover:text-white">
                            Chính sách
                        </Link>
                    </nav>

                    <h1 className="mt-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        {chinhSach.label}
                    </h1>

                    {chinhSach.title && chinhSach.title !== chinhSach.label && (
                        <p className="mt-3 text-lg text-white/70">{chinhSach.title}</p>
                    )}

                    <p className="so-lieu mt-5 text-sm text-white/50">
                        Bản {chinhSach.version} · áp dụng từ {ngayVn(chinhSach.effectiveAt)}
                    </p>
                </div>
            </section>

            <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
                <div
                    className="bai-viet-html"
                    // An toàn: chuỗi này đã qua sanitizeRichHtml ở API trước khi vào database
                    dangerouslySetInnerHTML={{ __html: chinhSach.contentHtml }}
                />
            </article>

            {khac.length > 0 && (
                <section className="mx-auto max-w-3xl border-t border-white/10 px-4 py-10 sm:px-6">
                    <h2 className="text-sm font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                        Chính sách khác
                    </h2>
                    <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-2.5">
                        {khac.map((muc) => (
                            <li key={muc.slug}>
                                <Link
                                    href={`/chinh-sach/${muc.slug}`}
                                    className="inline-block rounded-xl border border-white/18 bg-white/8 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/15"
                                >
                                    {muc.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}
