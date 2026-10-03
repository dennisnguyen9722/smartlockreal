import Link from 'next/link';
import type { Metadata } from 'next';
import { layDuLieuChung, dinhDangDienThoai, soGoi } from '@/lib/api';

/**
 * Trang 404.
 *
 * Hôm nay đổi đường dẫn 201 sản phẩm sang tên thương mại, nên sẽ có người giữ
 * link cũ hoặc Google còn nhớ địa chỉ cũ một thời gian. Trang này phải dẫn họ đi
 * tiếp chứ không để họ đóng tab: có lối vào theo loại cửa và có số điện thoại.
 */

export const metadata: Metadata = {
    title: 'Không tìm thấy trang',
    robots: { index: false, follow: true },
};

export default async function KhongTimThay() {
    const chung = await layDuLieuChung();
    const soBam = chung.congTy.hotline ? soGoi(chung.congTy.hotline) : null;
    const soHienThi = chung.congTy.hotline ? dinhDangDienThoai(chung.congTy.hotline) : null;

    return (
        <section className="nen-sang-mo">
            <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
                <p className="so-lieu text-6xl font-bold text-[var(--kt-gold-soft)]">404</p>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                    Trang này không còn nữa
                </h1>
                <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/65">
                    Có thể sản phẩm đã đổi tên, hoặc đường dẫn bạn giữ là bản cũ. Chọn theo loại cửa
                    bên dưới, hoặc gọi hotline để chúng tôi tìm giúp.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link
                        href="/san-pham"
                        className="rounded-2xl bg-[var(--kt-gold)] px-6 py-3.5 font-bold text-[var(--kt-navy-deep)]"
                    >
                        Xem tất cả sản phẩm
                    </Link>
                    {soBam && (
                        <a
                            href={`tel:${soBam}`}
                            className="so-lieu rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 font-semibold text-white"
                        >
                            Gọi {soHienThi}
                        </a>
                    )}
                </div>

                {chung.loaiCua.length > 0 && (
                    <>
                        <p className="mt-12 text-xs font-semibold tracking-[0.18em] text-white/45 uppercase">
                            Chọn theo loại cửa
                        </p>
                        <ul className="mt-4 flex flex-wrap justify-center gap-2">
                            {chung.loaiCua.map((muc) => (
                                <li key={muc.slug}>
                                    <Link
                                        href={`/khoa/${muc.slug}`}
                                        className="kinh flex items-baseline gap-2 rounded-2xl px-5 py-3 transition-all hover:-translate-y-0.5"
                                    >
                                        <span className="font-semibold text-white">
                                            Khóa {muc.name.toLowerCase()}
                                        </span>
                                        <span className="so-lieu text-xs text-white/50">
                                            {muc.productCount}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </section>
    );
}
