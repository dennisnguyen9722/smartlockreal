'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CircleAlert, Lightbulb, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
    POST_STATUS_LABEL,
    PostCreateSchema,
    PostUpdateSchema,
    postPath,
    type PostCategoryItem,
    type PostDetail,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PostCoverField } from '@/components/post/post-cover-field';
import { PostProductPicker } from '@/components/post/post-product-picker';
import { RichTextEditor } from '@/components/post/rich-text-editor';
import { SlugField } from '@/components/slug-field';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn, fromLocalInput, toLocalInput } from '@/lib/order-types';
import {
    buildPostPayload,
    draftFromPost,
    emptyPostDraft,
    missingForPublish,
    recommendedForPublish,
    type PostDraft,
} from '@/lib/post-form';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';
const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

type StatusAction = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE';

/** Trang soạn bài: dùng chung cho tạo mới (post = undefined) và sửa */
export function PostEditor({ post, onReload }: { post?: PostDetail; onReload?: () => Promise<PostDetail | undefined> }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { can } = useAuth();
    const canManage = can('content.manage');
    const isEdit = Boolean(post);

    const [snapshot, setSnapshot] = useState<PostDraft>(() => (post ? draftFromPost(post) : emptyPostDraft()));
    const [draft, setDraft] = useState<PostDraft>(snapshot);
    const [base, setBase] = useState(post?.updatedAt ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [conflict, setConflict] = useState(false);
    const [scheduleAt, setScheduleAt] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    // HTML gốc lúc tải, để nhận ra bản TinyMCE vừa chuẩn hóa (không phải người dùng sửa)
    const loadedContent = useRef(snapshot.content);

    const categories = useApiQuery<PostCategoryItem[]>(['post-categories'], '/post-categories');

    const payload = useMemo(() => buildPostPayload(draft, isEdit ? snapshot : null), [draft, snapshot, isEdit]);
    const dirty = isEdit ? Object.keys(payload).length > 0 : Boolean(draft.title.trim() || draft.content);

    function resetFrom(next: PostDetail) {
        const fresh = draftFromPost(next);
        loadedContent.current = fresh.content;
        setSnapshot(fresh);
        setDraft(fresh);
        setBase(next.updatedAt);
        setErrors({});
        setConflict(false);
    }

    // Cảnh báo khi đóng tab hoặc tải lại trình duyệt lúc còn thay đổi chưa lưu
    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    function set<K extends keyof PostDraft>(key: K, value: PostDraft[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
        if (errors[key]) {
            setErrors((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
        }
    }

    function showApiError(error: Error) {
        if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
            setConflict(true);
            return;
        }
        const fieldErrors = apiFieldErrors(error);
        if (fieldErrors) {
            setErrors(fieldErrors);
            toast.error(fieldErrors.status ?? fieldErrors.content ?? 'Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
            return;
        }
        toast.error(errorText(error));
    }

    const save = useApiMutation<PostDetail, Record<string, unknown>>(
        (body) => (post ? { path: `/posts/${post.id}`, method: 'PATCH', body } : { path: '/posts', method: 'POST', body }),
        {
            invalidate: [['posts']],
            onSuccess: (saved) => {
                if (!post) {
                    toast.success('Đã lưu nháp');
                    router.replace(`/bai-viet/${saved.id}`);
                    return;
                }
                resetFrom(saved);
                queryClient.setQueryData(['post', saved.id], saved);
            },
            onError: showApiError,
        },
    );

    const status = useApiMutation<PostDetail, { action: StatusAction; publishAt?: string; expectedUpdatedAt: string }>(
        (body) => ({ path: `/posts/${post?.id}/status`, method: 'POST', body }),
        {
            invalidate: [['posts']],
            onSuccess: (saved, variables) => {
                resetFrom(saved);
                queryClient.setQueryData(['post', saved.id], saved);
                setScheduleAt('');
                const messages: Record<StatusAction, string> = {
                    PUBLISH: saved.scheduled ? `Đã hẹn đăng lúc ${formatDateTimeVn(saved.publishedAt)}` : 'Đã đăng bài',
                    UNPUBLISH: 'Đã gỡ bài về Nháp',
                    ARCHIVE: 'Đã chuyển vào Lưu trữ',
                    RESTORE: 'Đã khôi phục về Nháp',
                };
                toast.success(messages[variables.action]);
            },
            onError: showApiError,
        },
    );

    const remove = useApiMutation<void, void>(() => ({ path: `/posts/${post?.id}`, method: 'DELETE' }), {
        invalidate: [['posts']],
        onSuccess: () => {
            toast.success('Đã xóa bài');
            if (post) queryClient.removeQueries({ queryKey: ['post', post.id] });
            router.replace('/bai-viet');
        },
        onError: (error) => {
            setConfirmDelete(false);
            toast.error(errorText(error));
        },
    });

    const busy = save.isPending || status.isPending || remove.isPending;

    /** Kiểm tra bằng đúng schema của API rồi lưu. Trả về bài đã lưu (hoặc undefined nếu lỗi) */
    async function saveNow(): Promise<PostDetail | undefined> {
        const body = isEdit ? { ...payload, expectedUpdatedAt: base } : payload;
        const parsed = (isEdit ? PostUpdateSchema : PostCreateSchema).safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors([...parsed.error.issues]));
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return undefined;
        }
        setErrors({});
        try {
            return await save.mutateAsync(body);
        } catch {
            return undefined; // onError đã báo
        }
    }

    /** Đổi trạng thái; còn thay đổi chưa lưu thì lưu trước (một lần bấm "Đăng" là đủ) */
    async function runStatus(action: StatusAction, publishAt?: string) {
        let at = base;
        if (dirty) {
            const saved = await saveNow();
            if (!saved) return;
            at = saved.updatedAt;
        }
        status.mutate({ action, publishAt, expectedUpdatedAt: at });
    }

    async function reloadLatest() {
        const latest = await onReload?.();
        if (latest) {
            resetFrom(latest);
            toast.info('Đã tải bản mới nhất');
        }
    }

    const missing = missingForPublish(draft);
    const recommended = recommendedForPublish(draft);
    const live = post?.status === 'PUBLISHED' && !post.scheduled;
    const neverPublished = !post?.publishedAt || post.scheduled;
    const seoTitle = draft.seoTitle.trim() || draft.title.trim() || 'Tiêu đề bài viết';
    const seoDescription = draft.seoDescription.trim() || draft.excerpt.trim();

    return (
        <>
            {conflict && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" />
                    <span className="flex-1">
                        Có người vừa sửa bài này. Tải bản mới nhất sẽ <strong>bỏ thay đổi của bạn</strong>; nên chép phần đang viết ra
                        chỗ khác trước.
                    </span>
                    <Button variant="outline" onClick={reloadLatest}>
                        <RefreshCw className="size-4" />
                        Tải bản mới nhất
                    </Button>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                {/* Cột chính: tiêu đề, đường dẫn, nội dung */}
                <fieldset disabled={!canManage || busy} className="min-w-0 space-y-4">
                    <div className="space-y-1.5">
                        <Input
                            value={draft.title}
                            onChange={(event) => set('title', event.target.value)}
                            placeholder="Tiêu đề bài viết"
                            className="h-12 text-lg font-semibold"
                            autoFocus={!isEdit}
                            aria-invalid={Boolean(errors.title) || undefined}
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <SlugField name={draft.title} value={draft.slug} onChange={(slug) => set('slug', slug)} isEditing={isEdit} error={errors.slug} />
                    {draft.slug && <p className="-mt-2 text-xs text-muted-foreground">Trên website: {postPath(draft.slug)}</p>}

                    <RichTextEditor
                        value={draft.content}
                        onChange={(html) => set('content', html)}
                        onReady={(normalized) => {
                            // TinyMCE chuẩn hóa HTML lúc mở: lấy bản đó làm mốc để không báo "có thay đổi" oan
                            setSnapshot((current: any) => ({ ...current, content: normalized }));
                            setDraft((current: any) => (current.content === loadedContent.current ? { ...current, content: normalized } : current));
                            loadedContent.current = normalized;
                        }}
                        disabled={!canManage || busy}
                        invalid={Boolean(errors.content)}
                    />
                    {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                </fieldset>

                {/* Cột phụ */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Đăng bài
                                {post && (
                                    <Badge variant={live ? 'default' : 'secondary'}>
                                        {post.scheduled ? 'Hẹn giờ' : POST_STATUS_LABEL[post.status]}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {post?.scheduled && (
                                <p className="flex items-center gap-1.5 text-muted-foreground">
                                    <CalendarClock className="size-4" />
                                    Sẽ lên website lúc {formatDateTimeVn(post.publishedAt)}
                                </p>
                            )}
                            {live && <p className="text-muted-foreground">Đang hiện trên website từ {formatDateTimeVn(post.publishedAt)}</p>}

                            {canManage && (
                                <>
                                    {/* Lưu */}
                                    <Button className="w-full" variant={isEdit ? 'outline' : 'default'} onClick={() => void saveNow()} disabled={busy || (isEdit && !dirty)}>
                                        {save.isPending ? 'Đang lưu...' : isEdit ? (dirty ? 'Lưu thay đổi' : 'Đã lưu') : 'Lưu nháp'}
                                    </Button>
                                    {!isEdit && <p className="text-xs text-muted-foreground">Lưu nháp xong mới đăng hoặc hẹn giờ được.</p>}

                                    {/* Đăng / hẹn giờ */}
                                    {post && post.status !== 'ARCHIVED' && !live && (
                                        <div className="space-y-2 border-t pt-3">
                                            {missing.length > 0 && (
                                                <p className="flex items-start gap-1.5 text-xs text-destructive">
                                                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                                                    Cần có: {missing.join(', ')}
                                                </p>
                                            )}
                                            <Button className="w-full" onClick={() => void runStatus('PUBLISH')} disabled={busy || missing.length > 0}>
                                                {dirty ? 'Lưu và đăng ngay' : 'Đăng ngay'}
                                            </Button>
                                            <div className="flex gap-2">
                                                <Input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} min={toLocalInput(new Date().toISOString())} className="flex-1" />
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        const iso = fromLocalInput(scheduleAt);
                                                        if (!iso || new Date(iso) <= new Date()) {
                                                            toast.error('Chọn giờ đăng trong tương lai');
                                                            return;
                                                        }
                                                        void runStatus('PUBLISH', iso);
                                                    }}
                                                    disabled={busy || missing.length > 0 || !scheduleAt}
                                                >
                                                    Hẹn giờ
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Gỡ / lưu trữ / khôi phục / xóa */}
                                    <div className="flex flex-wrap gap-2 border-t pt-3">
                                        {post?.status === 'PUBLISHED' && (
                                            <Button variant="ghost" size="sm" onClick={() => void runStatus('UNPUBLISH')} disabled={busy}>
                                                {post.scheduled ? 'Hủy hẹn giờ' : 'Gỡ về Nháp'}
                                            </Button>
                                        )}
                                        {post && post.status !== 'ARCHIVED' && (
                                            <Button variant="ghost" size="sm" onClick={() => void runStatus('ARCHIVE')} disabled={busy}>
                                                Lưu trữ
                                            </Button>
                                        )}
                                        {post?.status === 'ARCHIVED' && (
                                            <Button variant="ghost" size="sm" onClick={() => void runStatus('RESTORE')} disabled={busy}>
                                                Khôi phục về Nháp
                                            </Button>
                                        )}
                                        {post && neverPublished && (
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
                                                Xóa bài
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}

                            {recommended.length > 0 && (
                                <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs">
                                    <p className="flex items-center gap-1.5 font-medium">
                                        <Lightbulb className="size-3.5" />
                                        Nên có thêm
                                    </p>
                                    <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                                        {recommended.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {post && (
                                <p className="text-xs text-muted-foreground">
                                    {post.wordCount} chữ · Sửa lần cuối {formatDateTimeVn(post.updatedAt)}
                                    {post.author && ` · Người viết: ${post.author.fullName}`}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <fieldset disabled={!canManage || busy} className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ảnh bìa</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <PostCoverField value={draft.cover} onChange={(cover) => set('cover', cover)} disabled={!canManage || busy} />
                                {errors.coverMediaId && <p className="mt-1 text-xs text-destructive">{errors.coverMediaId}</p>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Phân loại và tóm tắt</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label>Chuyên mục</Label>
                                        <Link href="/bai-viet/chuyen-muc" className="text-xs text-primary hover:underline">
                                            Quản lý chuyên mục
                                        </Link>
                                    </div>
                                    <select value={draft.categoryId} onChange={(event) => set('categoryId', event.target.value)} className={SELECT}>
                                        <option value="">— Chưa phân loại —</option>
                                        {(categories.data ?? []).map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tóm tắt</Label>
                                    <textarea value={draft.excerpt} onChange={(event) => set('excerpt', event.target.value)} rows={3} className={TEXTAREA} placeholder="2–3 câu hiện ở danh sách bài" />
                                    <p className="text-xs text-muted-foreground">{draft.excerpt.trim().length}/500 ký tự</p>
                                    {errors.excerpt && <p className="text-xs text-destructive">{errors.excerpt}</p>}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>SEO</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label>Tiêu đề trên Google</Label>
                                    <Input value={draft.seoTitle} onChange={(event) => set('seoTitle', event.target.value)} placeholder="Bỏ trống thì dùng tiêu đề bài" />
                                    <p className="text-xs text-muted-foreground">{seoTitle.length} ký tự (nên dưới 60)</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Mô tả trên Google</Label>
                                    <textarea value={draft.seoDescription} onChange={(event) => set('seoDescription', event.target.value)} rows={3} className={TEXTAREA} placeholder="Bỏ trống thì dùng phần tóm tắt" />
                                    <p className="text-xs text-muted-foreground">{seoDescription.length} ký tự (nên 120–160)</p>
                                </div>
                                <div className="rounded-lg border bg-background p-3">
                                    <p className="truncate text-xs text-muted-foreground">khoathongminhchinhhang.vn{draft.slug ? postPath(draft.slug) : ''}</p>
                                    <p className="line-clamp-1 text-base text-blue-700 dark:text-blue-400">{seoTitle}</p>
                                    <p className="line-clamp-2 text-xs text-muted-foreground">{seoDescription || 'Chưa có mô tả, Google sẽ tự lấy một đoạn trong bài.'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Sản phẩm trong bài</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <PostProductPicker value={draft.products} onChange={(products) => set('products', products)} disabled={!canManage || busy} />
                                {errors.productIds && <p className="mt-1 text-xs text-destructive">{errors.productIds}</p>}
                            </CardContent>
                        </Card>
                    </fieldset>
                </div>
            </div>

            {post && (
                <ConfirmDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    title="Xóa bài viết"
                    description={
                        <>
                            Xóa hẳn bài <strong>{post.title}</strong>? Thao tác này không hoàn tác được. Ảnh trong bài vẫn còn trong Thư viện
                            ảnh.
                        </>
                    }
                    confirmLabel="Xóa"
                    destructive
                    loading={remove.isPending}
                    onConfirm={() => remove.mutate()}
                />
            )}
        </>
    );
}