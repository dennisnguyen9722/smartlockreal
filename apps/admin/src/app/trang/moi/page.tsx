'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@ktm/ui/components/button';
import { useAuth } from '@/components/auth-provider';
import { PageEditor } from '@/components/content/page-editor';
import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

export default function StaticPageCreatePage() {
    const { can } = useAuth();
    const back = (
        <Link href="/trang">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách
            </Button>
        </Link>
    );
    return (
        <>
            <PageHeader title="Thêm trang" actions={back} />
            {can('content.manage') ? <PageEditor /> : <EmptyState message="Bạn không có quyền thêm trang" />}
        </>
    );
}