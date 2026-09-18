'use client';

import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

export default function Page() {
  return (
    <>
      <PageHeader title="Danh sách sản phẩm" description="Quản lý khóa, phụ kiện, dịch vụ và combo" />
      <EmptyState message="Màn hình này đang được xây dựng." />
    </>
  );
}
