'use client';

import { useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BrandCreateSchema, type Paginated } from '@ktm/shared';
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
import { ApiError } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { SlugField } from '@/components/slug-field';

interface Brand {
  id: string;
  name: string;
  slug: string;
  countryOfOrigin: string | null;
  isAuthorized: boolean;
  authorizationExpiresAt: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { products: number };
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  countryOfOrigin: '',
  isAuthorized: false,
  authorizationExpiresAt: '',
  sortOrder: 0,
};

export default function BrandPage() {
  const { can } = useAuth();
  const canManage = can('catalog.manage');

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Brand | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const listKey = ['brands', { search }] as const;
  const query = useApiQuery<Paginated<Brand>>(
    listKey,
    `/catalog/brands?pageSize=100&includeInactive=true${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    // Trang quản trị: số sản phẩm phải đúng lúc xem, không dùng bản lưu tạm (staleTime 30 giây)
    { refetchOnMount: 'always' },
  );

  const save = useApiMutation<Brand, typeof EMPTY_FORM>(
    (values) => {
      // Bỏ các ô để trống, vì API không nhận chuỗi rỗng
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        isAuthorized: values.isAuthorized,
        sortOrder: values.sortOrder,
      };
      if (values.slug.trim()) body.slug = values.slug.trim();
      if (values.countryOfOrigin.trim()) body.countryOfOrigin = values.countryOfOrigin.trim();
      if (values.authorizationExpiresAt) body.authorizationExpiresAt = values.authorizationExpiresAt;

      return editing
        ? { path: `/catalog/brands/${editing.id}`, method: 'PATCH', body }
        : { path: '/catalog/brands', method: 'POST', body };
    },
    {
      invalidate: [['brands']],
      onSuccess: () => {
        toast.success(editing ? 'Đã cập nhật hãng' : 'Đã thêm hãng');
        setFormOpen(false);
      },
      onError: (error) => showError(error, setFieldErrors),
    },
  );

  const toggleActive = useApiMutation<Brand, Brand>(
    (brand) => ({
      path: `/catalog/brands/${brand.id}`,
      method: 'PATCH',
      body: { isActive: !brand.isActive },
    }),
    {
      invalidate: [['brands']],
      onSuccess: (_, brand) =>
        toast.success(brand.isActive ? 'Đã tắt hoạt động' : 'Đã bật hoạt động'),
      onError: (error) => showError(error),
    },
  );

  const remove = useApiMutation<void, Brand>(
    (brand) => ({ path: `/catalog/brands/${brand.id}`, method: 'DELETE' }),
    {
      invalidate: [['brands']],
      onSuccess: () => {
        toast.success('Đã xóa hãng');
        setDeleting(null);
      },
      onError: (error) => {
        showError(error);
        setDeleting(null);
      },
    },
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setForm({
      name: brand.name,
      slug: brand.slug,
      countryOfOrigin: brand.countryOfOrigin ?? '',
      isAuthorized: brand.isAuthorized,
      authorizationExpiresAt: brand.authorizationExpiresAt?.slice(0, 10) ?? '',
      sortOrder: brand.sortOrder,
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  function submit() {
    // Kiểm tra ngay trên trình duyệt bằng chính schema của API
    const parsed = BrandCreateSchema.safeParse({
      name: form.name.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    save.mutate(form);
  }

  const brands = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Hãng"
        description="Các hãng khóa và giấy ủy quyền phân phối"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Thêm hãng
            </Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hãng..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        {query.data && (
          <span className="text-sm text-muted-foreground">{query.data.total} hãng</span>
        )}
      </div>

      {query.isPending ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : brands.length === 0 ? (
        <EmptyState
          message={search ? 'Không tìm thấy hãng nào' : 'Chưa có hãng nào'}
          action={canManage && !search ? <Button onClick={openCreate}>Thêm hãng đầu tiên</Button> : undefined}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên hãng</TableHead>
                <TableHead>Đường dẫn</TableHead>
                <TableHead>Xuất xứ</TableHead>
                <TableHead className="text-center" title="Tính cả sản phẩm đã lưu trữ">
                  Sản phẩm
                </TableHead>
                <TableHead>Ủy quyền</TableHead>
                <TableHead>Trạng thái</TableHead>
                {canManage && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{brand.slug}</TableCell>
                  <TableCell>{brand.countryOfOrigin ?? '—'}</TableCell>
                  <TableCell className="text-center" title="Tính cả sản phẩm đã lưu trữ">
                    {brand._count.products}
                  </TableCell>
                  <TableCell>
                    {brand.isAuthorized ? (
                      <Badge>Chính hãng</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Chưa có</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => canManage && toggleActive.mutate(brand)}
                      disabled={!canManage}
                      className="disabled:cursor-default"
                    >
                      <Badge variant={brand.isActive ? 'secondary' : 'outline'}>
                        {brand.isActive ? 'Đang bán' : 'Đã tắt'}
                      </Badge>
                    </button>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => openEdit(brand)} aria-label="Sửa">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => setDeleting(brand)} aria-label="Xóa">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form thêm và sửa */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa hãng' : 'Thêm hãng'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Tên hãng *" error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Samsung SDS"
                autoFocus
              />
            </Field>

            <SlugField
              name={form.name}
              value={form.slug}
              onChange={(slug) => setForm({ ...form, slug })}
              isEditing={editing !== null}
              error={fieldErrors.slug}
            />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Xuất xứ">
                <Input
                  value={form.countryOfOrigin}
                  onChange={(event) => setForm({ ...form, countryOfOrigin: event.target.value })}
                  placeholder="Hàn Quốc"
                />
              </Field>
              <Field label="Thứ tự hiển thị">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAuthorized}
                onChange={(event) => setForm({ ...form, isAuthorized: event.target.checked })}
                className="size-4"
              />
              Công ty có giấy ủy quyền phân phối chính hãng
            </label>

            {form.isAuthorized && (
              <Field label="Giấy ủy quyền hết hạn" hint="Hệ thống sẽ nhắc trước khi hết hạn">
                <Input
                  type="date"
                  value={form.authorizationExpiresAt}
                  onChange={(event) => setForm({ ...form, authorizationExpiresAt: event.target.value })}
                />
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa hãng"
        description={
          <>
            Xóa hãng <strong>{deleting?.name}</strong>? Thao tác này không hoàn tác được. Hãng đã có
            sản phẩm thì không xóa được, hãy tắt hoạt động thay thế.
          </>
        }
        confirmLabel="Xóa"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Hiện lỗi từ API; lỗi theo trường thì gán vào form, còn lại thì báo chung */
function showError(error: Error, setFieldErrors?: (errors: Record<string, string>) => void) {
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED' && Array.isArray(error.details)) {
    const errors: Record<string, string> = {};
    for (const item of error.details as { field: string; message: string }[]) {
      errors[item.field] = item.message;
    }
    setFieldErrors?.(errors);
    toast.error('Dữ liệu chưa hợp lệ');
    return;
  }
  if (error instanceof ApiError && error.code === 'IN_USE') {
    toast.error('Hãng đang có sản phẩm nên không xóa được. Hãy tắt hoạt động thay thế.');
    return;
  }
  toast.error(error.message);
}