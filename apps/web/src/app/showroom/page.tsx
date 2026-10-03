import type { Metadata } from 'next';
import Link from 'next/link';
import { boAnh, dinhDangDienThoai, layDanhSachShowroom, soGoi } from '@/lib/api';

/**
 * Danh sách showroom.
 *
 * Đây là trang ăn tìm kiếm theo địa phương ("khóa thông minh quận 7"), nên mỗi
 * showroom có trang riêng với địa chỉ, giờ mở cửa và bản đồ — chứ không gộp hết
 * vào một trang.
 */

export const revalidate = 300;

export const metadata: Metadata = {
    title: 'Hệ thống showroom',
    description:
        'Địa chỉ, giờ mở cửa và số điện thoại các showroom Khóa Thông Minh Chính Hãng. Mời bạn đến bấm thử, mở thử và so sánh vài mẫu khóa cạnh nhau trước khi quyết định.',
    alternates: { canonical: '/showroom' },
};

export default async function TrangShowroom() {
    const showroom = await layDanhSachShowroom();

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                    <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                        Xem tận tay
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Hệ thống showroom
                    </h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-white/65">
                        Khóa là thứ cầm vào mới biết có ưng không. Mời bạn đến bấm thử, mở thử, so sánh
                        vài mẫu cạnh nhau rồi hẵng quyết.
                    </p>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                {showroom.length === 0 ? (
                    <div className="kinh rounded-3xl p-10 text-center">
                        <p className="font-semibold text-white">Chưa có showroom nào được đăng</p>
                        <p className="mt-2 text-sm text-white/60">
                            Bạn gọi hotline, chúng tôi hẹn gặp trực tiếp.
                        </p>
                    </div>
                ) : (
                    <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {showroom.map((muc) => (
                            <li key={muc.slug} className="kinh flex flex-col overflow-hidden rounded-3xl">
                                <Link href={`/showroom/${muc.slug}`} className="block">
                                    {muc.imageUrl ? (
                                        <img
                                            {...boAnh(muc.imageUrl)}
                                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
                                            alt={muc.name}
                                            loading="lazy"
                                            decoding="async"
                                            className="aspect-[16/10] w-full object-cover"
                                        />
                                    ) : (
                                        <div className="aspect-[16/10] w-full bg-white/5" />
                                    )}
                                </Link>

                                <div className="flex flex-1 flex-col gap-3 p-5">
                                    <h2 className="text-lg font-bold">
                                        <Link href={`/showroom/${muc.slug}`} className="hover:underline">
                                            {muc.name}
                                        </Link>
                                    </h2>

                                    <p className="text-sm leading-relaxed text-white/65">{muc.address}</p>

                                    {muc.openingHours.length > 0 && (
                                        <ul className="space-y-0.5 text-sm text-white/55">
                                            {muc.openingHours.map((dong) => (
                                                <li key={dong} className="so-lieu">
                                                    {dong}
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    <div className="mt-auto flex flex-wrap gap-2 pt-3">
                                        {muc.phone && (
                                            <a
                                                href={`tel:${soGoi(muc.phone)}`}
                                                className="so-lieu rounded-xl bg-[var(--kt-gold)] px-4 py-2 text-sm font-bold text-[var(--kt-navy-deep)]"
                                            >
                                                {dinhDangDienThoai(muc.phone)}
                                            </a>
                                        )}
                                        <Link
                                            href={`/showroom/${muc.slug}`}
                                            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
                                        >
                                            Xem bản đồ
                                        </Link>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
