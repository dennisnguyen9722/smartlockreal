'use client';

import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Thêm sản phẩm" description="Tạo sản phẩm kèm biến thể và thông số kỹ thuật" />
      <EmptyState message="Form thêm sản phẩm đang được xây dựng." />
    </>
  );
}
