'use client';

import { Plus, X } from 'lucide-react';
import { buildOptionKey, slugifyVi } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
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

export interface OptionDraft {
  code: string;
  name: string;
  values: { code: string; value: string }[];
}

export interface VariantDraft {
  /** Khóa nhận dạng trong danh sách, chính là tổ hợp tùy chọn */
  key: string;
  optionValues: Record<string, string>;
  name: string;
  sku: string;
  price: string;
  compareAtPrice: string;
}

/** Tạo mọi tổ hợp có thể từ danh sách tùy chọn */
function buildCombinations(options: OptionDraft[]): Record<string, string>[] {
  if (options.length === 0) return [{}];

  let result: Record<string, string>[] = [{}];
  for (const option of options) {
    const next: Record<string, string>[] = [];
    for (const current of result) {
      for (const value of option.values) {
        if (!value.code) continue;
        next.push({ ...current, [option.code]: value.code });
      }
    }
    result = next;
  }
  return result;
}

export function VariantBuilder({
  options,
  variants,
  onOptionsChange,
  onVariantsChange,
  errors,
}: {
  options: OptionDraft[];
  variants: VariantDraft[];
  onOptionsChange: (options: OptionDraft[]) => void;
  onVariantsChange: (variants: VariantDraft[]) => void;
  errors?: Record<string, string>;
}) {
  /** Sau mỗi thay đổi tùy chọn, tạo lại danh sách biến thể nhưng GIỮ giá đã nhập */
  function syncVariants(nextOptions: OptionDraft[]) {
    const combinations = buildCombinations(
      nextOptions.filter((option) => option.code && option.values.some((value) => value.code)),
    );
    const byKey = new Map(variants.map((variant) => [variant.key, variant]));

    const nextVariants = combinations.map((combination) => {
      const key = buildOptionKey(combination);
      const existing = byKey.get(key);
      if (existing) return existing;

      // Tên biến thể ghép từ nhãn các giá trị đã chọn
      const label = nextOptions
        .map((option) => {
          const picked = combination[option.code];
          return option.values.find((value) => value.code === picked)?.value;
        })
        .filter(Boolean)
        .join(' / ');

      return {
        key,
        optionValues: combination,
        name: label || 'Mặc định',
        sku: '',
        price: '',
        compareAtPrice: '',
      };
    });

    onOptionsChange(nextOptions);
    onVariantsChange(nextVariants);
  }

  function addOption() {
    if (options.length >= 3) return;
    syncVariants([...options, { code: '', name: '', values: [{ code: '', value: '' }] }]);
  }

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    const next = options.map((option, i) => (i === index ? { ...option, ...patch } : option));
    syncVariants(next);
  }

  function removeOption(index: number) {
    syncVariants(options.filter((_, i) => i !== index));
  }

  function updateValue(optionIndex: number, valueIndex: number, label: string) {
    const option = options[optionIndex];
    if (!option) return;
    const values = option.values.map((value, i) =>
      i === valueIndex ? { code: slugifyVi(label) || `gt-${i + 1}`, value: label } : value,
    );
    updateOption(optionIndex, { values });
  }

  function addValue(optionIndex: number) {
    const option = options[optionIndex];
    if (!option) return;
    updateOption(optionIndex, { values: [...option.values, { code: '', value: '' }] });
  }

  function removeValue(optionIndex: number, valueIndex: number) {
    const option = options[optionIndex];
    if (!option) return;
    updateOption(optionIndex, { values: option.values.filter((_, i) => i !== valueIndex) });
  }

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    onVariantsChange(variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
  }

  /** Điền giá của dòng đầu cho mọi dòng còn trống */
  function fillPrices() {
    const first = variants[0];
    if (!first?.price) return;
    onVariantsChange(
      variants.map((variant) => (variant.price ? variant : { ...variant, price: first.price })),
    );
  }

  return (
    <div className="space-y-5">
      {/* Tùy chọn */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Tùy chọn</Label>
            <p className="text-xs text-muted-foreground">
              Ví dụ: Màu (Đen, Vàng đồng). Bỏ qua nếu sản phẩm chỉ có một loại.
            </p>
          </div>
          {options.length < 3 && (
            <Button variant="outline" onClick={addOption}>
              <Plus className="size-4" />
              Thêm tùy chọn
            </Button>
          )}
        </div>

        {options.map((option, optionIndex) => (
          <div key={optionIndex} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={option.name}
                onChange={(event) =>
                  updateOption(optionIndex, {
                    name: event.target.value,
                    code: slugifyVi(event.target.value) || `tuy-chon-${optionIndex + 1}`,
                  })
                }
                placeholder="Tên tùy chọn: Màu"
                className="max-w-56"
              />
              <Button variant="ghost" onClick={() => removeOption(optionIndex)} aria-label="Xóa tùy chọn">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {option.values.map((value, valueIndex) => (
                <div key={valueIndex} className="flex items-center gap-1">
                  <Input
                    value={value.value}
                    onChange={(event) => updateValue(optionIndex, valueIndex, event.target.value)}
                    placeholder="Đen"
                    className="w-36"
                  />
                  {option.values.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => removeValue(optionIndex, valueIndex)}
                      aria-label="Xóa giá trị"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" onClick={() => addValue(optionIndex)} className="h-9 px-2 text-xs">
                <Plus className="size-3" />
                Thêm giá trị
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Biến thể */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Biến thể ({variants.length})
            <span className="ml-1 text-destructive">*</span>
          </Label>
          {variants.length > 1 && (
            <Button variant="ghost" onClick={fillPrices} className="h-7 px-2 text-xs">
              Điền giá dòng đầu cho tất cả
            </Button>
          )}
        </div>

        {errors?.variants && <p className="text-xs text-destructive">{errors.variants}</p>}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">Tên biến thể</TableHead>
                <TableHead className="min-w-44">SKU</TableHead>
                <TableHead className="min-w-36">Giá bán (VND) *</TableHead>
                <TableHead className="min-w-36">Giá gạch ngang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.key}>
                  <TableCell>
                    <Input
                      value={variant.name}
                      onChange={(event) => updateVariant(variant.key, { name: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={variant.sku}
                      onChange={(event) =>
                        updateVariant(variant.key, { sku: event.target.value.toUpperCase() })
                      }
                      placeholder="Tự sinh"
                      className="font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variant.price}
                      onChange={(event) => updateVariant(variant.key, { price: event.target.value })}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variant.compareAtPrice}
                      onChange={(event) =>
                        updateVariant(variant.key, { compareAtPrice: event.target.value })
                      }
                      placeholder="—"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
