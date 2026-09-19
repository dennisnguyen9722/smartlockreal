'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Filter, ImageIcon, Plus, Search, X } from 'lucide-react';
import { imageUrl, type Paginated } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ktm/ui/components/table';
import { cn } from '@ktm/ui/lib/utils';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { ProductBulkActions } from '@/components/product-bulk-actions';
import { Pagination } from '@/components/pagination';
import { useAuth } from '@/components/auth-provider';
import { useApiQuery } from '@/lib/hooks';
import { useDebounced } from '@/lib/use-debounced';
import { PRODUCT_STATUS_LABEL, PRODUCT_TYPE_LABEL, priceRange } from '@/lib/format';

interface ProductVariantSummary {
  id: string;
  sku: string;
  name: string;
  price: number;
  isActive: boolean;
}

interface ProductListItem {
  id: string;
  type: string;
  status: string;
  name: string;
  slug: string;
  manufacturerCode: string | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string };
  variants: ProductVariantSummary[];
  /** Tối đa một phần tử: ảnh đại diện */
  media: { url: string }[];
}

interface BrandOption {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryOption[];
}

const PAGE_SIZE = 20;

export default function ProductListPage() {
  const { can } = useAuth();
  const canManage = can('catalog.manage');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Sản phẩm đang được tick chọn (giữ khi chuyển trang, bỏ khi đổi bộ lọc)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [search, type, status, brandId, categoryId]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Đổi bộ lọc thì quay về trang 1
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (brandId) params.set('brandId', brandId);
  if (categoryId) params.set('categoryId', categoryId);

  const query = useApiQuery<Paginated<ProductListItem>>(
    ['products', { page, search, type, status, brandId, categoryId }],
    `/catalog/products?${params.toString()}`,
    // Giữ dữ liệu cũ khi đổi trang, tránh bảng nhấp nháy
    { placeholderData: (previous) => previous },
  );

  const brands = useApiQuery<Paginated<BrandOption>>(
    ['brands', 'options'],
    '/catalog/brands?pageSize=100',
  );
  const categories = useApiQuery<CategoryOption[]>(['categories', 'tree'], '/catalog/categories/tree');

  const flatCategories: { id: string; name: string; depth: number }[] = [];
  const walkCategories = (nodes: CategoryOption[], depth: number) => {
    for (const node of nodes) {
      flatCategories.push({ id: node.id, name: node.name, depth });
      walkCategories(node.children, depth + 1);
    }
  };
  walkCategories(categories.data ?? [], 0);

  const hasFilter = Boolean(search || type || status || brandId || categoryId);
  const products = query.data?.items ?? [];

  function clearFilters() {
    setSearchInput('');
    setType('');
    setStatus('');
    setBrandId('');
    setCategoryId('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Danh sách sản phẩm"
        description="Khóa, phụ kiện, dịch vụ lắp đặt và combo"
        actions={
          canManage && (
            <>
              <Link href="/san-pham/nhap-excel">
                <Button variant="outline">
                  <FileSpreadsheet className="size-4" />
                  Nhập Excel
                </Button>
              </Link>
              <Link href="/san-pham/moi">
                <Button>
                  <Plus className="size-4" />
                  Thêm sản phẩm
                </Button>
              </Link>
            </>
          )
        }
      />

      {/* Bộ lọc */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã model hoặc SKU..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 shrink-0 text-muted-foreground" />

          <FilterSelect
            value={type}
            onChange={(value) => updateFilter(setType, value)}
            placeholder="Mọi loại"
            options={Object.entries(PRODUCT_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />

          <FilterSelect
            value={status}
            onChange={(value) => updateFilter(setStatus, value)}
            placeholder="Mọi trạng thái"
            options={Object.entries(PRODUCT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          />

          <FilterSelect
            value={brandId}
            onChange={(value) => updateFilter(setBrandId, value)}
            placeholder="Mọi hãng"
            options={(brands.data?.items ?? []).map((brand) => ({ value: brand.id, label: brand.name }))}
          />

          <FilterSelect
            value={categoryId}
            onChange={(value) => updateFilter(setCategoryId, value)}
            placeholder="Mọi danh mục"
            options={flatCategories.map((category) => ({
              value: category.id,
              label: `${'\u00A0\u00A0'.repeat(category.depth)}${category.depth > 0 ? '└ ' : ''}${category.name}`,
            }))}
          />

          {hasFilter && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="size-4" />
              Xóa lọc
            </Button>
          )}
        </div>
      </div>

      {query.isPending ? (
        <LoadingRows rows={6} />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : products.length === 0 ? (
        <EmptyState
          message={hasFilter ? 'Không tìm thấy sản phẩm nào khớp bộ lọc' : 'Chưa có sản phẩm nào'}
          action={
            hasFilter ? (
              <Button variant="outline" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            ) : canManage ? (
              <Link href="/san-pham/moi">
                <Button>Thêm sản phẩm đầu tiên</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {canManage && (
            <ProductBulkActions selectedIds={[...selected]} onClear={() => setSelected(new Set())} />
          )}
          <div className={cn('overflow-hidden rounded-lg border', query.isFetching && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Chọn mọi sản phẩm trong trang"
                        className="size-4"
                        checked={products.length > 0 && products.every((product) => selected.has(product.id))}
                        ref={(element) => {
                          // Trạng thái "chọn một phần" khi chỉ tick vài dòng trong trang
                          if (element) {
                            const some = products.some((product) => selected.has(product.id));
                            const all = products.every((product) => selected.has(product.id));
                            element.indeterminate = some && !all;
                          }
                        }}
                        onChange={(event) => {
                          for (const product of products) toggle(product.id, event.target.checked);
                        }}
                      />
                    </TableHead>
                  )}
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Hãng</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead className="text-center">Biến thể</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className={cn(selected.has(product.id) && 'bg-primary/5')}>
                    {canManage && (
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${product.name}`}
                          className="size-4"
                          checked={selected.has(product.id)}
                          onChange={(event) => toggle(product.id, event.target.checked)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Link href={`/san-pham/${product.id}`} className="group flex items-center gap-3">
                        {product.media[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                          <img
                            src={imageUrl(product.media[0].url, 'sm')}
                            alt=""
                            loading="lazy"
                            className="size-12 shrink-0 rounded border bg-muted object-contain"
                          />
                        ) : (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded border border-dashed">
                            <ImageIcon className="size-4 text-muted-foreground" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-medium group-hover:underline">{product.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {product.manufacturerCode ?? product.slug}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{PRODUCT_TYPE_LABEL[product.type] ?? product.type}</Badge>
                    </TableCell>
                    <TableCell>{product.brand?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{product.category.name}</TableCell>
                    <TableCell className="text-center">{product.variants.length}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {priceRange(product.variants.map((variant) => variant.price))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.status === 'ACTIVE'
                            ? 'default'
                            : product.status === 'DRAFT'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {PRODUCT_STATUS_LABEL[product.status] ?? product.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={query.data?.total ?? 0}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 rounded-md border border-input bg-transparent px-3 text-sm',
        value && 'border-primary font-medium',
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}