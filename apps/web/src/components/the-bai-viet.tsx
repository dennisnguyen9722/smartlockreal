import Link from 'next/link';
import type { StorefrontPost } from '@ktm/shared';
import { boAnh } from '@/lib/api';

/**
 * Thẻ bài viết, dùng ở trang danh sách, khối "bài khác cùng chủ đề" và khối
 * bài viết trên trang chủ. Để riêng chứ không để trong file trang: lấy component
 * từ một file page.tsx sẽ kéo theo cả metadata và revalidate của trang đó.
 */
export function TheBaiViet({ bai, uuTien = false }: { bai: StorefrontPost; uuTien?: boolean }) {
    return (
        <Link
            href={`/bai-viet/${bai.slug}`}
            className="kinh group flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1"
        >
            {bai.coverUrl ? (
                <img
                    {...boAnh(bai.coverUrl)}
                    sizes="(max-width: 768px) 100vw, 400px"
                    alt=""
                    loading={uuTien ? 'eager' : 'lazy'}
                    decoding="async"
                    className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
            ) : (
                <div className="aspect-[16/9] w-full bg-white/5" />
            )}

            <div className="flex flex-1 flex-col gap-2 p-5">
                {bai.categoryName && (
                    <p className="text-xs font-semibold tracking-wide text-[var(--kt-gold-soft)] uppercase">
                        {bai.categoryName}
                    </p>
                )}
                <h2 className="line-clamp-2 font-semibold text-white">{bai.title}</h2>
                {bai.excerpt && (
                    <p className="line-clamp-3 text-sm leading-relaxed text-white/60">{bai.excerpt}</p>
                )}
                {bai.publishedAt && (
                    <time
                        dateTime={bai.publishedAt}
                        className="so-lieu mt-auto pt-3 text-xs text-white/45"
                    >
                        {new Intl.DateTimeFormat('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                        }).format(new Date(bai.publishedAt))}
                    </time>
                )}
            </div>
        </Link>
    );
}
