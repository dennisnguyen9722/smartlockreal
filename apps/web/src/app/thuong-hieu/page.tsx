import type { Metadata } from 'next';
import Link from 'next/link';
import { layTrangChu } from '@/lib/api';
import { LogoHang } from '@/components/logo-hang';

/**
 * Trang thương hiệu.
 *
 * Mỗi hãng dẫn thẳng sang danh sách đã lọc sẵn thay vì làm một trang riêng cho
 * từng hãng: nội dung sẽ giống hệt /san-pham?brand=… mà lại tốn thêm một địa chỉ
 * trùng lặp cho Google. Khi nào có bài giới thiệu riêng cho từng hãng thì tách.
 */

export const revalidate = 300;

export const metadata: Metadata = {
    title: 'Thương hiệu khóa thông minh đang phân phối',
    description:
        'Các thương hiệu khóa cửa thông minh Khóa Thông Minh Chính Hãng đang phân phối chính hãng, kèm số mẫu đang bán của từng hãng.',
    alternates: { canonical: '/thuong-hieu' },
};

export default async function TrangThuongHieu() {
    const home = await layTrangChu().catch(() => null);
    const hang = home?.brands ?? [];

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                    <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                        Phân phối chính hãng
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Thương hiệu đang có
                    </h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-white/65">
                        Hàng nhập khẩu chính ngạch, đầy đủ tem và phiếu bảo hành của hãng. Bấm vào một
                        hãng để xem toàn bộ mẫu khóa của hãng đó.
                    </p>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                {hang.length === 0 ? (
                    <div className="kinh rounded-3xl p-10 text-center">
                        <p className="font-semibold text-white">Chưa tải được danh sách thương hiệu</p>
                        <p className="mt-2 text-sm text-white/60">Bạn thử tải lại trang giúp mình.</p>
                    </div>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {hang.map((muc) => (
                            <li key={muc.slug}>
                                <Link
                                    href={`/san-pham?brand=${muc.slug}`}
                                    className="kinh group flex h-full flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1"
                                >
                                    <LogoHang hang={muc} co="lg" />

                                    <h2 className="mt-5 text-xl font-bold text-white">{muc.name}</h2>

                                    <p className="so-lieu mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">
                                        <span>{muc.productCount} mẫu đang bán</span>
                                        {muc.countryOfOrigin && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <span>{muc.countryOfOrigin}</span>
                                            </>
                                        )}
                                    </p>

                                    {muc.isAuthorized && (
                                        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--kt-gold)]/15 px-3 py-1 text-xs font-semibold text-[var(--kt-gold-soft)]">
                                            <IconDau />
                                            Có giấy ủy quyền phân phối
                                        </span>
                                    )}

                                    {muc.description && (
                                        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-white/60">
                                            {muc.description}
                                        </p>
                                    )}

                                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[var(--kt-gold-soft)]">
                                        Xem mẫu khóa
                                        <span className="transition-transform group-hover:translate-x-1">→</span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

function IconDau() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
        </svg>
    );
}
