'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryCreateSchema } from '@ktm/shared';
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
import { cn } from '@ktm/ui/lib/utils';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { SlugField } from '@/components/slug-field';
import { SpecPanel } from '@/components/spec-panel';

interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { products: number };
  children: CategoryNode[];
}

const MAX_DEPTH = 3;
const EMPTY_FORM = { name: '', slug: '', parentId: '', sortOrder: 0 };

export default function CategoryPage() {
  const { can } = useAuth();
  const canManage = can('catalog.manage');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<CategoryNode | null>(null);

  const [selected, setSelected] = useState<CategoryNode | null>(null);

  const query = useApiQuery<CategoryNode[]>(
    ['categories', 'tree'],
    '/catalog/categories/tree?includeInactive=true',
  );

  const tree = query.data ?? [];

  /** Danh sách phẳng để chọn danh mục cha, kèm độ sâu để thụt lề */
  const flatList = useMemo(() => {
    const result: { node: CategoryNode; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
      for (const node of nodes) {
        result.push({ node, depth });
        walk(node.children, depth + 1);
      }
    };
    walk(tree, 0);
    return result;
  }, [tree]);

  /** Khi sửa: không cho chọn chính nó hoặc con cháu của nó làm cha */
  const forbiddenParents = useMemo(() => {
    if (!editing) return new Set<string>();
    const ids = new Set<string>([editing.id]);
    const collect = (node: CategoryNode) => {
      for (const child of node.children) {
        ids.add(child.id);
        collect(child);
      }
    };
    collect(editing);
    return ids;
  }, [editing]);

  const save = useApiMutation<CategoryNode, typeof EMPTY_FORM>(
    (values) => {
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        sortOrder: values.sortOrder,
      };
      if (values.slug.trim()) body.slug = values.slug.trim();
      // Sửa: gửi null để chuyển thành danh mục gốc. Tạo mới: bỏ qua nếu trống.
      if (editing) body.parentId = values.parentId || null;
      else if (values.parentId) body.parentId = values.parentId;

      return editing
        ? { path: `/catalog/categories/${editing.id}`, method: 'PATCH', body }
        : { path: '/catalog/categories', method: 'POST', body };
    },
    {
      invalidate: [['categories']],
      onSuccess: () => {
        toast.success(editing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
        setFormOpen(false);
      },
      onError: (error) => showError(error, setFieldErrors),
    },
  );

  const toggleActive = useApiMutation<CategoryNode, CategoryNode>(
    (node) => ({
      path: `/catalog/categories/${node.id}`,
      method: 'PATCH',
      body: { isActive: !node.isActive },
    }),
    { invalidate: [['categories']], onError: (error) => showError(error) },
  );

  const remove = useApiMutation<void, CategoryNode>(
    (node) => ({ path: `/catalog/categories/${node.id}`, method: 'DELETE' }),
    {
      invalidate: [['categories']],
      onSuccess: () => {
        toast.success('Đã xóa danh mục');
        setDeleting(null);
      },
      onError: (error) => {
        showError(error);
        setDeleting(null);
      },
    },
  );

  function openCreate(parent?: CategoryNode) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId: parent?.id ?? '' });
    setFieldErrors({});
    setFormOpen(true);
    if (parent) setExpanded((prev) => new Set(prev).add(parent.id));
  }

  function openEdit(node: CategoryNode) {
    setEditing(node);
    setForm({
      name: node.name,
      slug: node.slug,
      parentId: node.parentId ?? '',
      sortOrder: node.sortOrder,
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  function submit() {
    const parsed = CategoryCreateSchema.safeParse({
      name: form.name.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[issue.path.join('.')] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    save.mutate(form);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: CategoryNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);

    return (
      <div key={node.id}>
        <div
          onClick={() => setSelected(node)}
          className={cn(
            'flex cursor-pointer items-center gap-2 border-b py-2.5 pr-3 transition-colors',
            selected?.id === node.id ? 'bg-primary/10' : 'hover:bg-muted/50',
          )}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={cn('shrink-0 rounded p-0.5', hasChildren ? 'hover:bg-muted' : 'invisible')}
            aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('font-medium', !node.isActive && 'text-muted-foreground')}>
                {node.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{node.slug}</span>
              {node._count.products > 0 && (
                <Badge variant="outline">{node._count.products} sản phẩm</Badge>
              )}
              {!node.isActive && <Badge variant="outline">Đã tắt</Badge>}
            </div>
          </div>

          {canManage && (
            <div className="flex shrink-0 items-center gap-0.5">
              {depth < MAX_DEPTH - 1 && (
                <Button variant="ghost" onClick={() => openCreate(node)} aria-label="Thêm danh mục con">
                  <Plus className="size-4" />
                </Button>
              )}
              <Button variant="ghost" onClick={() => toggleActive.mutate(node)} aria-label="Bật tắt">
                <Settings2 className="size-4" />
              </Button>
              <Button variant="ghost" onClick={() => openEdit(node)} aria-label="Sửa">
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(node)} aria-label="Xóa">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Danh mục"
        description="Cây danh mục tối đa 3 cấp. Sản phẩm kế thừa thông số kỹ thuật từ danh mục cha."
        actions={
          canManage && (
            <Button onClick={() => openCreate()}>
              <Plus className="size-4" />
              Thêm danh mục
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          {query.isPending ? (
            <LoadingRows />
          ) : query.isError ? (
            <ErrorState message={query.error.message} />
          ) : tree.length === 0 ? (
            <EmptyState
              message="Chưa có danh mục nào"
              action={
                canManage ? <Button onClick={() => openCreate()}>Thêm danh mục đầu tiên</Button> : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{flatList.length} danh mục</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => setExpanded(new Set(flatList.map((item) => item.node.id)))}
                  >
                    Mở tất cả
                  </Button>
                  <Button variant="ghost" onClick={() => setExpanded(new Set())}>
                    Thu gọn
                  </Button>
                </div>
              </div>
              {tree.map((node) => renderNode(node, 0))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {selected ? (
            <SpecPanel key={selected.id} categoryId={selected.id} categoryName={selected.name} />
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bấm vào một danh mục để xem và quản lý thông số kỹ thuật của nó.
            </div>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Tên danh mục *" error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Khóa cửa chính"
                autoFocus
              />
            </Field>

            <Field
              label="Danh mục cha"
              hint={
                editing
                  ? 'Không thể chọn chính nó hoặc danh mục con của nó'
                  : 'Bỏ trống để tạo danh mục gốc'
              }
            >
              <select
                value={form.parentId}
                onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— Danh mục gốc —</option>
                {flatList
                  .filter((item) => !forbiddenParents.has(item.node.id) && item.depth < MAX_DEPTH - 1)
                  .map((item) => (
                    <option key={item.node.id} value={item.node.id}>
                      {'\u00A0\u00A0'.repeat(item.depth)}
                      {item.depth > 0 ? '└ ' : ''}
                      {item.node.name}
                    </option>
                  ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <SlugField
                name={form.name}
                value={form.slug}
                onChange={(slug) => setForm({ ...form, slug })}
                isEditing={editing !== null}
                error={fieldErrors.slug}
              />
              <Field label="Thứ tự hiển thị">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })}
                />
              </Field>
            </div>
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
        title="Xóa danh mục"
        description={
          <>
            Xóa danh mục <strong>{deleting?.name}</strong>? Danh mục còn sản phẩm hoặc còn danh mục con
            thì không xóa được, hãy tắt hoạt động thay thế.
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

function showError(error: Error, setFieldErrors?: (errors: Record<string, string>) => void) {
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
    if (Array.isArray(error.details)) {
      const errors: Record<string, string> = {};
      for (const item of error.details as { field: string; message: string }[]) {
        errors[item.field] = item.message;
      }
      setFieldErrors?.(errors);
      toast.error('Dữ liệu chưa hợp lệ');
      return;
    }
    // Lỗi từ kiểm tra nghiệp vụ (vòng lặp, quá 3 cấp) trả về một đối tượng
    const detail = error.details as { message?: string } | undefined;
    toast.error(detail?.message ?? error.message);
    return;
  }
  if (error instanceof ApiError && error.code === 'IN_USE') {
    const detail = error.details as { products?: number; children?: number } | undefined;
    toast.error(
      `Không xóa được: còn ${detail?.products ?? 0} sản phẩm và ${detail?.children ?? 0} danh mục con.`,
    );
    return;
  }
  toast.error(error.message);
}
