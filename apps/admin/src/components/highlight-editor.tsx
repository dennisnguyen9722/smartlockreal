'use client';

import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import type { HighlightGroup } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';

const SUGGESTED_TITLES = ['Tính năng', 'Tính năng đặc biệt', 'Vận hành', 'Lưu ý khi lắp đặt'];

/**
 * Soạn danh sách điểm nổi bật theo nhóm, hiển thị trên website thành bảng.
 * Khác thông số kỹ thuật: nội dung tự do, mỗi sản phẩm một kiểu, không dùng để lọc.
 */
export function HighlightEditor({
  value,
  onChange,
  error,
}: {
  value: HighlightGroup[];
  onChange: (value: HighlightGroup[]) => void;
  error?: string;
}) {
  function updateGroup(index: number, patch: Partial<HighlightGroup>) {
    onChange(value.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  }

  function addGroup() {
    const used = new Set(value.map((group) => group.title));
    const suggestion = SUGGESTED_TITLES.find((title) => !used.has(title)) ?? '';
    onChange([...value, { title: suggestion, items: [''] }]);
  }

  function moveGroup(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const current = next[index];
    const swap = next[target];
    if (!current || !swap) return;
    next[index] = swap;
    next[target] = current;
    onChange(next);
  }

  function updateItem(groupIndex: number, itemIndex: number, text: string) {
    const group = value[groupIndex];
    if (!group) return;
    updateGroup(groupIndex, {
      items: group.items.map((item, i) => (i === itemIndex ? text : item)),
    });
  }

  function addItem(groupIndex: number) {
    const group = value[groupIndex];
    if (!group) return;
    updateGroup(groupIndex, { items: [...group.items, ''] });
  }

  function removeItem(groupIndex: number, itemIndex: number) {
    const group = value[groupIndex];
    if (!group) return;
    updateGroup(groupIndex, { items: group.items.filter((_, i) => i !== itemIndex) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label>Điểm nổi bật</Label>
          <p className="text-xs text-muted-foreground">
            Danh sách gạch đầu dòng theo nhóm, hiển thị thành bảng trên trang sản phẩm.
          </p>
        </div>
        {value.length < 10 && (
          <Button variant="outline" onClick={addGroup}>
            <Plus className="size-4" />
            Thêm nhóm
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Chưa có nhóm nào. Ví dụ: &quot;Tính năng&quot; với các dòng mô tả cách mở khóa, camera, cảnh báo.
        </p>
      ) : (
        value.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={group.title}
                onChange={(event) => updateGroup(groupIndex, { title: event.target.value })}
                placeholder="Tên nhóm: Tính năng"
                className="max-w-64 font-medium"
                list={`highlight-titles-${groupIndex}`}
              />
              <datalist id={`highlight-titles-${groupIndex}`}>
                {SUGGESTED_TITLES.map((title) => (
                  <option key={title} value={title} />
                ))}
              </datalist>

              <div className="ml-auto flex gap-0.5">
                <Button
                  variant="ghost"
                  onClick={() => moveGroup(groupIndex, -1)}
                  disabled={groupIndex === 0}
                  aria-label="Chuyển lên"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => moveGroup(groupIndex, 1)}
                  disabled={groupIndex === value.length - 1}
                  aria-label="Chuyển xuống"
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onChange(value.filter((_, i) => i !== groupIndex))}
                  aria-label="Xóa nhóm"
                >
                  <X className="size-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              {group.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">•</span>
                  <Input
                    value={item}
                    onChange={(event) => updateItem(groupIndex, itemIndex, event.target.value)}
                    placeholder="Công nghệ mở khóa bằng nhận diện khuôn mặt 3D"
                    onKeyDown={(event) => {
                      // Enter ở dòng cuối thì thêm dòng mới, gõ liên tục cho nhanh
                      if (event.key === 'Enter' && itemIndex === group.items.length - 1) {
                        event.preventDefault();
                        addItem(groupIndex);
                      }
                    }}
                  />
                  {group.items.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => removeItem(groupIndex, itemIndex)}
                      aria-label="Xóa dòng"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" onClick={() => addItem(groupIndex)} className="h-7 px-2 text-xs">
                <Plus className="size-3" />
                Thêm dòng
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
