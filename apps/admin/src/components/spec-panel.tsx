'use client';

import { useState } from 'react';
import { GripVertical, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { SpecDefinitionCreateSchema, type SpecOption } from '@ktm/shared';
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
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/hooks';

type SpecDataType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';

interface SpecDefinition {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  groupName: string | null;
  dataType: SpecDataType;
  unit: string | null;
  options: SpecOption[] | null;
  isFilterable: boolean;
  isRequired: boolean;
  sortOrder: number;
}

interface SpecShape {
  code: string;
  name: string;
  groupName?: string | null;
  dataType: SpecDataType;
  options?: SpecOption[] | null;
  isRequired: boolean;
}

const DATA_TYPE_LABEL: Record<SpecDataType, string> = {
  TEXT: 'Chữ',
  NUMBER: 'Số',
  BOOLEAN: 'Có / Không',
  SELECT: 'Chọn một',
  MULTI_SELECT: 'Chọn nhiều',
};

const NEEDS_OPTIONS: SpecDataType[] = ['SELECT', 'MULTI_SELECT'];
const SUGGESTED_GROUPS = ['Vận hành', 'Kích thước cửa', 'Chất liệu', 'Kết nối', 'Nguồn điện'];

const EMPTY_FORM = {
  code: '',
  name: '',
  groupName: '',
  dataType: 'TEXT' as SpecDataType,
  unit: '',
  isFilterable: false,
  isRequired: false,
  sortOrder: 0,
  options: [] as SpecOption[],
};

export function SpecPanel({ categoryId, categoryName }: { categoryId: string; categoryName: string }) {
  const { can } = useAuth();
  const canManage = can('catalog.manage');

  const [editing, setEditing] = useState<SpecDefinition | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<SpecDefinition | null>(null);

  const own = useApiQuery<SpecDefinition[]>(
    ['specs', categoryId],
    `/catalog/categories/${categoryId}/specs`,
  );
  const shapes = useApiQuery<SpecShape[]>(
    ['specs', categoryId, 'shapes'],
    `/catalog/categories/${categoryId}/specs/shapes`,
  );

  const ownList = own.data ?? [];
  const ownCodes = new Set(ownList.map((item) => item.code));
  const inherited = (shapes.data ?? []).filter((shape) => !ownCodes.has(shape.code));

  // Gom thông số của danh mục này theo nhóm hiển thị
  const grouped = new Map<string, SpecDefinition[]>();
  for (const spec of ownList) {
    const key = spec.groupName?.trim() || 'Thông số chung';
    grouped.set(key, [...(grouped.get(key) ?? []), spec]);
  }

  const save = useApiMutation<SpecDefinition, typeof EMPTY_FORM>(
    (values) => {
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        dataType: values.dataType,
        isFilterable: values.isFilterable,
        isRequired: values.isRequired,
        sortOrder: values.sortOrder,
      };
      if (values.groupName.trim()) body.groupName = values.groupName.trim();
      if (values.unit.trim()) body.unit = values.unit.trim();
      if (NEEDS_OPTIONS.includes(values.dataType)) body.options = values.options;
      // Mã không đổi được sau khi tạo, vì sản phẩm đang dùng mã đó
      if (!editing) body.code = values.code.trim();

      return editing
        ? { path: `/catalog/categories/specs/${editing.id}`, method: 'PATCH', body }
        : { path: `/catalog/categories/${categoryId}/specs`, method: 'POST', body };
    },
    {
      invalidate: [['specs']],
      onSuccess: () => {
        toast.success(editing ? 'Đã cập nhật thông số' : 'Đã thêm thông số');
        setFormOpen(false);
      },
      onError: (error) => showError(error, setFieldErrors),
    },
  );

  const remove = useApiMutation<void, SpecDefinition>(
    (spec) => ({ path: `/catalog/categories/specs/${spec.id}`, method: 'DELETE' }),
    {
      invalidate: [['specs']],
      onSuccess: () => {
        toast.success('Đã xóa thông số');
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
    setForm({ ...EMPTY_FORM, sortOrder: ownList.length * 10 });
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(spec: SpecDefinition) {
    setEditing(spec);
    setForm({
      code: spec.code,
      name: spec.name,
      groupName: spec.groupName ?? '',
      dataType: spec.dataType,
      unit: spec.unit ?? '',
      isFilterable: spec.isFilterable,
      isRequired: spec.isRequired,
      sortOrder: spec.sortOrder,
      options: spec.options ?? [],
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  function submit() {
    const parsed = SpecDefinitionCreateSchema.safeParse({
      code: editing?.code ?? form.code.trim(),
      name: form.name.trim(),
      ...(form.groupName.trim() ? { groupName: form.groupName.trim() } : {}),
      dataType: form.dataType,
      ...(form.unit.trim() ? { unit: form.unit.trim() } : {}),
      ...(NEEDS_OPTIONS.includes(form.dataType) ? { options: form.options } : {}),
      isFilterable: form.isFilterable,
      isRequired: form.isRequired,
      sortOrder: form.sortOrder,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[issue.path[0] as string] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    save.mutate(form);
  }

  /** Tự tạo mã từ tên khi thêm mới: "Thời lượng pin" -> "thoi_luong_pin" */
  function onNameChange(name: string) {
    const next = { ...form, name };
    if (!editing && !form.code) {
      next.code = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    }
    setForm(next);
  }

  function addOption() {
    setForm({ ...form, options: [...form.options, { value: '', label: '' }] });
  }

  function updateOption(index: number, patch: Partial<SpecOption>) {
    setForm({
      ...form,
      options: form.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    });
  }

  function removeOption(index: number) {
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
  }

  const existingGroups = [...new Set(ownList.map((item) => item.groupName).filter(Boolean))] as string[];
  const groupSuggestions = [...new Set([...existingGroups, ...SUGGESTED_GROUPS])];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Thông số kỹ thuật</h2>
          <p className="text-sm text-muted-foreground">
            Của danh mục <strong>{categoryName}</strong>
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Thêm thông số
          </Button>
        )}
      </div>

      {inherited.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3" />
            Kế thừa từ danh mục cha (sửa ở danh mục gốc)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inherited.map((shape) => (
              <Badge key={shape.code} variant="outline" className="font-normal">
                {shape.name}
                <span className="ml-1 opacity-60">({DATA_TYPE_LABEL[shape.dataType]})</span>
                {shape.isRequired && <span className="ml-1 text-destructive">*</span>}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {own.isPending ? (
        <LoadingRows rows={3} />
      ) : own.isError ? (
        <ErrorState message={own.error.message} />
      ) : ownList.length === 0 ? (
        <EmptyState
          message="Danh mục này chưa có thông số riêng"
          action={canManage ? <Button onClick={openCreate}>Thêm thông số</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([groupName, specs]) => (
            <div key={groupName}>
              {grouped.size > 1 && (
                <p className="mb-1 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {groupName}
                </p>
              )}
              <div className="divide-y rounded-lg border">
                {specs.map((spec) => (
                  <div key={spec.id} className="flex items-start gap-3 p-3">
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{spec.name}</span>
                        {spec.isRequired && <span className="text-destructive">*</span>}
                        <Badge variant="secondary">{DATA_TYPE_LABEL[spec.dataType]}</Badge>
                        {spec.unit && <Badge variant="outline">{spec.unit}</Badge>}
                        {spec.isFilterable && <Badge variant="outline">Bộ lọc</Badge>}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{spec.code}</p>
                      {spec.options && spec.options.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {spec.options.map((option) => option.label).join(' · ')}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-0.5">
                        <Button variant="ghost" onClick={() => openEdit(spec)} aria-label="Sửa">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => setDeleting(spec)} aria-label="Xóa">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa thông số' : 'Thêm thông số'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên thông số *</Label>
              <Input
                value={form.name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Cách mở khóa"
                autoFocus
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Mã thông số *</Label>
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="unlock_methods"
                disabled={editing !== null}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {editing
                  ? 'Mã không đổi được vì sản phẩm đang dùng mã này.'
                  : 'Chữ thường, số và gạch dưới. Dùng trong file Excel và bộ lọc website.'}
              </p>
              {fieldErrors.code && <p className="text-xs text-destructive">{fieldErrors.code}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Nhóm hiển thị</Label>
              <Input
                value={form.groupName}
                onChange={(event) => setForm({ ...form, groupName: event.target.value })}
                placeholder="Vận hành, Kích thước cửa, Chất liệu..."
                list="spec-group-suggestions"
              />
              <datalist id="spec-group-suggestions">
                {groupSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Gom thông số thành bảng như tờ giới thiệu sản phẩm. Bỏ trống thì vào nhóm chung.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kiểu dữ liệu *</Label>
                <select
                  value={form.dataType}
                  onChange={(event) =>
                    setForm({ ...form, dataType: event.target.value as SpecDataType })
                  }
                  disabled={editing !== null}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                >
                  {Object.entries(DATA_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {editing && (
                  <p className="text-xs text-muted-foreground">
                    Đổi kiểu sẽ làm dữ liệu cũ không hợp lệ.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Đơn vị</Label>
                <Input
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  placeholder="mm, tháng, kg"
                  disabled={NEEDS_OPTIONS.includes(form.dataType)}
                />
              </div>
            </div>

            {NEEDS_OPTIONS.includes(form.dataType) && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label>Các giá trị *</Label>
                  <Button variant="ghost" onClick={addOption} className="h-7 px-2 text-xs">
                    <Plus className="size-3" />
                    Thêm giá trị
                  </Button>
                </div>

                {form.options.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Chưa có giá trị nào. Ví dụ: van_tay / Vân tay
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option.value}
                          onChange={(event) => updateOption(index, { value: event.target.value })}
                          placeholder="van_tay"
                          className="font-mono text-xs"
                        />
                        <Input
                          value={option.label}
                          onChange={(event) => updateOption(index, { label: event.target.value })}
                          placeholder="Vân tay"
                        />
                        <Button variant="ghost" onClick={() => removeOption(index)} aria-label="Xóa giá trị">
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Cột trái là mã (dùng trong Excel), cột phải là tên hiển thị cho khách.
                </p>
                {fieldErrors.options && <p className="text-xs text-destructive">{fieldErrors.options}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isRequired}
                  onChange={(event) => setForm({ ...form, isRequired: event.target.checked })}
                  className="size-4"
                />
                Bắt buộc nhập khi tạo sản phẩm
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isFilterable}
                  onChange={(event) => setForm({ ...form, isFilterable: event.target.checked })}
                  className="size-4"
                />
                Dùng làm bộ lọc trên website
              </label>
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
        title="Xóa thông số"
        description={
          <>
            Xóa thông số <strong>{deleting?.name}</strong>? Thông số đang được sản phẩm sử dụng thì
            không xóa được.
          </>
        }
        confirmLabel="Xóa"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

function showError(error: Error, setFieldErrors?: (errors: Record<string, string>) => void) {
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED' && Array.isArray(error.details)) {
    const errors: Record<string, string> = {};
    for (const item of error.details as { field: string; message: string }[]) {
      errors[item.field.split('.')[0] ?? item.field] = item.message;
    }
    setFieldErrors?.(errors);
    toast.error('Dữ liệu chưa hợp lệ');
    return;
  }
  if (error instanceof ApiError && error.code === 'ALREADY_EXISTS') {
    toast.error('Mã thông số này đã tồn tại trong danh mục');
    return;
  }
  if (error instanceof ApiError && error.code === 'IN_USE') {
    const detail = error.details as { products?: number; hint?: string } | undefined;
    toast.error(detail?.hint ?? `Đang có ${detail?.products ?? 0} sản phẩm dùng thông số này`);
    return;
  }
  toast.error(error.message);
}
