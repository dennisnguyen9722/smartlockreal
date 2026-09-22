'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { PageDetail } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { PageEditor } from '@/components/content/page-editor';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/hooks';

const back = (
    <Link href="/trang">
        <Button variant="outline">
            <ArrowLeft className="size-4" />
            Danh sách
        </Button>
    </Link>
);

export default function StaticPageDetailPage() {
    const { id } = useParams<{ id: string }>();
    // Không tự tải lại khi quay lại tab trình duyệt, tránh đè lên phần đang soạn
    const query = useApiQuery<PageDetail>(['page', id], `/pages/${id}`, { staleTime: Infinity, refetchOnWindowFocus: false });

    if (query.isPending) {
        return (
            <>
                <PageHeader title="Sửa trang" actions={back} />
                <LoadingRows rows={8} />
            </>
        );
    }
    if (query.isError) {
        const notFound = query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Sửa trang" actions={back} />
                {notFound ? <EmptyState message="Không tìm thấy trang này" action={back} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }
    return (
        <>
            <PageHeader title="Sửa trang" actions={back} />
            <PageEditor key={query.data.id} page={query.data} onReload={async () => (await query.refetch()).data} />
        </>
    );
}