import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { layDuLieuChung, layLoaiCua, layTrangChu, timSanPhamAnToan } from '@/lib/api';
import { DanhSachSanPhamView } from '@/components/danh-sach';

/**
 * Trang đích theo loại cửa: /khoa/cua-go, /khoa/cua-nhom…
 *
 * Đây là trang quan trọng nhất cho tìm kiếm tự nhiên: "khóa cửa gỗ" là thứ
 * khách thật sự gõ lên Google, chứ không phải tên hãng hay mã model. Vì vậy
 * trang có tiêu đề riêng, mô tả riêng lấy từ phần mô tả loại cửa trong trang
 * quản trị, và được lập chỉ mục (khác với /san-pham?doorType=... vốn bị chặn).
 *
 * Đường dẫn là /khoa/<loại> chứ không phải /khoa-<loại>: Next.js App Router chỉ
 * nhận đoạn động trọn vẹn giữa hai dấu gạch chéo, không nhận tiền tố dính liền.
 */

export const revalidate = 300;

const PAGE_SIZE = 24;

type ThamSo = Record<string, string | string[] | undefined>;

function docThamSo(sp: ThamSo): Record<string, string> {
    const ra: Record<string, string> = {};
    for (const khoa of ['q', 'brand', 'sort', 'minPrice', 'maxPrice', 'page']) {
        const giaTri = sp[khoa];
        const chuoi = Array.isArray(giaTri) ? giaTri[0] : giaTri;
        if (chuoi) ra[khoa] = chuoi;
    }
    return ra;
}

/** Dựng sẵn mọi trang loại cửa lúc build, khách vào là có ngay */
export async function generateStaticParams() {
    try {
        const ds = await layLoaiCua();
        return ds.map((muc) => ({ loai: muc.slug }));
    } catch {
        // API chưa chạy lúc build thì để Next dựng theo yêu cầu
        return [];
    }
}

async function timLoai(slug: string) {
    const ds = await layLoaiCua().catch(() => []);
    return ds.find((muc) => muc.slug === slug) ?? null;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ loai: string }>;
}): Promise<Metadata> {
    const { loai } = await params;
    const muc = await timLoai(loai);
    if (!muc) return { title: 'Không tìm thấy loại cửa' };

    const ten = muc.name.toLowerCase();
    return {
        title: `Khóa ${ten} — ${muc.productCount} mẫu chính hãng`,
        description:
            muc.description ??
            `Khóa cửa thông minh cho ${ten}: khóa vân tay, khóa điện tử, khóa thẻ từ chính hãng. Tư vấn chọn đúng độ dày cánh, lắp đặt tận nơi, bảo hành chính hãng.`,
        alternates: { canonical: `/khoa/${muc.slug}` },
    };
}

export default async function TrangLoaiCua({
    params,
    searchParams,
}: {
    params: Promise<{ loai: string }>;
    searchParams: Promise<ThamSo>;
}) {
    const { loai } = await params;
    const thamSo = docThamSo(await searchParams);

    const [muc, chung, home] = await Promise.all([
        timLoai(loai),
        layDuLieuChung(),
        layTrangChu().catch(() => null),
    ]);

    if (!muc) notFound();

    const ketQua = await timSanPhamAnToan({ ...thamSo, doorType: loai, pageSize: PAGE_SIZE });
    const ten = muc.name.toLowerCase();

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                    <nav aria-label="Đường dẫn" className="text-sm text-white/50">
                        <Link href="/" className="hover:text-white">
                            Trang chủ
                        </Link>
                        <span className="mx-2">/</span>
                        <Link href="/san-pham" className="hover:text-white">
                            Sản phẩm
                        </Link>
                        <span className="mx-2">/</span>
                        <span className="text-white/80">Khóa {ten}</span>
                    </nav>

                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Khóa {ten}
                    </h1>
                    <p className="so-lieu mt-2 text-sm text-[var(--kt-gold-soft)]">
                        {muc.productCount} mẫu đang bán
                    </p>
                    {muc.description && (
                        <p className="mt-4 max-w-2xl leading-relaxed text-white/65">{muc.description}</p>
                    )}
                </div>
            </section>

            <div className="pt-8">
                <DanhSachSanPhamView
                    ketQua={ketQua}
                    loaiCua={chung.loaiCua}
                    hang={home?.brands ?? []}
                    duongDanGoc={`/khoa/${loai}`}
                    thamSo={thamSo}
                    anLocLoaiCua
                />
            </div>

            {/* Liên kết sang các loại cửa khác: giúp khách chọn lại, và giúp Google đi hết các trang */}
            {chung.loaiCua.length > 1 && (
                <section className="mx-auto max-w-7xl border-t border-white/10 px-4 py-12 sm:px-6">
                    <h2 className="text-sm font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                        Nhà bạn dùng cửa khác?
                    </h2>
                    <ul className="mt-4 flex flex-wrap gap-2">
                        {chung.loaiCua
                            .filter((item) => item.slug !== loai)
                            .map((item) => (
                                <li key={item.slug}>
                                    <Link
                                        href={`/khoa/${item.slug}`}
                                        className="kinh flex items-baseline gap-2 rounded-2xl px-5 py-3 transition-all hover:-translate-y-0.5"
                                    >
                                        <span className="font-semibold text-white">Khóa {item.name.toLowerCase()}</span>
                                        <span className="so-lieu text-xs text-white/50">{item.productCount}</span>
                                    </Link>
                                </li>
                            ))}
                    </ul>
                </section>
            )}
        </>
    );
}
