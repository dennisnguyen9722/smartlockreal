'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    FAQ_GROUPS,
    FAQ_GROUP_LABEL,
    FaqCreateSchema,
    FaqUpdateSchema,
    htmlPlainText,
    type FaqGroupCode,
    type FaqItem,
    type Paginated,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ktm/ui/components/dialog';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { RichTextEditor } from '@/components/post/rich-text-editor';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';
import { useDebounced } from '@/lib/use-debounced';

const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

/** Chọn một sản phẩm (câu hỏi riêng của sản phẩm) */
function ProductSelect({ value, onChange }: { value: { id: string; name: string } | null; onChange: (next: { id: string; name: string } | null) => void }) {
    const [search, setSearch] = useState('');
    const term = useDebounced(search.trim());
    const results = useApiQuery<Paginated<{ id: string; name: string }>>(
        ['products', 'picker', term],
        `/catalog/products?pageSize=6&search=${encodeURIComponent(term)}`,
        { enabled: term.length >= 2 },
    );

    if (value) {
        return (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="flex-1">{value.name}</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onChange(null)} aria-label="Bỏ sản phẩm">
                    <X className="size-4" />
                </Button>
            </div>
        );
    }
    return (
        <div className="space-y-1">
            <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bỏ trống = câu hỏi chung; gõ để tìm sản phẩm" className="pl-9" />
            </div>
            {term.length >= 2 && (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
                    {(results.data?.items ?? []).map((product) => (
                        <li key={product.id}>
                            <button type="button" className="w-full p-2 text-left hover:bg-muted" onClick={() => onChange({ id: product.id, name: product.name })}>
                                {product.name}
                            </button>
                        </li>
                    ))}
                    {results.data && results.data.items.length === 0 && <li className="p-2 text-muted-foreground">Không tìm thấy</li>}
                </ul>
            )}
        </div>
    );
}

/** Thêm/sửa câu hỏi. Mở với faq = null để thêm vào nhóm (hoặc sản phẩm) đang xem */
export function FaqDialog({
    open,
    onOpenChange,
    faq,
    defaultGroup,
    defaultProduct,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    faq: FaqItem | null;
    defaultGroup: FaqGroupCode;
    defaultProduct: { id: string; name: string } | null;
}) {
    const [groupCode, setGroupCode] = useState<FaqGroupCode>(faq?.groupCode ?? defaultGroup);
    const [product, setProduct] = useState(faq ? faq.product : defaultProduct);
    const [question, setQuestion] = useState(faq?.question ?? '');
    const [answer, setAnswer] = useState(faq?.answer ?? '');
    const [isPublished, setIsPublished] = useState(faq?.isPublished ?? true);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const save = useApiMutation<FaqItem, Record<string, unknown>>(
        (body) => (faq ? { path: `/faqs/${faq.id}`, method: 'PATCH', body } : { path: '/faqs', method: 'POST', body }),
        {
            invalidate: [['faqs']],
            onSuccess: () => {
                toast.success(faq ? 'Đã lưu câu hỏi' : 'Đã thêm câu hỏi');
                onOpenChange(false);
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    toast.error('Có người vừa sửa câu hỏi này. Đóng rồi mở lại để xem bản mới nhất.');
                    return;
                }
                const fields = apiFieldErrors(error);
                if (fields) setErrors(fields);
                else toast.error(errorText(error));
            },
        },
    );

    function submit() {
        const body = { groupCode, question: question.trim(), answer, productId: product?.id ?? null, isPublished };
        const parsed = faq ? FaqUpdateSchema.safeParse({ ...body, expectedUpdatedAt: faq.updatedAt }) : FaqCreateSchema.safeParse(body);
        const errs = parsed.success ? {} : collectFieldErrors([...parsed.error.issues]);
        if (!htmlPlainText(answer)) errs.answer = 'Chưa nhập câu trả lời';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        save.mutate(faq ? { ...body, expectedUpdatedAt: faq.updatedAt } : body);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{faq ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</DialogTitle>
                    <DialogDescription>Câu hỏi chung hiện ở trang Câu hỏi thường gặp; câu gắn sản phẩm hiện ở trang sản phẩm đó.</DialogDescription>
                </DialogHeader>
                <fieldset disabled={save.isPending} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Nhóm</Label>
                            <select value={groupCode} onChange={(event) => setGroupCode(event.target.value as FaqGroupCode)} className={SELECT}>
                                {FAQ_GROUPS.map((group) => (
                                    <option key={group} value={group}>
                                        {FAQ_GROUP_LABEL[group]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sản phẩm</Label>
                            <ProductSelect value={product} onChange={setProduct} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Câu hỏi *</Label>
                        <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Khóa vân tay có mở được khi hết pin không?" autoFocus />
                        {errors.question && <p className="text-xs text-destructive">{errors.question}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Câu trả lời *</Label>
                        <RichTextEditor compact value={answer} onChange={setAnswer} invalid={Boolean(errors.answer)} />
                        {errors.answer ? (
                            <p className="text-xs text-destructive">{errors.answer}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">Trả lời ngắn gọn 2–5 câu. Cần giải thích dài thì viết bài và đặt link.</p>
                        )}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} className="size-4" />
                        Hiện trên website
                    </label>
                </fieldset>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                        Hủy
                    </Button>
                    <Button onClick={submit} disabled={save.isPending}>
                        {save.isPending ? 'Đang lưu...' : faq ? 'Lưu' : 'Thêm câu hỏi'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}