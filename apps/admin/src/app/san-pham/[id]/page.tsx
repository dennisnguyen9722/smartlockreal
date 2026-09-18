'use client';

import { EmptyState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';

export default function ProductDetailPage() {
  return (
    <>
      <PageHeader title="Chi tiết sản phẩm" description="Thông tin, biến thể và ảnh" />
      <EmptyState message="Trang chi tiết đang được xây dựng." />
    </>
  );
}
