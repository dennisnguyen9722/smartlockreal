'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { REVIEW_REJECT_PRESETS, type ReviewItem } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ktm/ui/components/dialog';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation } from '@/lib/hooks';

/** Từ chối / gỡ đánh giá: bắt buộc lý do (bấm chọn nhanh hoặc tự gõ) */
export function RejectDialog({ review, onClose, onConflict }: { review: ReviewItem; onClose: () => void; onConflict: () => void }) {
    const [reason, setReason] = useState('');

    const reject = useApiMutation<ReviewItem, string>(
        (value) => ({ path: `/reviews/${review.id}/reject`, method: 'POST', body: { reason: value, expectedUpdatedAt: review.updatedAt } }),
        {
            invalidate: [['reviews']],
            onSuccess: () => {
                toast.success(review.status === 'APPROVED' ? 'Đã gỡ đánh giá khỏi website' : 'Đã từ chối đánh giá');
                onClose();
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    toast.error('Đánh giá vừa được người khác xử lý, đã tải lại');
                    onConflict();
                    onClose();
                    return;
                }
                toast.error(errorText(error));
            },
        },
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{review.status === 'APPROVED' ? 'Gỡ đánh giá khỏi website' : 'Từ chối đánh giá'}</DialogTitle>
                    <DialogDescription>
                        Đánh giá của <strong>{review.reviewerName}</strong> sẽ không hiện trên website
                        {review.photos.length > 0 && `, ${review.photos.length} ảnh kèm theo bị xóa`}. Khách có thể gửi lại đánh giá mới.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {REVIEW_REJECT_PRESETS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setReason(preset)}
                                className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        placeholder="Lý do (chỉ nhân viên thấy)"
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={reject.isPending}>
                        Hủy
                    </Button>
                    <Button variant="destructive" onClick={() => reject.mutate(reason.trim())} disabled={reject.isPending || reason.trim().length < 3}>
                        {reject.isPending ? 'Đang xử lý...' : review.status === 'APPROVED' ? 'Gỡ xuống' : 'Từ chối'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}