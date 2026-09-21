'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@ktm/ui/components/button';
import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

/** Tạm thời: trang chi tiết đơn làm ở lượt sau. Có sẵn trang để bấm mã đơn không bị 404. */
export default function OrderDetailPage() {
    const back = (
        <Link href="/don-hang">
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Danh sách đơn
            </Button>
        </Link>
    );
    return (
        <>
            <PageHeader title="Chi tiết đơn hàng" actions={back} />
            <EmptyState message="Trang chi tiết đơn đang được xây dựng." action={back} />
        </>
    );
}