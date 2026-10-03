import type { Metadata } from 'next';
import { layDuLieuChung, layTrangChu, timSanPhamAnToan } from '@/lib/api';
import { DanhSachSanPhamView } from '@/components/danh-sach';

/**
 * Trang "Tất cả sản phẩm".
 *
 * Bộ lọc nằm trong địa chỉ trang (?doorType=cua-go&brand=kassler&sort=gia-tang)
 * nên mỗi tổ hợp là một trang riêng gửi được cho khách. Nhưng CHỈ trang gốc
 * cho Google lập chỉ mục — xem phần robots bên dưới.
 */

export const revalidate = 60;

const PAGE_SIZE = 24;

type ThamSo = Record<string, string | string[] | undefined>;

/** searchParams trong Next 16 là Promise, phải await */
function docThamSo(sp: ThamSo): Record<string, string> {
    const ra: Record<string, string> = {};
    for (const khoa of ['q', 'doorType', 'brand', 'sort', 'minPrice', 'maxPrice', 'page']) {
        const giaTri = sp[khoa];
        const chuoi = Array.isArray(giaTri) ? giaTri[0] : giaTri;
        if (chuoi) ra[khoa] = chuoi;
    }
    return ra;
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<ThamSo>;
}): Promise<Metadata> {
    const thamSo = docThamSo(await searchParams);
    const coLoc = Object.keys(thamSo).length > 0;

    return {
        title: 'Tất cả sản phẩm khóa cửa thông minh',
        description:
            'Toàn bộ khóa cửa thông minh chính hãng đang bán: khóa vân tay, khóa điện tử, khóa thẻ từ cho cửa gỗ, cửa nhôm, cửa kính, cửa cổng, đại sảnh và khách sạn.',
        alternates: { canonical: '/san-pham' },
        // Trang đã lọc là cùng một tập sản phẩm sắp xếp lại. Để Google lập chỉ mục
        // hết thì nó coi là nội dung trùng lặp và chia nhỏ sức mạnh của trang gốc.
        // Vẫn cho đi tiếp vào các trang sản phẩm bên trong.
        ...(coLoc ? { robots: { index: false, follow: true } } : {}),
    };
}

export default async function TrangSanPham({ searchParams }: { searchParams: Promise<ThamSo> }) {
    const thamSo = docThamSo(await searchParams);

    const [chung, home, ketQua] = await Promise.all([
        layDuLieuChung(),
        layTrangChu().catch(() => null),
        timSanPhamAnToan({ ...thamSo, pageSize: PAGE_SIZE }),
    ]);

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                    <p className="text-xs font-semibold tracking-[0.22em] text-[var(--kt-gold-soft)] uppercase">
                        Toàn bộ danh mục
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Tất cả sản phẩm
                    </h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-white/65">
                        Lọc theo loại cửa, thương hiệu và khoảng giá. Chưa chắc hợp cửa nhà mình thì gọi
                        hotline, kỹ thuật viên hỏi vài câu là biết ngay mẫu nào lắp vừa.
                    </p>
                </div>
            </section>

            <div className="pt-8">
                <DanhSachSanPhamView
                    ketQua={ketQua}
                    loaiCua={chung.loaiCua}
                    hang={home?.brands ?? []}
                    duongDanGoc="/san-pham"
                    thamSo={thamSo}
                />
            </div>
        </>
    );
}
