import Link from 'next/link';
import type { StorefrontHome, StorefrontTaxonomy } from '@ktm/shared';
import { dinhDangDienThoai, soGoi } from '@/lib/api';

/**
 * Chân trang. Thuần máy chủ (không 'use client') nên không tốn JavaScript gửi về máy khách.
 * Thông tin công ty lấy từ cấu hình trong trang quản trị, không viết cứng ở đây —
 * sửa số điện thoại trong admin là cả website đổi theo.
 */

interface Props {
    loaiCua: StorefrontTaxonomy[];
    congTy: StorefrontHome['company'];
}

export function SiteFooter({ loaiCua, congTy }: Props) {
    const soBam = congTy.hotline ? soGoi(congTy.hotline) : null;
    const soHienThi = congTy.hotline ? dinhDangDienThoai(congTy.hotline) : null;
    const nam = new Date().getFullYear();

    return (
        <footer className="border-t border-white/10 bg-[var(--kt-navy-deep)]">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
                <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-12">
                    <div>
                        {/*
                          Dùng biểu tượng + chữ thay cho logo đầy đủ: logo đầy đủ có dòng
                          địa chỉ web rất nhỏ, thu về cỡ chân trang thì đọc không ra chữ.
                        */}
                        <div className="flex items-center gap-4">
                            <img
                                src="/logo-bieu-tuong-sang.svg"
                                alt=""
                                width={56}
                                height={56}
                                className="h-14 w-14"
                            />
                            <span className="leading-tight">
                                <span className="block text-lg font-bold text-white">
                                    Khóa Thông Minh
                                </span>
                                <span className="block text-xs font-medium tracking-[0.2em] text-[var(--kt-gold-soft)] uppercase">
                                    Chính hãng
                                </span>
                            </span>
                        </div>
                        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">
                            Nhà phân phối khóa cửa thông minh chính hãng. Tư vấn chọn khóa đúng loại cửa,
                            lắp đặt tận nơi và bảo hành theo tiêu chuẩn hãng.
                        </p>

                        {soBam && (
                            <div className="mt-6 flex flex-wrap gap-3">
                                <a
                                    href={`tel:${soBam}`}
                                    className="rounded-2xl bg-[var(--kt-gold)] px-5 py-3 text-sm font-bold text-[var(--kt-navy-deep)]"
                                >
                                    Gọi {soHienThi}
                                </a>
                                <a
                                    href={`https://zalo.me/${soBam}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
                                >
                                    Nhắn Zalo
                                </a>
                            </div>
                        )}
                    </div>

                    <nav aria-label="Khóa theo loại cửa">
                        <h2 className="text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Khóa theo loại cửa
                        </h2>
                        <ul className="mt-4 space-y-2.5">
                            {loaiCua.map((muc) => (
                                <li key={muc.slug}>
                                    <Link
                                        href={`/khoa-${muc.slug}`}
                                        className="text-sm text-white/70 transition-colors hover:text-white"
                                    >
                                        Khóa {muc.name.toLowerCase()}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div>
                        <h2 className="text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Liên hệ
                        </h2>
                        <ul className="mt-4 space-y-3 text-sm text-white/70">
                            {congTy.address && (
                                <li className="leading-relaxed">{congTy.address}</li>
                            )}
                            {soBam && (
                                <li>
                                    <a href={`tel:${soBam}`} className="hover:text-white">
                                        {soHienThi}
                                    </a>
                                </li>
                            )}
                            {congTy.email && (
                                <li>
                                    <a href={`mailto:${congTy.email}`} className="hover:text-white">
                                        {congTy.email}
                                    </a>
                                </li>
                            )}
                        </ul>

                        <h2 className="mt-8 text-xs font-semibold tracking-[0.18em] text-[var(--kt-gold-soft)] uppercase">
                            Thông tin
                        </h2>
                        <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                            <li>
                                <Link href="/san-pham" className="hover:text-white">
                                    Tất cả sản phẩm
                                </Link>
                            </li>
                            <li>
                                <Link href="/thuong-hieu" className="hover:text-white">
                                    Thương hiệu
                                </Link>
                            </li>
                            <li>
                                <Link href="/lien-he" className="hover:text-white">
                                    Liên hệ
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <p className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
                    © {nam} {congTy.name ?? 'Khóa Thông Minh Chính Hãng'}. Mọi quyền được bảo lưu.
                </p>
            </div>
        </footer>
    );
}
