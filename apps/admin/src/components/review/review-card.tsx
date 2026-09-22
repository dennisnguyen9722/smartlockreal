'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, MessageSquareReply, Star } from 'lucide-react';
import { toast } from 'sonner';
import { REVIEW_MAX_CONTENT, formatVnPhone, type ReviewItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Dialog, DialogContent, DialogTitle } from '@ktm/ui/components/dialog';
import { cn } from '@ktm/ui/lib/utils';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';

const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

export function Stars({ rating, className }: { rating: number; className?: string }) {
    return (
        <span className={cn('inline-flex', className)} aria-label={`${rating} sao`}>
            {[1, 2, 3, 4, 5].map((value) => (
                <Star key={value} className={cn('size-4', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
            ))}
        </span>
    );
}

/** Một đánh giá: nội dung, ảnh, thao tác duyệt/từ chối/trả lời */
export function ReviewCard({
    review,
    canModerate,
    onReject,
    onConflict,
}: {
    review: ReviewItem;
    canModerate: boolean;
    onReject: (review: ReviewItem) => void;
    onConflict: () => void;
}) {
    const [viewing, setViewing] = useState<string | null>(null);
    const [replying, setReplying] = useState(false);
    const [reply, setReply] = useState(review.reply ?? '');

    const handleError = (error: Error) => {
        if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
            toast.error('Đánh giá vừa được người khác xử lý, đã tải lại');
            onConflict();
            return;
        }
        toast.error(errorText(error));
    };

    const approve = useApiMutation<ReviewItem, void>(
        () => ({ path: `/reviews/${review.id}/approve`, method: 'POST', body: { expectedUpdatedAt: review.updatedAt } }),
        { invalidate: [['reviews']], onSuccess: () => toast.success('Đã duyệt, đánh giá hiện trên website'), onError: handleError },
    );

    const saveReply = useApiMutation<ReviewItem, string | null>(
        (content) => ({ path: `/reviews/${review.id}/reply`, method: 'PUT', body: { content, expectedUpdatedAt: review.updatedAt } }),
        {
            invalidate: [['reviews']],
            onSuccess: (saved) => {
                setReplying(false);
                toast.success(saved.reply ? 'Đã lưu câu trả lời' : 'Đã gỡ câu trả lời');
            },
            onError: handleError,
        },
    );

    const busy = approve.isPending || saveReply.isPending;

    return (
        <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={review.rating} />
                        <span className="font-medium">{review.reviewerName}</span>
                        <span className="text-xs text-muted-foreground">{formatVnPhone(review.reviewerPhone)}</span>
                        {review.verifiedPurchase ? (
                            <Badge variant="outline" className="gap-1 border-green-600/40 text-green-700 dark:text-green-400">
                                <BadgeCheck className="size-3.5" />
                                Đã mua hàng
                            </Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground">Chưa xác minh mua hàng</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        <Link href={`/san-pham/${review.product.id}`} className="hover:underline">
                            {review.product.name}
                        </Link>
                        {' · '}
                        {formatDateTimeVn(review.createdAt)}
                        {review.order && (
                            <>
                                {' · Đơn '}
                                <Link href={`/don-hang/${review.order.id}`} className="hover:underline">
                                    {review.order.code}
                                </Link>
                            </>
                        )}
                        {review.customer && (
                            <>
                                {' · Khách '}
                                <Link href={`/khach-hang/${review.customer.id}`} className="hover:underline">
                                    {review.customer.fullName}
                                </Link>
                            </>
                        )}
                    </p>
                </div>

                {canModerate && (
                    <div className="flex shrink-0 gap-2">
                        {review.status !== 'APPROVED' && (
                            <Button size="sm" onClick={() => approve.mutate()} disabled={busy}>
                                {review.status === 'REJECTED' ? 'Duyệt lại' : 'Duyệt'}
                            </Button>
                        )}
                        {review.status !== 'REJECTED' && (
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onReject(review)} disabled={busy}>
                                {review.status === 'APPROVED' ? 'Gỡ xuống' : 'Từ chối'}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {review.content ? (
                <p className="text-sm whitespace-pre-line">{review.content}</p>
            ) : (
                <p className="text-sm text-muted-foreground italic">Khách chỉ chấm sao, không viết nội dung</p>
            )}

            {review.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {review.photos.map((photo) => (
                        <button key={photo.url} type="button" onClick={() => setViewing(photo.url)} className="overflow-hidden rounded-md border">
                            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn */}
                            <img src={photo.thumbUrl} alt="" className="size-20 object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {review.status === 'REJECTED' && (
                <p className="rounded-md bg-destructive/5 p-2 text-xs">
                    <span className="font-medium text-destructive">Lý do từ chối: </span>
                    {review.rejectReason}
                    {review.moderatedBy && ` · ${review.moderatedBy.fullName}, ${formatDateTimeVn(review.moderatedAt)}`}
                    {' · Ảnh (nếu có) đã bị xóa.'}
                </p>
            )}
            {review.status === 'APPROVED' && review.moderatedBy && (
                <p className="text-xs text-muted-foreground">
                    Duyệt bởi {review.moderatedBy.fullName}, {formatDateTimeVn(review.moderatedAt)}
                </p>
            )}

            {/* Trả lời công khai */}
            {replying ? (
                <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                    <textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        rows={3}
                        maxLength={REVIEW_MAX_CONTENT}
                        className={TEXTAREA}
                        placeholder="Cảm ơn anh/chị đã tin dùng... (hiện công khai dưới đánh giá)"
                        autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => saveReply.mutate(reply.trim())} disabled={busy || !reply.trim()}>
                            Lưu câu trả lời
                        </Button>
                        {review.reply && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => saveReply.mutate(null)} disabled={busy}>
                                Gỡ câu trả lời
                            </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setReplying(false)} disabled={busy}>
                            Hủy
                        </Button>
                    </div>
                </div>
            ) : review.reply ? (
                <div className="rounded-md border-l-4 border-primary/60 bg-muted/40 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium">Công ty trả lời · {formatDateTimeVn(review.repliedAt)}</p>
                    <p className="whitespace-pre-line">{review.reply}</p>
                    {canModerate && review.status !== 'REJECTED' && (
                        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => setReplying(true)}>
                            Sửa
                        </Button>
                    )}
                </div>
            ) : (
                canModerate &&
                review.status !== 'REJECTED' && (
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReplying(true)}>
                        <MessageSquareReply className="size-4" />
                        Trả lời công khai
                    </Button>
                )
            )}

            <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogTitle className="sr-only">Ảnh khách gửi</DialogTitle>
                    {viewing && (
                        // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                        <img src={viewing} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}