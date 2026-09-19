'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ProductCoverCard } from '@/components/product-cover-card';
import { ProductInfoTab } from '@/components/product-info-tab';
import { ProductMediaTab } from '@/components/product-media-tab';
import { ProductStatusCard } from '@/components/product-status-card';
import { ProductVariantsTab } from '@/components/product-variants-tab';
import { ApiError } from '@/lib/api';
import { PRODUCT_TYPE_LABEL } from '@/lib/format';
import { useApiQuery } from '@/lib/hooks';
import type { ProductDetail } from '@/lib/product-types';

const TABS = [
  { key: 'info', label: 'Thông tin' },
  { key: 'variants', label: 'Biến thể' },
  { key: 'media', label: 'Ảnh' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export default function ProductDetailPage() {
  // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <ProductDetailContent />
    </Suspense>
  );
}

function ProductDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const canManage = can('catalog.manage');

  const tabParam = searchParams.get('tab');
  const tab: TabKey = isTabKey(tabParam) ? tabParam : 'info';
  const [infoDirty, setInfoDirty] = useState(false);
  const [variantsDirty, setVariantsDirty] = useState(false);

  const query = useApiQuery<ProductDetail>(['product', id], `/catalog/products/${id}`);

  function selectTab(key: TabKey) {
    // replace: đổi tab không tạo thêm lịch sử, nút Back vẫn về danh sách
    router.replace(key === 'info' ? pathname : `${pathname}?tab=${key}`, { scroll: false });
  }

  const backButton = (
    <Link href="/san-pham">
      <Button variant="outline">
        <ArrowLeft className="size-4" />
        Danh sách
      </Button>
    </Link>
  );

  if (query.isPending) {
    return (
      <>
        <PageHeader title="Chi tiết sản phẩm" actions={backButton} />
        <LoadingRows rows={6} />
      </>
    );
  }

  if (query.isError) {
    const notFound =
      query.error instanceof ApiError &&
      (query.error.code === 'NOT_FOUND' || query.error.code === 'VALIDATION_FAILED');
    return (
      <>
        <PageHeader title="Chi tiết sản phẩm" actions={backButton} />
        {notFound ? (
          <EmptyState message="Không tìm thấy sản phẩm này" action={backButton} />
        ) : (
          <ErrorState message={query.error.message} />
        )}
      </>
    );
  }

  const product = query.data;
  const subtitle = [
    PRODUCT_TYPE_LABEL[product.type] ?? product.type,
    product.brand?.name,
    product.category.name,
    product.manufacturerCode,
  ]
    .filter(Boolean)
    .join(' · ');

  const dirtyByTab: Record<TabKey, boolean> = {
    info: infoDirty,
    variants: variantsDirty,
    media: false,
  };

  return (
    <>
      <PageHeader title={product.name} description={subtitle} actions={backButton} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div role="tablist" className="flex gap-1 border-b">
            {TABS.map((item) => {
              const count =
                item.key === 'variants'
                  ? product.variants.length
                  : item.key === 'media'
                    ? product.media.length
                    : null;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => selectTab(item.key)}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    tab === item.key
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  {count !== null && <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>}
                  {dirtyByTab[item.key] && (
                    <span className="ml-1.5 text-primary" aria-label="Có thay đổi chưa lưu">
                      •
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hai tab có form được giữ trong trang, chỉ ẩn đi, để không mất nội dung đang sửa */}
          <div hidden={tab !== 'info'}>
            <ProductInfoTab
              product={product}
              canManage={canManage}
              onDirtyChange={setInfoDirty}
              onReload={async () => (await query.refetch()).data}
            />
          </div>
          <div hidden={tab !== 'variants'}>
            <ProductVariantsTab
              product={product}
              canManage={canManage}
              onDirtyChange={setVariantsDirty}
            />
          </div>
          {tab === 'media' && <ProductMediaTab product={product} />}
        </div>

        {/* Không dùng sticky: cột phải cao hơn màn hình thì sticky sẽ che mất phần dưới */}
        <aside className="space-y-4 lg:self-start">
          <ProductStatusCard product={product} canManage={canManage} hasUnsavedChanges={infoDirty} />
          <ProductCoverCard product={product} onOpenMediaTab={() => selectTab('media')} />
        </aside>
      </div>
    </>
  );
}