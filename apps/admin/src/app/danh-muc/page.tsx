'use client';

import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

export default function Page() {
  return (
    <>
      <PageHeader title="Danh mục" description="Cây danh mục và thông số kỹ thuật theo từng loại" />
      <EmptyState message="Màn hình này đang được xây dựng." />
    </>
  );
}
