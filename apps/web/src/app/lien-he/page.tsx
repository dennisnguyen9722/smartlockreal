import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { dinhDangDienThoai, layDanhSachShowroom, layDuLieuChung, soGoi } from '@/lib/api';
import { FormTuVan } from '@/components/form-tu-van';

/**
 * Trang liên hệ.
 *
 * Mục tiêu là để khách gọi được NGAY, nên số điện thoại đặt to nhất và đứng
 * đầu, không bắt cuộn xuống tìm. Form chỉ là lối thứ hai cho người ngại gọi
 * hoặc đang ngoài giờ.
 */

export const revalidate = 300;

export const metadata: Metadata = {
    title: 'Liên hệ',
    description:
        'Hotline, địa chỉ showroom và form để lại số của Khóa Thông Minh Chính Hãng. Tư vấn chọn khóa theo loại cửa, khảo sát và lắp đặt tận nơi.',
    alternates: { canonical: '/lien-he' },
};

export default async function TrangLienHe() {
    const [chung, showroom] = await Promise.all([layDuLieuChung(), layDanhSachShowroom()]);

    const soBam = chung.congTy.hotline ? soGoi(chung.congTy.hotline) : null;
    const soHienThi = chung.congTy.hotline ? dinhDangDienThoai(chung.congTy.hotline) : null;

    return (
        <>
            <section className="nen-sang-mo border-b border-white/10">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                    <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        Liên hệ
                    </h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-white/65">
                        Gọi là nhanh nhất — kỹ thuật viên hỏi vài câu về cánh cửa nhà bạn là báo được
                        giá ngay. Ngoài giờ thì để lại số, chúng tôi gọi lại vào buổi sáng.
                    </p>

                    {soBam && (
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <a
                                href={`tel:${soBam}`}
                                className="so-lieu rounded-2xl bg-[var(--kt-gold)] px-7 py-4 text-xl font-bold text-[var(--kt-navy-deep)] shadow-xl shadow-black/30 sm:text-2xl"
                            >
                                {soHienThi}
                            </a>
                            <a
                                href={`https://zalo.me/${soBam}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-2xl border border-white/20 bg-white/10 px-6 py-4 font-semibold text-white"
                            >
                                Nhắn Zalo
                            </a>
                        </div>
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
                <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
                    <div>
                        <h2 className="text-xl font-bold sm:text-2xl">Thông tin công ty</h2>
                        <dl className="mt-6 space-y-4 text-sm">
                            <Dong nhan="Tên công ty" giaTri={chung.congTy.name} />
                            <Dong nhan="Địa chỉ" giaTri={chung.congTy.address} />
                            {soHienThi && soBam && (
                                <Dong
                                    nhan="Hotline"
                                    giaTri={
                                        <a href={`tel:${soBam}`} className="so-lieu hover:underline">
                                            {soHienThi}
                                        </a>
                                    }
                                />
                            )}
                            {chung.congTy.email && (
                                <Dong
                                    nhan="Email"
                                    giaTri={
                                        <a href={`mailto:${chung.congTy.email}`} className="hover:underline">
                                            {chung.congTy.email}
                                        </a>
                                    }
                                />
                            )}
                        </dl>

                        {showroom.length > 0 && (
                            <>
                                <h2 className="mt-10 text-xl font-bold sm:text-2xl">
                                    {showroom.length} showroom
                                </h2>
                                <ul className="mt-5 space-y-3">
                                    {showroom.map((muc) => (
                                        <li key={muc.slug}>
                                            <Link
                                                href={`/showroom/${muc.slug}`}
                                                className="kinh block rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                                            >
                                                <p className="font-semibold text-white">{muc.name}</p>
                                                <p className="mt-1 text-sm leading-relaxed text-white/60">
                                                    {muc.address}
                                                </p>
                                                {muc.openingHours.length > 0 && (
                                                    <p className="so-lieu mt-1.5 text-xs text-white/45">
                                                        {muc.openingHours[0]}
                                                    </p>
                                                )}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    <FormTuVan
                        kind="RETAIL"
                        tieuDe="Để lại số, chúng tôi gọi lại"
                        mo="Chỉ cần họ tên và số điện thoại. Không thu phí tư vấn."
                        sourcePath="/lien-he"
                    />
                </div>
            </section>
        </>
    );
}

function Dong({ nhan, giaTri }: { nhan: string; giaTri: ReactNode }) {
    if (!giaTri) return null;
    return (
        <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-white/45">{nhan}</dt>
            <dd className="min-w-0 text-white/85">{giaTri}</dd>
        </div>
    );
}
