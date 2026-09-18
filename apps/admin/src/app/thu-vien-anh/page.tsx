'use client';

import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

export default function Page() {
  return (
    <>
      <PageHeader title="Thư viện ảnh" description="Ảnh dùng cho sản phẩm, bài viết và banner" />
      <EmptyState message="Màn hình này đang được xây dựng." />
    </>
  );
}
