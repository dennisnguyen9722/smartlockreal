'use client';

import type { SpecOption } from '@ktm/shared';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { cn } from '@ktm/ui/lib/utils';

export type SpecDataType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';

export interface SpecShape {
  code: string;
  name: string;
  groupName?: string | null;
  dataType: SpecDataType;
  unit?: string | null;
  options?: SpecOption[] | null;
  isRequired: boolean;
}

const DEFAULT_GROUP = 'Thông số chung';

/**
 * Sinh ô nhập theo khuôn thông số của danh mục, gom theo nhóm hiển thị.
 * Giá trị giữ nguyên dạng người dùng nhập; API chuẩn hóa khi lưu.
 */
export function SpecInputs({
  shapes,
  values,
  onChange,
  errors,
}: {
  shapes: SpecShape[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
}) {
  if (shapes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Danh mục này chưa khai báo thông số kỹ thuật nào.
      </p>
    );
  }

  const set = (code: string, value: unknown) => onChange({ ...values, [code]: value });

  // Gom theo nhóm, giữ nguyên thứ tự xuất hiện
  const groups = new Map<string, SpecShape[]>();
  for (const shape of shapes) {
    const key = shape.groupName?.trim() || DEFAULT_GROUP;
    groups.set(key, [...(groups.get(key) ?? []), shape]);
  }

  function renderField(shape: SpecShape) {
    const value = values[shape.code];
    const error = errors?.[`specs.${shape.code}`];

    return (
      <div
        key={shape.code}
        className={cn('space-y-1.5', shape.dataType === 'MULTI_SELECT' && 'sm:col-span-2')}
      >
        <Label>
          {shape.name}
          {shape.unit && <span className="ml-1 text-muted-foreground">({shape.unit})</span>}
          {shape.isRequired && <span className="ml-1 text-destructive">*</span>}
        </Label>

        {shape.dataType === 'BOOLEAN' ? (
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(event) => set(shape.code, event.target.checked)}
              className="size-4"
            />
            {value === true ? 'Có' : 'Không'}
          </label>
        ) : shape.dataType === 'SELECT' ? (
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => set(shape.code, event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">— Chưa chọn —</option>
            {(shape.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : shape.dataType === 'MULTI_SELECT' ? (
          <div className="flex flex-wrap gap-1.5">
            {(shape.options ?? []).map((option) => {
              const list = Array.isArray(value) ? (value as string[]) : [];
              const checked = list.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    set(
                      shape.code,
                      checked ? list.filter((item) => item !== option.value) : [...list, option.value],
                    )
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : (
          <Input
            type={shape.dataType === 'NUMBER' ? 'number' : 'text'}
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            onChange={(event) =>
              set(
                shape.code,
                shape.dataType === 'NUMBER'
                  ? event.target.value === ''
                    ? ''
                    : Number(event.target.value)
                  : event.target.value,
              )
            }
          />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([groupName, groupShapes]) => (
        <div key={groupName} className="space-y-3">
          {groups.size > 1 && <p className="text-sm font-medium text-muted-foreground">{groupName}</p>}
          <div className="grid gap-4 sm:grid-cols-2">{groupShapes.map((shape) => renderField(shape))}</div>
        </div>
      ))}
    </div>
  );
}
