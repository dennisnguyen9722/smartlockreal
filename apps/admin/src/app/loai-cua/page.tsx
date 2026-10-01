'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DoorTypeRow,
  Paginated,
  ProductDoorTypeBulkInput,
  ProductDoorTypeRow,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ktm/ui/components/dialog';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ktm/ui/components/table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/components/auth-provider';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { errorText } from '@/lib/error-text';

interface NamedRow {
  id: string;
  name: string;
}

const PAGE_SIZE = 50;
const EMPTY_FORM = { name: '', slug: '', description: '', sortOrder: 0, isActive: true };

/** Ô tick dùng thẻ input thật để bàn phím và trình đọc màn hình dùng được */
function TickBox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

export default function DoorTypePage() {
  const { can } = useAuth();
  const canManage = can('catalog.manage');

  // ----- bộ lọc -----
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [doorFilter, setDoorFilter] = useState('');
  const [page, setPage] = useState(1);

  // ----- chọn nhiều dòng -----
  const [selected, setSelected] = useState<string[]>([]);

  // ----- quản lý loại cửa -----
  const [editing, setEditing] = useState<DoorTypeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [removing, setRemoving] = useState<DoorTypeRow | null>(null);

  const doorTypesQuery = useApiQuery<DoorTypeRow[]>(
    ['door-types'],
    '/catalog/door-types?includeInactive=true',
  );
  const categoriesQuery = useApiQuery<Paginated<NamedRow>>(
    ['categories', 'all'],
    '/catalog/categories?pageSize=100',
  );
  const brandsQuery = useApiQuery<Paginated<NamedRow>>(
    ['brands', 'all'],
    '/catalog/brands?pageSize=100',
  );

  const productPath = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    if (brandId) params.set('brandId', brandId);
    if (doorFilter) params.set('doorTypeId', doorFilter);
    return `/catalog/door-types/products?${params.toString()}`;
  }, [page, search, categoryId, brandId, doorFilter]);

  const productsQuery = useApiQuery<Paginated<ProductDoorTypeRow>>(
    ['door-type-products', page, search, categoryId, brandId, doorFilter],
    productPath,
  );

  // Giữ bản sao cục bộ để tick xong thấy đổi ngay, không phải chờ tải lại
  const [rows, setRows] = useState<ProductDoorTypeRow[]>([]);
  useEffect(() => {
    if (productsQuery.data) setRows(productsQuery.data.items);
  }, [productsQuery.data]);

  const doorTypes = doorTypesQuery.data ?? [];
  const activeDoorTypes = doorTypes.filter((item) => item.isActive);
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setForProduct = useApiMutation<
    unknown,
    { productId: string; doorTypeIds: string[]; previous: string[] }
  >(
    ({ productId, doorTypeIds }) => ({
      path: `/catalog/door-types/products/${productId}`,
      method: 'PUT',
      body: { doorTypeIds },
    }),
    {
      invalidate: [['door-types']],
      onError: (error, variables) => {
        // Hỏng thì trả lại như cũ, không để màn hình nói dối
        setRows((current) =>
          current.map((row) =>
            row.id === variables.productId ? { ...row, doorTypeIds: variables.previous } : row,
          ),
        );
        toast.error(errorText(error));
      },
    },
  );

  const bulkAssign = useApiMutation<
    { productCount: number; changed: number },
    ProductDoorTypeBulkInput
  >((body) => ({ path: '/catalog/door-types/products/bulk', body }), {
    invalidate: [['door-types'], ['door-type-products']],
    onSuccess: (data) => {
      toast.success(`Đã cập nhật ${data.productCount} sản phẩm`);
      setSelected([]);
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const saveDoorType = useApiMutation<DoorTypeRow, typeof EMPTY_FORM & { id?: string }>(
    ({ id, ...body }) => ({
      path: id ? `/catalog/door-types/${id}` : '/catalog/door-types',
      method: id ? 'PATCH' : 'POST',
      body: {
        name: body.name,
        ...(body.slug ? { slug: body.slug } : {}),
        ...(body.description ? { description: body.description } : {}),
        sortOrder: body.sortOrder,
        ...(id ? { isActive: body.isActive } : {}),
      },
    }),
    {
      invalidate: [['door-types']],
      onSuccess: () => {
        toast.success('Đã lưu loại cửa');
        setEditing(null);
        setCreating(false);
        setForm(EMPTY_FORM);
      },
      onError: (error) => toast.error(errorText(error)),
    },
  );

  const removeDoorType = useApiMutation<void, string>(
    (id) => ({ path: `/catalog/door-types/${id}`, method: 'DELETE' }),
    {
      invalidate: [['door-types']],
      onSuccess: () => {
        toast.success('Đã xóa loại cửa');
        setRemoving(null);
      },
      onError: (error) => {
        toast.error(errorText(error));
        setRemoving(null);
      },
    },
  );

  function toggle(product: ProductDoorTypeRow, doorTypeId: string) {
    const previous = product.doorTypeIds;
    const next = previous.includes(doorTypeId)
      ? previous.filter((id) => id !== doorTypeId)
      : [...previous, doorTypeId];
    setRows((current) =>
      current.map((row) => (row.id === product.id ? { ...row, doorTypeIds: next } : row)),
    );
    setForProduct.mutate({ productId: product.id, doorTypeIds: next, previous });
  }

  function runBulk(mode: ProductDoorTypeBulkInput['mode'], doorTypeId: string) {
    if (selected.length === 0 || !doorTypeId) return;
    bulkAssign.mutate({ productIds: selected, doorTypeIds: [doorTypeId], mode });
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setCategoryId('');
    setBrandId('');
    setDoorFilter('');
    setPage(1);
  }

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loại cửa"
        description="Trục phân loại thứ hai: khóa này lắp được cửa gì. Khách trên website tìm theo loại cửa trước khi tìm theo hãng."
      />

      {/* ---------- Danh sách loại cửa ---------- */}
      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Các loại cửa</h2>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setForm({ ...EMPTY_FORM, sortOrder: doorTypes.length + 1 });
                setCreating(true);
              }}
            >
              <Plus className="size-4" />
              Thêm loại cửa
            </Button>
          )}
        </div>

        {doorTypesQuery.isLoading ? (
          <div className="p-4">
            <LoadingRows rows={3} />
          </div>
        ) : doorTypesQuery.isError ? (
          <ErrorState
            message="Không tải được danh sách loại cửa."
            onRetry={() => void doorTypesQuery.refetch()}
          />
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {doorTypes.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    {!item.isActive && <Badge variant="secondary">Đã tắt</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    /{item.slug} · {item.productCount} sản phẩm
                  </p>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Sửa ${item.name}`}
                      onClick={() => {
                        setEditing(item);
                        setForm({
                          name: item.name,
                          slug: item.slug,
                          description: item.description ?? '',
                          sortOrder: item.sortOrder,
                          isActive: item.isActive,
                        });
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Xóa ${item.name}`}
                      onClick={() => setRemoving(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Gắn loại cửa cho sản phẩm ---------- */}
      <section className="rounded-xl border bg-card">
        <div className="space-y-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Gắn loại cửa cho sản phẩm</h2>

          <div className="flex flex-wrap items-end gap-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput.trim());
                setPage(1);
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="tim" className="text-xs">
                  Tìm sản phẩm
                </Label>
                <Input
                  id="tim"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Tên hoặc mã model"
                  className="w-56"
                />
              </div>
              <Button type="submit" variant="outline" size="icon" aria-label="Tìm">
                <Search className="size-4" />
              </Button>
            </form>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-danh-muc" className="text-xs">
                Danh mục
              </Label>
              <select
                id="loc-danh-muc"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Tất cả</option>
                {(categoriesQuery.data?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-hang" className="text-xs">
                Hãng
              </Label>
              <select
                id="loc-hang"
                value={brandId}
                onChange={(event) => {
                  setBrandId(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Tất cả</option>
                {(brandsQuery.data?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-loai-cua" className="text-xs">
                Trạng thái
              </Label>
              <select
                id="loc-loai-cua"
                value={doorFilter}
                onChange={(event) => {
                  setDoorFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Tất cả sản phẩm</option>
                <option value="CHUA_GAN">Chưa gắn loại cửa nào</option>
                {activeDoorTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    Đang là {item.name}
                  </option>
                ))}
              </select>
            </div>

            {(search || categoryId || brandId || doorFilter) && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="size-4" />
                Bỏ lọc
              </Button>
            )}

            <span className="ml-auto text-sm text-muted-foreground">{total} sản phẩm</span>
          </div>

          {selected.length > 0 && canManage && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">Đã chọn {selected.length} sản phẩm</span>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Bỏ chọn
              </Button>
              <span className="ml-2 text-muted-foreground">Áp dụng cho cả nhóm:</span>
              {activeDoorTypes.map((item) => (
                <span key={item.id} className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkAssign.isPending}
                    onClick={() => runBulk('ADD', item.id)}
                  >
                    + {item.name}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={bulkAssign.isPending}
                    aria-label={`Gỡ ${item.name} khỏi các sản phẩm đã chọn`}
                    onClick={() => runBulk('REMOVE', item.id)}
                  >
                    −
                  </Button>
                </span>
              ))}
            </div>
          )}
        </div>

        {productsQuery.isLoading ? (
          <div className="p-4">
            <LoadingRows rows={8} />
          </div>
        ) : productsQuery.isError ? (
          <ErrorState
            message="Không tải được danh sách sản phẩm."
            onRetry={() => void productsQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState message="Không có sản phẩm nào khớp bộ lọc. Thử bỏ bớt điều kiện hoặc đổi từ khóa." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-sticky">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <TickBox
                      label="Chọn tất cả trong trang"
                      checked={allOnPageSelected}
                      onChange={() =>
                        setSelected((current) =>
                          allOnPageSelected
                            ? current.filter((id) => !rows.some((row) => row.id === id))
                            : [...new Set([...current, ...rows.map((row) => row.id)])],
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Danh mục</TableHead>
                  {activeDoorTypes.map((item) => (
                    <TableHead key={item.id} className="text-center whitespace-nowrap">
                      {item.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <TickBox
                        label={`Chọn ${product.name}`}
                        checked={selected.includes(product.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(product.id)
                              ? current.filter((id) => id !== product.id)
                              : [...current, product.id],
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      {product.brandName && (
                        <div className="text-xs text-muted-foreground">{product.brandName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.categoryName}
                    </TableCell>
                    {activeDoorTypes.map((item) => (
                      <TableCell key={item.id} className="text-center">
                        <TickBox
                          label={`${product.name} lắp được ${item.name}`}
                          checked={product.doorTypeIds.includes(item.id)}
                          disabled={!canManage}
                          onChange={() => toggle(product, item.id)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Thêm / sửa loại cửa ---------- */}
      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (open) return;
          setCreating(false);
          setEditing(null);
          setForm(EMPTY_FORM);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa loại cửa' : 'Thêm loại cửa'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ten-loai-cua">Tên loại cửa</Label>
              <Input
                id="ten-loai-cua"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="vd: Cửa thép vân gỗ"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="duong-dan-loai-cua">Đường dẫn</Label>
              <Input
                id="duong-dan-loai-cua"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="để trống thì tự sinh từ tên"
              />
              <p className="text-xs text-muted-foreground">
                Đổi đường dẫn của loại cửa đã đăng sẽ làm hỏng link cũ trên Google.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mo-ta-loai-cua">Mô tả ngắn</Label>
              <Input
                id="mo-ta-loai-cua"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Hiện ở đầu trang loại cửa, dùng cho SEO"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="thu-tu-loai-cua">Thứ tự hiển thị</Label>
              <Input
                id="thu-tu-loai-cua"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                className="w-28"
              />
            </div>
            {editing && (
              <label htmlFor="hoat-dong-loai-cua" className="flex items-center gap-2 text-sm">
                <input
                  id="hoat-dong-loai-cua"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="size-4 accent-primary"
                />
                <span>
                  Đang hoạt động
                  <span className="block text-xs text-muted-foreground">
                    Tắt thì ẩn khỏi website nhưng link cũ vẫn còn, không thành 404.
                  </span>
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
                setForm(EMPTY_FORM);
              }}
            >
              Hủy
            </Button>
            <Button
              disabled={!form.name.trim() || saveDoorType.isPending}
              onClick={() => saveDoorType.mutate({ ...form, id: editing?.id })}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Xóa loại cửa ${removing?.name ?? ''}?`}
        description={
          <>
            Loại cửa còn sản phẩm thì hệ thống sẽ từ chối xóa. Muốn ẩn khỏi website mà giữ nguyên
            link cũ thì <strong>tắt hoạt động</strong> thay vì xóa.
          </>
        }
        confirmLabel="Xóa"
        destructive
        loading={removeDoorType.isPending}
        onConfirm={() => removing && removeDoorType.mutate(removing.id)}
      />
    </div>
  );
}
