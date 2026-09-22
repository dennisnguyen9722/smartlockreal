'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { PostDetail } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { PostEditor } from '@/components/post/post-editor';
import { ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/hooks';

const back = (
    <Link href="/bai-viet">
        <Button variant="outline">
            <ArrowLeft className="size-4" />
            Danh sách
        </Button>
    </Link>
);

export default function PostDetailPage() {
    const { id } = useParams<{ id: string }>();
    // staleTime Infinity: không tự tải lại khi quay lại tab trình duyệt, tránh đè lên bài đang viết
    const query = useApiQuery<PostDetail>(['post', id], `/posts/${id}`, { staleTime: Infinity, refetchOnWindowFocus: false });

    if (query.isPending) {
        return (
            <>
                <PageHeader title="Sửa bài viết" actions={back} />
                <LoadingRows rows={8} />
            </>
        );
    }
    if (query.isError) {
        const notFound = query.error instanceof ApiError && (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
        return (
            <>
                <PageHeader title="Sửa bài viết" actions={back} />
                {notFound ? <EmptyState message="Không tìm thấy bài viết này" action={back} /> : <ErrorState message={query.error.message} />}
            </>
        );
    }

    return (
        <>
            <PageHeader title="Sửa bài viết" actions={back} />
            {/* key theo id: chuyển sang bài khác thì tạo lại form từ đầu */}
            <PostEditor key={query.data.id} post={query.data} onReload={async () => (await query.refetch()).data} />
        </>
    );
}