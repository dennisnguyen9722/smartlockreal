'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { PostEditor } from '@/components/post/post-editor';

export default function PostCreatePage() {
    const { can } = useAuth();
    const back = (
        <Link href="/bai-viet">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách
            </Button>
        </Link>
    );

    return (
        <>
            <PageHeader title="Viết bài mới" actions={back} />
            {can('content.manage') ? <PostEditor /> : <EmptyState message="Bạn không có quyền viết bài" />}
        </>
    );
}