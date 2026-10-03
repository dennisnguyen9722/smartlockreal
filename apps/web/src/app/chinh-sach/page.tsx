import type { Metadata } from 'next';
import Link from 'next/link';
import { layDanhSachChinhSach } from '@/lib/api';

/**
 * Trang danh sách chính sách.
 *
 * Mỗi chính sách có trang riêng ở /chinh-sach/<đường-dẫn>. Trang này chỉ là chỗ
 * gom đầu mối, chủ yếu để khách và Google có một nơi thấy đủ cả bộ — website bán
 * hàng mà không có chính sách rõ ràng thì Google đánh giá thấp, khách cũng ngại.
 *
 * Chỉ hiện chính sách ĐANG CÓ HIỆU LỰC. Bản hẹn ngày trong tương lai thì API
 * chưa trả về, nên không lọt ra ngoài.
 */

export const revalidate = 1800;

export const metadata: Metadata = {
    title: 'Chính sách',
    description:
        'Chính sách bảo hành, đổi trả, giao hàng lắp đặt, thanh toán, bảo mật thông tin và điều khoản sử dụng của Khóa Thông Minh Chính Hãng.',
    alternates: { canonical: '/chinh-sach' },
};

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

export default async function TrangDanhSachChinhSach() {
    const danhSach = await layDanhSachChinhSach();

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
                    <nav aria-label="Đường dẫn" className="text-sm text-white/50">
                        <Link href="/" className="hover:text-white">
                            Trang chủ
                        </Link>
                    </nav>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Chính sách
                    </h1>
                    <p className="mt-4 max-w-2xl leading-relaxed text-white/70">
                        Mỗi lần sửa là một phiên bản mới, có ghi ngày bắt đầu áp dụng. Bản bạn đang
                        đọc là bản đang có hiệu lực.
                    </p>
                </div>
            </section>

            <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
                {danhSach.length === 0 ? (
                    <p className="text-white/60">
                        Chưa có chính sách nào được đăng. Cần thông tin gấp, bạn gọi hotline ở chân
                        trang để được trả lời trực tiếp.
                    </p>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {danhSach.map((muc) => (
                            <li key={muc.slug}>
                                <Link
                                    href={`/chinh-sach/${muc.slug}`}
                                    className="kinh group flex h-full flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1"
                                >
                                    <h2 className="text-lg font-bold text-white">{muc.label}</h2>
                                    {muc.title && muc.title !== muc.label && (
                                        <p className="mt-2 text-sm leading-relaxed text-white/60">{muc.title}</p>
                                    )}
                                    <span className="so-lieu mt-auto pt-5 text-xs text-white/45">
                                        Bản {muc.version} · áp dụng từ {ngayVn(muc.effectiveAt)}
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
