'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PostCategoryItem } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { apiFieldErrors } from '@/lib/product-form';

const KEY = [['post-categories'], ['posts']];

export default function PostCategoriesPage() {
    const { can } = useAuth();
    const canManage = can('content.manage');
    const query = useApiQuery<PostCategoryItem[]>(['post-categories'], '/post-categories');
    const [newName, setNewName] = useState('');
    const [deleting, setDeleting] = useState<PostCategoryItem | null>(null);

    const create = useApiMutation<PostCategoryItem[], { name: string }>((body) => ({ path: '/post-categories', method: 'POST', body }), {
        invalidate: KEY,
        onSuccess: () => {
            setNewName('');
            toast.success('Đã thêm chuyên mục');
        },
        onError: (error) => toast.error(apiFieldErrors(error)?.name ?? errorText(error)),
    });

    const remove = useApiMutation<void, string>((id) => ({ path: `/post-categories/${id}`, method: 'DELETE' }), {
        invalidate: KEY,
        onSuccess: () => {
            setDeleting(null);
            toast.success('Đã xóa chuyên mục');
        },
        onError: (error) => toast.error(errorText(error)),
    });

    const back = (
        <Link href="/bai-viet">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Bài viết
            </Button>
        </Link>
    );

    return (
        <>
            <PageHeader title="Chuyên mục bài viết" description="Nhóm bài trên website, vd: Tin tức, Hướng dẫn chọn khóa, So sánh" actions={back} />

            <div className="max-w-3xl space-y-4">
                {canManage && (
                    <div className="flex gap-2">
                        <Input
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && newName.trim()) create.mutate({ name: newName.trim() });
                            }}
                            placeholder="Tên chuyên mục mới"
                        />
                        <Button onClick={() => create.mutate({ name: newName.trim() })} disabled={!newName.trim() || create.isPending}>
                            <Plus className="size-4" />
                            Thêm
                        </Button>
                    </div>
                )}

                {query.isPending ? (
                    <LoadingRows rows={3} />
                ) : query.isError ? (
                    <ErrorState message={query.error.message} />
                ) : query.data.length === 0 ? (
                    <EmptyState message="Chưa có chuyên mục nào" />
                ) : (
                    <div className="divide-y rounded-lg border">
                        {query.data.map((category) => (
                            <CategoryRow key={`${category.id}-${category.name}-${category.slug}-${category.sortOrder}`} category={category} canManage={canManage} onDelete={() => setDeleting(category)} />
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Xóa chuyên mục"
                description={
                    <>
                        Xóa chuyên mục <strong>{deleting?.name}</strong>?
                        {deleting && deleting.postCount > 0
                            ? ` ${deleting.postCount} bài trong chuyên mục sẽ chuyển về "Chưa phân loại", bài không bị xóa.`
                            : ' Chuyên mục chưa có bài nào.'}
                    </>
                }
                confirmLabel="Xóa"
                destructive
                loading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id)}
            />
        </>
    );
}

/** Một dòng sửa tại chỗ: đổi tên, đường dẫn, thứ tự rồi bấm Lưu */
function CategoryRow({ category, canManage, onDelete }: { category: PostCategoryItem; canManage: boolean; onDelete: () => void }) {
    const [name, setName] = useState(category.name);
    const [slug, setSlug] = useState(category.slug);
    const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
    const [error, setError] = useState('');

    const dirty = name.trim() !== category.name || slug.trim() !== category.slug || sortOrder !== String(category.sortOrder);

    const save = useApiMutation<PostCategoryItem[], Record<string, unknown>>((body) => ({ path: `/post-categories/${category.id}`, method: 'PATCH', body }), {
        invalidate: KEY,
        onSuccess: () => toast.success('Đã lưu chuyên mục'),
        onError: (apiError) => {
            const fields = apiFieldErrors(apiError);
            setError(fields ? Object.values(fields).join(', ') : errorText(apiError));
        },
    });

    function submit() {
        const order = Number(sortOrder);
        if (!Number.isInteger(order) || order < 0) {
            setError('Thứ tự là số nguyên từ 0');
            return;
        }
        setError('');
        const body: Record<string, unknown> = {};
        if (name.trim() !== category.name) body.name = name.trim();
        if (slug.trim() !== category.slug) body.slug = slug.trim();
        if (order !== category.sortOrder) body.sortOrder = order;
        save.mutate(body);
    }

    return (
        <div className="space-y-1 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} className="min-w-40 flex-1" aria-label="Tên" />
                <Input value={slug} onChange={(event) => setSlug(event.target.value)} disabled={!canManage} className="w-48 font-mono text-xs" aria-label="Đường dẫn" />
                <Input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} disabled={!canManage} inputMode="numeric" className="w-16" aria-label="Thứ tự" title="Thứ tự (số nhỏ hiện trước)" />
                <span className="w-16 text-right text-xs text-muted-foreground">{category.postCount} bài</span>
                {canManage && (
                    <>
                        <Button size="sm" onClick={submit} disabled={!dirty || save.isPending}>
                            Lưu
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete} aria-label="Xóa">
                            <Trash2 className="size-4" />
                        </Button>
                    </>
                )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}