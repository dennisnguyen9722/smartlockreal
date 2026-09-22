'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ShowroomCreateSchema, type ShowroomDetail } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ShowroomForm } from '@/components/showroom/showroom-form';
import { ShowroomStatusCard } from '@/components/showroom/showroom-status-card';
import { useApiMutation } from '@/lib/hooks';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';
import { buildShowroomPayload, emptyShowroomDraft, showroomFieldKey, type ShowroomDraft } from '@/lib/showroom-form';

function remapErrors(errors: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, message] of Object.entries(errors)) {
        const field = showroomFieldKey(key);
        if (!result[field]) result[field] = message;
    }
    return result;
}

export default function ShowroomCreatePage() {
    const router = useRouter();
    const { can } = useAuth();
    const [draft, setDraft] = useState<ShowroomDraft>(emptyShowroomDraft);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const create = useApiMutation<ShowroomDetail, Record<string, unknown>>(
        (body) => ({ path: '/showrooms', method: 'POST', body }),
        {
            invalidate: [['showrooms']],
            onSuccess: (created) => {
                toast.success('Đã thêm showroom');
                router.replace(`/showroom/${created.id}`);
            },
            onError: (error) => {
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

    function submit() {
        const { payload, errors: localErrors } = buildShowroomPayload(draft, null);
        const parsed = ShowroomCreateSchema.safeParse(payload);
        const collected = parsed.success ? {} : remapErrors(collectFieldErrors([...parsed.error.issues]));
        const all = { ...collected, ...localErrors };
        if (Object.keys(all).length > 0) {
            setErrors(all);
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }
        setErrors({});
        create.mutate(payload);
    }

    const backButton = (
        <Link href="/showroom">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách
            </Button>
        </Link>
    );

    if (!can('content.manage')) {
        return (
            <>
                <PageHeader title="Thêm showroom" actions={backButton} />
                <EmptyState message="Bạn không có quyền thêm showroom" />
            </>
        );
    }

    return (
        <>
            <PageHeader title="Thêm showroom" actions={backButton} />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <fieldset disabled={create.isPending} className="min-w-0">
                    <ShowroomForm mode="create" value={draft} onChange={setDraft} errors={errors} disabled={create.isPending} />
                </fieldset>
                <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                    <ShowroomStatusCard value={draft} onChange={setDraft} />
                    {errors.isPublic && <p className="text-xs text-destructive">{errors.isPublic}</p>}
                    <Button className="w-full" onClick={submit} disabled={create.isPending}>
                        {create.isPending ? 'Đang lưu...' : 'Thêm showroom'}
                    </Button>
                </div>
            </div>
        </>
    );
}