'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
    POST_STATUS_LABEL,
    PageCreateSchema,
    PageUpdateSchema,
    htmlPlainText,
    pagePath,
    type PageDetail,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { RichTextEditor } from '@/components/post/rich-text-editor';
import { SlugField } from '@/components/slug-field';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

interface Draft {
    title: string;
    slug: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
}

function draftFrom(page?: PageDetail): Draft {
    return {
        title: page?.title ?? '',
        slug: page?.slug ?? '',
        content: page?.content ?? '',
        seoTitle: page?.seoTitle ?? '',
        seoDescription: page?.seoDescription ?? '',
    };
}

function buildPayload(draft: Draft, snapshot: Draft | null): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const changed = (key: keyof Draft) => !snapshot || draft[key] !== snapshot[key];
    const nullable = (value: string) => (value.trim() ? value.trim() : null);
    if (changed('title')) payload.title = draft.title.trim();
    if (changed('slug') && draft.slug.trim()) payload.slug = draft.slug.trim();
    if (changed('content')) payload.content = draft.content;
    if (changed('seoTitle')) payload.seoTitle = nullable(draft.seoTitle);
    if (changed('seoDescription')) payload.seoDescription = nullable(draft.seoDescription);
    return payload;
}

type Action = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE';

/** Soạn trang tĩnh: dùng chung cho tạo mới (page = undefined) và sửa */
export function PageEditor({ page, onReload }: { page?: PageDetail; onReload?: () => Promise<PageDetail | undefined> }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { can } = useAuth();
    const canManage = can('content.manage');
    const isEdit = Boolean(page);

    const [snapshot, setSnapshot] = useState<Draft>(() => draftFrom(page));
    const [draft, setDraft] = useState<Draft>(snapshot);
    const [base, setBase] = useState(page?.updatedAt ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [conflict, setConflict] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const loadedContent = useRef(snapshot.content);

    const payload = useMemo(() => buildPayload(draft, isEdit ? snapshot : null), [draft, snapshot, isEdit]);
    const dirty = isEdit ? Object.keys(payload).length > 0 : Boolean(draft.title.trim() || draft.content);

    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    function resetFrom(next: PageDetail) {
        const fresh = draftFrom(next);
        loadedContent.current = fresh.content;
        setSnapshot(fresh);
        setDraft(fresh);
        setBase(next.updatedAt);
        setErrors({});
        setConflict(false);
    }

    function set<K extends keyof Draft>(key: K, value: Draft[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
    }

    function showError(error: Error) {
        if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
            setConflict(true);
            return;
        }
        const fields = apiFieldErrors(error);
        if (fields) {
            setErrors(fields);
            toast.error(fields.status ?? fields.content ?? 'Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
            return;
        }
        toast.error(errorText(error));
    }

    const save = useApiMutation<PageDetail, Record<string, unknown>>(
        (body) => (page ? { path: `/pages/${page.id}`, method: 'PATCH', body } : { path: '/pages', method: 'POST', body }),
        {
            invalidate: [['pages']],
            onSuccess: (saved) => {
                if (!page) {
                    toast.success('Đã lưu nháp');
                    router.replace(`/trang/${saved.id}`);
                    return;
                }
                resetFrom(saved);
                queryClient.setQueryData(['page', saved.id], saved);
            },
            onError: showError,
        },
    );

    const status = useApiMutation<PageDetail, { action: Action; expectedUpdatedAt: string }>(
        (body) => ({ path: `/pages/${page?.id}/status`, method: 'POST', body }),
        {
            invalidate: [['pages']],
            onSuccess: (saved, variables) => {
                resetFrom(saved);
                queryClient.setQueryData(['page', saved.id], saved);
                const messages: Record<Action, string> = {
                    PUBLISH: 'Đã đăng trang',
                    UNPUBLISH: 'Đã gỡ trang về Nháp',
                    ARCHIVE: 'Đã chuyển vào Lưu trữ',
                    RESTORE: 'Đã khôi phục về Nháp',
                };
                toast.success(messages[variables.action]);
            },
            onError: showError,
        },
    );

    const remove = useApiMutation<void, void>(() => ({ path: `/pages/${page?.id}`, method: 'DELETE' }), {
        invalidate: [['pages']],
        onSuccess: () => {
            toast.success('Đã xóa trang');
            if (page) queryClient.removeQueries({ queryKey: ['page', page.id] });
            router.replace('/trang');
        },
        onError: (error) => {
            setConfirmDelete(false);
            toast.error(errorText(error));
        },
    });

    const busy = save.isPending || status.isPending || remove.isPending;

    async function saveNow(): Promise<PageDetail | undefined> {
        const body = isEdit ? { ...payload, expectedUpdatedAt: base } : payload;
        const parsed = (isEdit ? PageUpdateSchema : PageCreateSchema).safeParse(body);
        if (!parsed.success) {
            setErrors(collectFieldErrors([...parsed.error.issues]));
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return undefined;
        }
        setErrors({});
        try {
            return await save.mutateAsync(body);
        } catch {
            return undefined;
        }
    }

    async function runStatus(action: Action) {
        let at = base;
        if (dirty) {
            const saved = await saveNow();
            if (!saved) return;
            at = saved.updatedAt;
        }
        status.mutate({ action, expectedUpdatedAt: at });
    }

    const missing = [!draft.title.trim() && 'Tiêu đề', !htmlPlainText(draft.content) && 'Nội dung'].filter(Boolean) as string[];
    const seoTitle = draft.seoTitle.trim() || draft.title.trim() || 'Tiêu đề trang';

    return (
        <>
            {conflict && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" />
                    <span className="flex-1">
                        Có người vừa sửa trang này. Tải bản mới nhất sẽ <strong>bỏ thay đổi của bạn</strong>.
                    </span>
                    <Button
                        variant="outline"
                        onClick={async () => {
                            const latest = await onReload?.();
                            if (latest) resetFrom(latest);
                        }}
                    >
                        <RefreshCw className="size-4" />
                        Tải bản mới nhất
                    </Button>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <fieldset disabled={!canManage || busy} className="min-w-0 space-y-4">
                    <div className="space-y-1.5">
                        <Input value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Tiêu đề trang, vd: Giới thiệu" className="h-12 text-lg font-semibold" autoFocus={!isEdit} />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <SlugField name={draft.title} value={draft.slug} onChange={(slug) => set('slug', slug)} isEditing={isEdit} error={errors.slug} />
                    {draft.slug && <p className="-mt-2 text-xs text-muted-foreground">Trên website: {pagePath(draft.slug)}</p>}
                    <RichTextEditor
                        value={draft.content}
                        onChange={(html) => set('content', html)}
                        onReady={(normalized) => {
                            setSnapshot((current) => ({ ...current, content: normalized }));
                            setDraft((current) => (current.content === loadedContent.current ? { ...current, content: normalized } : current));
                            loadedContent.current = normalized;
                        }}
                        disabled={!canManage || busy}
                        invalid={Boolean(errors.content)}
                    />
                    {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                </fieldset>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Đăng trang
                                {page && <Badge variant={page.status === 'PUBLISHED' ? 'default' : 'secondary'}>{POST_STATUS_LABEL[page.status]}</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {page?.status === 'PUBLISHED' && <p className="text-muted-foreground">Đang hiện trên website từ {formatDateTimeVn(page.publishedAt)}</p>}
                            {canManage && (
                                <>
                                    <Button className="w-full" variant={isEdit ? 'outline' : 'default'} onClick={() => void saveNow()} disabled={busy || (isEdit && !dirty)}>
                                        {save.isPending ? 'Đang lưu...' : isEdit ? (dirty ? 'Lưu thay đổi' : 'Đã lưu') : 'Lưu nháp'}
                                    </Button>
                                    {page && page.status === 'DRAFT' && (
                                        <div className="space-y-2 border-t pt-3">
                                            {missing.length > 0 && (
                                                <p className="flex items-start gap-1.5 text-xs text-destructive">
                                                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                                                    Cần có: {missing.join(', ')}
                                                </p>
                                            )}
                                            <Button className="w-full" onClick={() => void runStatus('PUBLISH')} disabled={busy || missing.length > 0}>
                                                {dirty ? 'Lưu và đăng' : 'Đăng lên website'}
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 border-t pt-3">
                                        {page?.status === 'PUBLISHED' && (
                                            <Button variant="ghost" size="sm" onClick={() => void runStatus('UNPUBLISH')} disabled={busy}>
                                                Gỡ về Nháp
                                            </Button>
                                        )}
                                        {page && page.status !== 'ARCHIVED' && (
                                            <Button variant="ghost" size="sm" onClick={() => void runStatus('ARCHIVE')} disabled={busy}>
                                                Lưu trữ
                                            </Button>
                                        )}
                                        {page?.status === 'ARCHIVED' && (
                                            <Button variant="ghost" size="sm" onClick={() => void runStatus('RESTORE')} disabled={busy}>
                                                Khôi phục về Nháp
                                            </Button>
                                        )}
                                        {page && !page.publishedAt && (
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
                                                Xóa trang
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                            {page && (
                                <p className="text-xs text-muted-foreground">
                                    {page.wordCount} chữ · Sửa lần cuối {formatDateTimeVn(page.updatedAt)}
                                    {page.updatedBy && ` · ${page.updatedBy.fullName}`}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <fieldset disabled={!canManage || busy}>
                        <Card>
                            <CardHeader>
                                <CardTitle>SEO</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label>Tiêu đề trên Google</Label>
                                    <Input value={draft.seoTitle} onChange={(event) => set('seoTitle', event.target.value)} placeholder="Bỏ trống thì dùng tiêu đề trang" />
                                    <p className="text-xs text-muted-foreground">{seoTitle.length} ký tự (nên dưới 60)</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Mô tả trên Google</Label>
                                    <textarea value={draft.seoDescription} onChange={(event) => set('seoDescription', event.target.value)} rows={3} className={TEXTAREA} />
                                    <p className="text-xs text-muted-foreground">{draft.seoDescription.trim().length} ký tự (nên 120–160)</p>
                                </div>
                                <div className="rounded-lg border bg-background p-3">
                                    <p className="truncate text-xs text-muted-foreground">khoathongminhchinhhang.vn{draft.slug ? pagePath(draft.slug) : ''}</p>
                                    <p className="line-clamp-1 text-base text-blue-700 dark:text-blue-400">{seoTitle}</p>
                                    <p className="line-clamp-2 text-xs text-muted-foreground">{draft.seoDescription.trim() || 'Chưa có mô tả, Google sẽ tự lấy một đoạn trong trang.'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </fieldset>
                </div>
            </div>

            {page && (
                <ConfirmDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    title="Xóa trang"
                    description={<>Xóa hẳn trang <strong>{page.title}</strong>? Thao tác này không hoàn tác được.</>}
                    confirmLabel="Xóa"
                    destructive
                    loading={remove.isPending}
                    onConfirm={() => remove.mutate()}
                />
            )}
        </>
    );
}