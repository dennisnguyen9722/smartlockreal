'use client';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FAQ_GROUPS, FAQ_GROUP_LABEL, type FaqGroupCode, type FaqItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FaqDialog } from '@/components/content/faq-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { RichHtmlView } from '@/components/rich-html-view';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';

type Tab = FaqGroupCode | 'PRODUCT';

export default function FaqPage() {
    return (
        <Suspense fallback={<LoadingRows rows={4} />}>
            <FaqContent />
        </Suspense>
    );
}

function FaqContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { can } = useAuth();
    const canManage = can('content.manage');

    const tabParam = searchParams.get('nhom');
    const tab: Tab = tabParam === 'PRODUCT' || FAQ_GROUPS.some((group) => group === tabParam) ? (tabParam as Tab) : 'MUA_HANG';
    const query = useApiQuery<FaqItem[]>(['faqs'], '/faqs?scope=ALL', { refetchOnMount: 'always' });

    const [editing, setEditing] = useState<{ faq: FaqItem | null; product: { id: string; name: string } | null } | null>(null);
    const [dialogKey, setDialogKey] = useState(0);
    const [deleting, setDeleting] = useState<FaqItem | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const all = query.data ?? [];
    // Tab nhóm: câu hỏi chung; tab Sản phẩm: gom theo từng sản phẩm
    const sections: { key: string; title: string | null; product: { id: string; name: string } | null; items: FaqItem[] }[] =
        tab === 'PRODUCT'
            ? Array.from(
                all
                    .filter((faq) => faq.product)
                    .reduce((map, faq) => {
                        const product = faq.product as { id: string; name: string };
                        const entry = map.get(product.id) ?? { key: product.id, title: product.name, product, items: [] as FaqItem[] };
                        entry.items.push(faq);
                        return map.set(product.id, entry);
                    }, new Map<string, { key: string; title: string; product: { id: string; name: string }; items: FaqItem[] }>())
                    .values(),
            )
            : [{ key: tab, title: null, product: null, items: all.filter((faq) => !faq.product && faq.groupCode === tab) }];

    function openDialog(faq: FaqItem | null, product: { id: string; name: string } | null = null) {
        setDialogKey((key) => key + 1);
        setEditing({ faq, product });
    }

    const onError = (error: Error) => {
        if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
            toast.error('Danh sách vừa được người khác thay đổi, đã tải lại');
            void queryClient.invalidateQueries({ queryKey: ['faqs'] });
            return;
        }
        toast.error(errorText(error));
    };

    const reorder = useApiMutation<FaqItem[], { groupCode?: FaqGroupCode; productId?: string; ids: string[] }>(
        (body) => ({ path: '/faqs/reorder', method: 'POST', body }),
        { invalidate: [['faqs']], onError },
    );
    const toggle = useApiMutation<FaqItem, FaqItem>(
        (faq) => ({ path: `/faqs/${faq.id}`, method: 'PATCH', body: { isPublished: !faq.isPublished, expectedUpdatedAt: faq.updatedAt } }),
        { invalidate: [['faqs']], onError },
    );
    const remove = useApiMutation<void, string>((id) => ({ path: `/faqs/${id}`, method: 'DELETE' }), {
        invalidate: [['faqs']],
        onSuccess: () => {
            setDeleting(null);
            toast.success('Đã xóa câu hỏi');
        },
        onError: (error) => {
            setDeleting(null);
            toast.error(errorText(error));
        },
    });

    function move(items: FaqItem[], index: number, offset: number, product: { id: string } | null) {
        const target = index + offset;
        if (target < 0 || target >= items.length) return;
        const ids = items.map((faq) => faq.id);
        [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
        reorder.mutate(product ? { productId: product.id, ids } : { groupCode: tab as FaqGroupCode, ids });
    }

    const busy = reorder.isPending || toggle.isPending;
    const tabs: { value: Tab; label: string; count: number }[] = [
        ...FAQ_GROUPS.map((group) => ({ value: group as Tab, label: FAQ_GROUP_LABEL[group], count: all.filter((faq) => !faq.product && faq.groupCode === group).length })),
        { value: 'PRODUCT', label: 'Theo sản phẩm', count: all.filter((faq) => faq.product).length },
    ];

    return (
        <>
            <PageHeader
                title="Câu hỏi thường gặp"
                description="Trả lời sẵn những câu khách hay hỏi; Google có thể hiện trực tiếp trên kết quả tìm kiếm."
                actions={
                    canManage ? (
                        <Button onClick={() => openDialog(null)}>
                            <Plus className="size-4" />
                            Thêm câu hỏi
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4 flex gap-1 overflow-x-auto border-b">
                {tabs.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => router.replace(item.value === 'MUA_HANG' ? pathname : `${pathname}?nhom=${item.value}`, { scroll: false })}
                        className={cn(
                            '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                            tab === item.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {item.label}
                        <span className="ml-1.5 text-xs text-muted-foreground">{item.count || ''}</span>
                    </button>
                ))}
            </div>

            {query.isPending ? (
                <LoadingRows rows={4} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : sections.every((section) => section.items.length === 0) ? (
                <EmptyState message={tab === 'PRODUCT' ? 'Chưa có câu hỏi gắn sản phẩm nào' : 'Nhóm này chưa có câu hỏi nào'} />
            ) : (
                <div className="space-y-6">
                    {sections.map((section) => (
                        <div key={section.key} className="space-y-2">
                            {section.title && (
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">{section.title}</h3>
                                    {canManage && (
                                        <Button variant="ghost" size="sm" onClick={() => openDialog(null, section.product)}>
                                            <Plus className="size-4" />
                                            Thêm câu cho sản phẩm này
                                        </Button>
                                    )}
                                </div>
                            )}
                            <div className="divide-y rounded-lg border">
                                {section.items.map((faq, index) => (
                                    <div key={faq.id} className={cn('p-3', !faq.isPublished && 'opacity-60')}>
                                        <div className="flex items-start gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setExpanded(expanded === faq.id ? null : faq.id)}
                                                className="flex flex-1 items-start gap-2 text-left text-sm font-medium"
                                            >
                                                {expanded === faq.id ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />}
                                                <span>{faq.question}</span>
                                            </button>
                                            {!faq.isPublished && <Badge variant="outline">Ẩn</Badge>}
                                            {tab === 'PRODUCT' && <Badge variant="secondary">{FAQ_GROUP_LABEL[faq.groupCode]}</Badge>}
                                            {canManage && (
                                                <div className="flex shrink-0 items-center">
                                                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => move(section.items, index, -1, section.product)} disabled={busy || index === 0} aria-label="Lên">
                                                        <ArrowUp className="size-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => move(section.items, index, 1, section.product)} disabled={busy || index === section.items.length - 1} aria-label="Xuống">
                                                        <ArrowDown className="size-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7" onClick={() => toggle.mutate(faq)} disabled={busy}>
                                                        {faq.isPublished ? 'Ẩn' : 'Hiện'}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => openDialog(faq)} aria-label="Sửa">
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-1.5 text-destructive" onClick={() => setDeleting(faq)} aria-label="Xóa">
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {expanded === faq.id && <RichHtmlView html={faq.answer} className="mt-2 pl-6 text-muted-foreground" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <FaqDialog
                    key={dialogKey}
                    open
                    onOpenChange={(open) => !open && setEditing(null)}
                    faq={editing.faq}
                    defaultGroup={tab === 'PRODUCT' ? 'SU_DUNG' : tab}
                    defaultProduct={editing.product}
                />
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Xóa câu hỏi"
                description={
                    <>
                        Xóa câu hỏi <strong>{deleting?.question}</strong>? Muốn tạm ẩn thì bấm &quot;Ẩn&quot; thay vì xóa.
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