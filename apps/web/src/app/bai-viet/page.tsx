import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { layDanhSachBaiViet } from '@/lib/api';
import { TheBaiViet } from '@/components/the-bai-viet';

/**
 * Danh sách bài viết.
 *
 * Đây là nguồn khách tìm kiếm dài hạn: khách gõ "khóa vân tay hết pin phải làm
 * sao" sẽ vào bài viết trước, rồi mới sang trang sản phẩm. Vì vậy mỗi bài là
 * một trang riêng được lập chỉ mục đầy đủ.
 */

export const revalidate = 300;

const PAGE_SIZE = 12;

type ThamSo = Record<string, string | string[] | undefined>;

function mot(giaTri: string | string[] | undefined): string | undefined {
    const chuoi = Array.isArray(giaTri) ? giaTri[0] : giaTri;
    return chuoi || undefined;
}

export const metadata: Metadata = {
    title: 'Kinh nghiệm chọn khóa cửa thông minh',
    description:
        'Hướng dẫn chọn khóa theo loại cửa, cách đo độ dày cánh, so sánh các hệ ứng dụng và xử lý sự cố thường gặp với khóa cửa thông minh.',
    alternates: { canonical: '/bai-viet' },
};

export default async function TrangBaiViet({ searchParams }: { searchParams: Promise<ThamSo> }) {
    const sp = await searchParams;
    const chuyenMuc = mot(sp.category);
    const trang = Number(mot(sp.page) ?? 1) || 1;

    const ketQua = await layDanhSachBaiViet({
        page: trang,
        pageSize: PAGE_SIZE,
        category: chuyenMuc,
    });

    const soTrang = Math.max(1, Math.ceil(ketQua.total / PAGE_SIZE));

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                    <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                        Kinh nghiệm chọn khóa
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Đọc trước khi mua
                    </h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-white/65">
                        Những điều nên biết về độ dày cánh, nguồn điện, chuẩn khóa và cách chọn cho
                        đúng — viết từ những câu khách hỏi nhiều nhất khi gọi hotline.
                    </p>
                </div>
            </section>

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
                {ketQua.categories.length > 0 && (
                    <ul className="mb-8 flex flex-wrap gap-2">
                        <li>
                            <Chip href="/bai-viet" dangChon={!chuyenMuc}>
                                Tất cả
                            </Chip>
                        </li>
                        {ketQua.categories.map((muc) => (
                            <li key={muc.slug}>
                                <Chip
                                    href={`/bai-viet?category=${muc.slug}`}
                                    dangChon={chuyenMuc === muc.slug}
                                >
                                    {muc.name}
                                    <span className="so-lieu ml-1.5 text-xs opacity-60">
                                        {muc.postCount}
                                    </span>
                                </Chip>
                            </li>
                        ))}
                    </ul>
                )}

                {ketQua.items.length === 0 ? (
                    <div className="kinh rounded-3xl p-10 text-center">
                        <p className="font-semibold text-white">Chưa có bài viết nào</p>
                        <p className="mt-2 text-sm text-white/60">
                            Chúng tôi đang viết. Trong lúc chờ, bạn gọi hotline hỏi trực tiếp cũng được.
                        </p>
                    </div>
                ) : (
                    <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {ketQua.items.map((bai, chiSo) => (
                            <li key={bai.slug}>
                                <TheBaiViet bai={bai} uuTien={chiSo < 3} />
                            </li>
                        ))}
                    </ul>
                )}

                {soTrang > 1 && (
                    <nav className="mt-10 flex justify-center gap-2" aria-label="Phân trang">
                        {Array.from({ length: soTrang }, (_, i) => i + 1).map((so) => {
                            const p = new URLSearchParams();
                            if (chuyenMuc) p.set('category', chuyenMuc);
                            if (so > 1) p.set('page', String(so));
                            const q = p.toString();
                            return (
                                <Link
                                    key={so}
                                    href={q ? `/bai-viet?${q}` : '/bai-viet'}
                                    aria-current={so === trang ? 'page' : undefined}
                                    className={`so-lieu min-w-10 rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                                        so === trang
                                            ? 'bg-[var(--kt-gold)] text-[var(--kt-navy-deep)]'
                                            : 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                                    }`}
                                >
                                    {so}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </div>
        </>
    );
}

function Chip({
    href,
    dangChon,
    children,
}: {
    href: string;
    dangChon: boolean;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-current={dangChon ? 'true' : undefined}
            className={`rounded-xl px-3.5 py-2 text-sm transition-colors ${
                dangChon
                    ? 'bg-[var(--kt-gold)] font-semibold text-[var(--kt-navy-deep)]'
                    : 'border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
            }`}
        >
            {children}
        </Link>
    );
}
