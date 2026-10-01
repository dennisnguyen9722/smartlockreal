'use client';

import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import type { ConsultKindValue } from '@ktm/shared';

/**
 * Form để khách lại số, dữ liệu đổ thẳng vào hộp thư trong trang quản trị.
 *
 * Vài quyết định đáng nói:
 *  - Chỉ HỌ TÊN và SỐ ĐIỆN THOẠI là bắt buộc. Mỗi ô bắt buộc thêm vào là mất
 *    thêm một phần khách bỏ dở; những thứ còn lại hỏi trong cuộc gọi nhanh hơn.
 *  - Có ô tick đồng ý: tên và số điện thoại là dữ liệu cá nhân, phải hỏi trước.
 *  - Có một ô ẩn bẫy bot. Người không thấy nên không bao giờ điền; bot điền mọi
 *    ô nó gặp. Chặn được phần lớn spam mà không bắt khách giải captcha.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface Props {
    kind: ConsultKindValue;
    tieuDe?: string;
    mo?: string;
    /** Trang đang đứng, để biết nội dung nào ra khách */
    sourcePath?: string;
    /** Gửi kèm khi form nằm trong trang sản phẩm */
    productSlug?: string;
    productName?: string;
    doorTypeName?: string;
}

interface LoiTruong {
    field: string;
    message: string;
}

export function FormTuVan({
    kind,
    tieuDe,
    mo,
    sourcePath,
    productSlug,
    productName,
    doorTypeName,
}: Props) {
    const maForm = useId();
    const laDuAn = kind === 'PROJECT';

    const [dangGui, setDangGui] = useState(false);
    const [xong, setXong] = useState(false);
    const [loiChung, setLoiChung] = useState('');
    const [loiTruong, setLoiTruong] = useState<Record<string, string>>({});

    async function gui(sukien: FormEvent<HTMLFormElement>) {
        sukien.preventDefault();
        if (dangGui) return;

        const form = new FormData(sukien.currentTarget);
        const lay = (ten: string) => String(form.get(ten) ?? '').trim();

        setDangGui(true);
        setLoiChung('');
        setLoiTruong({});

        const than: Record<string, unknown> = {
            kind,
            fullName: lay('fullName'),
            phone: lay('phone'),
            privacyConsent: form.get('privacyConsent') ? true : false,
            website: lay('website'),
        };
        // Chỉ gửi trường nào có giá trị: schema bên API dùng .strict(),
        // nhưng chuỗi rỗng thì để API tự hiểu là bỏ trống cho gọn
        const themNeuCo = (khoa: string, giaTri: string | undefined) => {
            if (giaTri) than[khoa] = giaTri;
        };
        themNeuCo('email', lay('email'));
        themNeuCo('company', lay('company'));
        themNeuCo('quantity', lay('quantity'));
        themNeuCo('message', lay('message'));
        themNeuCo('sourcePath', sourcePath);
        themNeuCo('productSlug', productSlug);
        themNeuCo('productName', productName);
        themNeuCo('doorTypeName', doorTypeName);

        try {
            const res = await fetch(`${API_URL}/shop/consult`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(than),
            });

            if (res.ok) {
                setXong(true);
                return;
            }

            const loi = (await res.json().catch(() => ({}))) as {
                message?: string;
                details?: unknown;
            };

            if (Array.isArray(loi.details)) {
                const theoTruong: Record<string, string> = {};
                for (const muc of loi.details as LoiTruong[]) {
                    if (muc?.field && muc?.message) theoTruong[muc.field] = muc.message;
                }
                setLoiTruong(theoTruong);
                if (Object.keys(theoTruong).length === 0) {
                    setLoiChung(loi.message ?? 'Gửi không được, bạn thử lại giúp mình.');
                }
            } else if (res.status === 429) {
                setLoiChung('Bạn vừa gửi nhiều lần. Chờ một lát rồi gửi lại, hoặc gọi trực tiếp giúp mình.');
            } else {
                setLoiChung(loi.message ?? 'Gửi không được, bạn thử lại giúp mình.');
            }
        } catch {
            setLoiChung('Không kết nối được. Kiểm tra mạng rồi gửi lại giúp mình.');
        } finally {
            setDangGui(false);
        }
    }

    if (xong) {
        return (
            <div className="kinh rounded-3xl p-8 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--kt-gold)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--kt-navy-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 5 5L20 7" />
                    </svg>
                </div>
                <p className="text-lg font-bold text-white">Đã nhận yêu cầu của bạn</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Nhân viên kỹ thuật sẽ gọi lại trong giờ làm việc. Cần gấp thì bạn gọi thẳng số
                    hotline giúp mình.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={gui} className="kinh rounded-3xl p-6 sm:p-7" noValidate>
            {tieuDe && <h3 className="text-lg font-bold text-white">{tieuDe}</h3>}
            {mo && <p className="mt-2 text-sm leading-relaxed text-white/65">{mo}</p>}

            <div className="mt-5 space-y-4">
                <O
                    id={`${maForm}-ten`}
                    name="fullName"
                    nhan="Họ tên"
                    batBuoc
                    autoComplete="name"
                    loi={loiTruong.fullName}
                />
                <O
                    id={`${maForm}-sdt`}
                    name="phone"
                    nhan="Số điện thoại"
                    batBuoc
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    goiY="Ví dụ 0902 330 328"
                    loi={loiTruong.phone}
                />

                {laDuAn && (
                    <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
                        <O
                            id={`${maForm}-congty`}
                            name="company"
                            nhan="Công ty hoặc tên công trình"
                            autoComplete="organization"
                            loi={loiTruong.company}
                        />
                        <O
                            id={`${maForm}-soluong`}
                            name="quantity"
                            nhan="Số lượng dự kiến"
                            type="number"
                            inputMode="numeric"
                            goiY="bộ"
                            loi={loiTruong.quantity}
                        />
                    </div>
                )}

                <div>
                    <label
                        htmlFor={`${maForm}-noidung`}
                        className="mb-1.5 block text-sm font-medium text-white/85"
                    >
                        {laDuAn ? 'Mô tả công trình' : 'Bạn cần tư vấn gì?'}
                    </label>
                    <textarea
                        id={`${maForm}-noidung`}
                        name="message"
                        rows={3}
                        placeholder={
                            laDuAn
                                ? 'Loại cửa, số tầng, tiến độ bàn giao…'
                                : 'Nhà bạn cửa gì, đang dùng khóa nào…'
                        }
                        className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[var(--kt-gold-soft)] focus:outline-none"
                    />
                    {loiTruong.message && <Loi>{loiTruong.message}</Loi>}
                </div>

                {/*
                  Bẫy bot. Giấu bằng CSS chứ không dùng type="hidden": bot đọc HTML
                  thấy input text là điền, còn trình đọc màn hình bị aria-hidden và
                  tabIndex -1 chặn nên người dùng thật không bao giờ chạm tới.
                */}
                <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                    <label htmlFor={`${maForm}-web`}>Để trống ô này</label>
                    <input id={`${maForm}-web`} name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-white/70">
                    <input
                        type="checkbox"
                        name="privacyConsent"
                        className="mt-0.5 size-4 shrink-0 accent-[var(--kt-gold)]"
                    />
                    <span>
                        Tôi đồng ý để công ty dùng số điện thoại này gọi lại tư vấn.
                        {loiTruong.privacyConsent && <Loi>{loiTruong.privacyConsent}</Loi>}
                    </span>
                </label>

                {loiChung && (
                    <p role="alert" className="rounded-xl bg-[#b3261e]/20 px-4 py-3 text-sm text-[#ffb4ab]">
                        {loiChung}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={dangGui}
                    className="w-full rounded-2xl bg-[var(--kt-gold)] px-6 py-3.5 font-bold text-[var(--kt-navy-deep)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {dangGui ? 'Đang gửi…' : laDuAn ? 'Gửi yêu cầu báo giá' : 'Gửi yêu cầu tư vấn'}
                </button>
            </div>
        </form>
    );
}

function O({
    id,
    name,
    nhan,
    batBuoc,
    goiY,
    loi,
    ...conLai
}: {
    id: string;
    name: string;
    nhan: string;
    batBuoc?: boolean;
    goiY?: string;
    loi?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/85">
                {nhan}
                {batBuoc && <span className="ml-1 text-[var(--kt-gold-soft)]">*</span>}
            </label>
            <input
                id={id}
                name={name}
                placeholder={goiY}
                aria-invalid={loi ? true : undefined}
                className={`w-full rounded-2xl border bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none ${
                    loi
                        ? 'border-[#ff897d] focus:border-[#ff897d]'
                        : 'border-white/20 focus:border-[var(--kt-gold-soft)]'
                }`}
                {...conLai}
            />
            {loi && <Loi>{loi}</Loi>}
        </div>
    );
}

function Loi({ children }: { children: ReactNode }) {
    return <span className="mt-1 block text-xs text-[#ff897d]">{children}</span>;
}
