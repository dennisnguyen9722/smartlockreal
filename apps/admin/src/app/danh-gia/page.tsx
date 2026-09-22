'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { REVIEW_STATUS_LABEL, type Paginated, type ReviewItem, type ReviewStatusCounts, type ReviewStatusValue } from '@ktm/shared';
import { Input } from '@ktm/ui/components/input';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { RejectDialog } from '@/components/review/reject-dialog';
import { ReviewCard } from '@/components/review/review-card';
import { useApiQuery } from '@/lib/hooks';
import { useDebounced } from '@/lib/use-debounced';

const TABS: ReviewStatusValue[] = ['PENDING', 'APPROVED', 'REJECTED'];
const PAGE_SIZE = 20;
const SELECT = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm';

export default function ReviewPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={4} />}>
            <ReviewContent />
        </Suspense>
    );
}

function ReviewContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { can } = useAuth();
    const canModerate = can('review.moderate');

    // Bộ lọc nằm trên URL: tải lại trang vẫn giữ đúng tab, đúng trang
    const status = (TABS.find((tab) => tab === searchParams.get('status')) ?? 'PENDING') as ReviewStatusValue;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const rating = searchParams.get('sao') ?? '';
    const verified = searchParams.get('da-mua') ?? '';
    const [search, setSearch] = useState(searchParams.get('q') ?? '');
    const term = useDebounced(search.trim());
    const [rejecting, setRejecting] = useState<ReviewItem | null>(null);

    function update(next: Record<string, string | number | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(next)) {
            if (value === null || value === '' || (key === 'status' && value === 'PENDING') || (key === 'page' && value === 1)) params.delete(key);
            else params.set(key, String(value));
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    useEffect(() => {
        if (term !== (searchParams.get('q') ?? '')) update({ q: term, page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    const params = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
    if (rating) params.set('rating', rating);
    if (verified) params.set('verified', verified);
    if (term) params.set('search', term);
    const query = useApiQuery<Paginated<ReviewItem> & { statusCounts: ReviewStatusCounts }>(
        ['reviews', status, page, rating, verified, term],
        `/reviews?${params.toString()}`,
        { placeholderData: (previous) => previous, refetchOnMount: 'always', enabled: canModerate },
    );

    const reload = () => void queryClient.invalidateQueries({ queryKey: ['reviews'] });

    if (!canModerate) {
        return (
            <>
                <PageHeader title="Đánh giá" />
                <EmptyState message="Bạn không có quyền duyệt đánh giá" />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Đánh giá"
                description="Khách đánh giá ở trang sản phẩm; chỉ đánh giá đã duyệt mới hiện trên website và được tính vào điểm sản phẩm."
            />

            <div className="mb-3 flex gap-1 overflow-x-auto border-b">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => update({ status: tab, page: 1 })}
                        className={cn(
                            '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                            status === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {REVIEW_STATUS_LABEL[tab]}
                        <span
                            className={cn(
                                'ml-1.5 text-xs',
                                tab === 'PENDING' && (query.data?.statusCounts.PENDING ?? 0) > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground',
                            )}
                        >
                            {query.data?.statusCounts[tab] ?? ''}
                        </span>
                    </button>
                ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
                <div className="relative min-w-60 flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, số điện thoại, nội dung, tên sản phẩm" className="pl-9" />
                </div>
                <select value={rating} onChange={(event) => update({ sao: event.target.value, page: 1 })} className={SELECT}>
                    <option value="">Mọi số sao</option>
                    {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                            {value} sao
                        </option>
                    ))}
                </select>
                <select value={verified} onChange={(event) => update({ 'da-mua': event.target.value, page: 1 })} className={SELECT}>
                    <option value="">Tất cả người viết</option>
                    <option value="true">Đã mua hàng</option>
                    <option value="false">Chưa xác minh</option>
                </select>
            </div>

            {status === 'PENDING' && (
                <p className="mb-3 text-xs text-muted-foreground">
                    Xếp cũ nhất trước. Đánh giá thấp từ khách đã mua nên gọi lại hỏi thăm trước khi trả lời công khai.
                </p>
            )}

            {query.isPending ? (
                <LoadingRows rows={4} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : query.data.items.length === 0 ? (
                <EmptyState message={status === 'PENDING' ? 'Không có đánh giá nào chờ duyệt' : 'Không có đánh giá nào'} />
            ) : (
                <div className="rounded-lg border">
                    <div className="divide-y">
                        {query.data.items.map((review) => (
                            // key kèm updatedAt: dữ liệu đổi thì ô trả lời lấy lại nội dung mới
                            <ReviewCard
                                key={`${review.id}-${review.updatedAt}`}
                                review={review}
                                canModerate={canModerate}
                                onReject={setRejecting}
                                onConflict={reload}
                            />
                        ))}
                    </div>
                    <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={(next) => update({ page: next })} />
                </div>
            )}

            {rejecting && <RejectDialog key={rejecting.id} review={rejecting} onClose={() => setRejecting(null)} onConflict={reload} />}
        </>
    );
}