'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShowroomUpdateSchema, showroomPath, type ShowroomDetail } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ShowroomForm } from '@/components/showroom/showroom-form';
import { ShowroomStatusCard } from '@/components/showroom/showroom-status-card';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';
import { buildShowroomPayload, draftFromShowroom, showroomFieldKey, type ShowroomDraft } from '@/lib/showroom-form';

function remapErrors(errors: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, message] of Object.entries(errors)) {
        const field = showroomFieldKey(key);
        if (!result[field]) result[field] = message;
    }
    return result;
}

const backButton = (
    <Link href="/showroom">
        <Button variant="outline">
            <ArrowLeft className="size-4" />
            Danh sách
        </Button>
    </Link>
);

export default function ShowroomDetailPage() {
    const { id } = useParams<{ id: string }>();
    const query = useApiQuery<ShowroomDetail>(['showroom', id], `/showrooms/${id}`);

    if (query.isPending) {
        return (
            <>
                <PageHeader title="Chi tiết showroom" actions={backButton} />
                <LoadingRows rows={6} />
            </>
        );
    }

    if (query.isError) {
        const notFound =
            query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Chi tiết showroom" actions={backButton} />
                {notFound ? <EmptyState message="Không tìm thấy showroom này" action={backButton} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }

    return <ShowroomEditor showroom={query.data} onReload={async () => (await query.refetch()).data} />;
}

function ShowroomEditor({
    showroom,
    onReload,
}: {
    showroom: ShowroomDetail;
    onReload: () => Promise<ShowroomDetail | undefined>;
}) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { can } = useAuth();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const canManage = can('content.manage');

    // snapshot: bản gốc mà draft được tạo ra; base: updatedAt tương ứng, gửi kèm khi lưu
    const [snapshot, setSnapshot] = useState<ShowroomDraft>(() => draftFromShowroom(showroom));
    const [base, setBase] = useState(showroom.updatedAt);
    const [draft, setDraft] = useState<ShowroomDraft>(snapshot);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [conflict, setConflict] = useState(false);

    const built = useMemo(() => buildShowroomPayload(draft, snapshot), [draft, snapshot]);
    const dirty = Object.keys(built.payload).length > 0 || Object.keys(built.errors).length > 0;

    function resetFrom(next: ShowroomDetail) {
        const fresh = draftFromShowroom(next);
        setSnapshot(fresh);
        setDraft(fresh);
        setBase(next.updatedAt);
        setErrors({});
        setConflict(false);
    }

    // Máy chủ có bản mới: chưa sửa gì thì cập nhật theo
    useEffect(() => {
        if (showroom.updatedAt !== base && !dirty) resetFrom(showroom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showroom.updatedAt]);

    // Cảnh báo khi đóng tab hoặc tải lại trình duyệt lúc còn thay đổi chưa lưu
    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const save = useApiMutation<ShowroomDetail, Record<string, unknown>>(
        (body) => ({ path: `/showrooms/${showroom.id}`, method: 'PATCH', body }),
        {
            invalidate: [['showrooms']],
            onSuccess: (data) => {
                resetFrom(data);
                queryClient.setQueryData(['showroom', showroom.id], data);
                toast.success('Đã lưu thay đổi');
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    setConflict(true);
                    return;
                }
                const fieldErrors = apiFieldErrors(error);
                if (fieldErrors) {
                    setErrors(remapErrors(fieldErrors));
                    toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
                    return;
                }
                toast.error(error.message);
            },
        },
    );

    const remove = useApiMutation<void, void>(() => ({ path: `/showrooms/${showroom.id}`, method: 'DELETE' }), {
        invalidate: [['showrooms']],
        onSuccess: () => {
            toast.success('Đã xóa showroom');
            // Bỏ cache trang chi tiết để không tải lại showroom vừa xóa
            queryClient.removeQueries({ queryKey: ['showroom', showroom.id] });
            router.replace('/showroom');
        },
        onError: (error) => {
            setConfirmDelete(false);
            toast.error(errorText(error));
        },
    });

    function submit() {
        const payload = { ...built.payload, expectedUpdatedAt: base };
        const parsed = ShowroomUpdateSchema.safeParse(payload);
        const collected = parsed.success ? {} : remapErrors(collectFieldErrors([...parsed.error.issues]));
        const all = { ...collected, ...built.errors };
        if (Object.keys(all).length > 0) {
            setErrors(all);
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }
        setErrors({});
        save.mutate(payload);
    }

    async function reloadLatest() {
        const latest = await onReload();
        if (latest) {
            resetFrom(latest);
            toast.info('Đã tải bản mới nhất');
        }
    }

    return (
        <>
            <PageHeader
                title={showroom.name}
                description={showroom.address}
                actions={
                    <>
                        {showroom.isPublic && showroom.slug && (
                            // Website bán hàng làm ở Bước 9: tạm hiện đường dẫn, chưa bấm mở được
                            <span className="text-xs text-muted-foreground">Trên website: {showroomPath(showroom.slug)}</span>
                        )}
                        {backButton}
                    </>
                }
            />

            {conflict && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" />
                    <span className="flex-1">
                        Có người vừa sửa showroom này. Tải bản mới nhất sẽ <strong>bỏ thay đổi của bạn</strong>; nên ghi lại những gì
                        cần sửa trước.
                    </span>
                    <Button variant="outline" onClick={reloadLatest}>
                        <RefreshCw className="size-4" />
                        Tải bản mới nhất
                    </Button>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-4">
                    {/* fieldset disabled khóa mọi ô nhập khi không có quyền sửa */}
                    <fieldset disabled={!canManage || save.isPending} className="min-w-0">
                        <ShowroomForm mode="edit" value={draft} onChange={setDraft} errors={errors} disabled={!canManage || save.isPending} />
                    </fieldset>

                    {canManage && dirty && (
                        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background py-3">
                            <span className="mr-auto text-sm text-muted-foreground">Có thay đổi chưa lưu</span>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setDraft(snapshot);
                                    setErrors({});
                                }}
                                disabled={save.isPending}
                            >
                                Hủy thay đổi
                            </Button>
                            <Button onClick={submit} disabled={save.isPending || conflict}>
                                {save.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
                    <fieldset disabled={!canManage || save.isPending}>
                        <ShowroomStatusCard
                            value={draft}
                            onChange={setDraft}
                            orderCount={showroom.orderCount}
                            publishedAt={showroom.publishedAt}
                        />
                    </fieldset>
                    {errors.isPublic && <p className="text-xs text-destructive">{errors.isPublic}</p>}
                    {canManage && (
                        <div className="space-y-1.5 pt-2">
                            <Button
                                variant="outline"
                                className="w-full text-destructive"
                                onClick={() => setConfirmDelete(true)}
                                disabled={showroom.orderCount > 0 || save.isPending || remove.isPending}
                            >
                                <Trash2 className="size-4" />
                                Xóa showroom
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                {showroom.orderCount > 0
                                    ? 'Showroom đã có đơn nhận hàng nên không xóa được. Showroom đóng cửa thì bỏ tick "Đang hoạt động".'
                                    : 'Chỉ xóa showroom tạo nhầm hoặc tạo để thử. Showroom đóng cửa thì bỏ tick "Đang hoạt động".'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Xóa showroom"
                description={
                    <>
                        Xóa hẳn <strong>{showroom.name}</strong>? Thao tác này không hoàn tác được.
                        {showroom.publishedAt &&
                            ' Showroom từng hiện trên website: link cũ (Google, Zalo đã chia sẻ) sẽ báo không tìm thấy trang.'}{' '}
                        Ảnh vẫn còn trong Thư viện ảnh.
                    </>
                }
                confirmLabel="Xóa"
                destructive
                loading={remove.isPending}
                onConfirm={() => remove.mutate()}
            />
        </>
    );
}