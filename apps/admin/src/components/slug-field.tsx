'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import { slugifyVi } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';

export function SlugField({
  name,
  value,
  onChange,
  isEditing,
  error,
}: {
  /** Tên đang nhập, dùng để tạo slug */
  name: string;
  value: string;
  onChange: (slug: string) => void;
  isEditing: boolean;
  error?: string;
}) {
  const suggestion = slugifyVi(name.trim());
  // Slug hiện tại không còn khớp với tên: người dùng vừa đổi tên
  const outdated = isEditing && value.length > 0 && suggestion.length > 0 && value !== suggestion;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Đường dẫn</Label>
        {name.trim().length > 0 && (
          <Button
            variant="ghost"
            onClick={() => onChange(suggestion)}
            className="h-6 px-2 text-xs"
            title="Tạo lại đường dẫn từ tên hiện tại"
          >
            <RefreshCw className="size-3" />
            Tạo lại từ tên
          </Button>
        )}
      </div>

      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={suggestion || 'tu-dong-tao'}
      />

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : outdated ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          <span>
            Đường dẫn giữ nguyên khi đổi tên, để không làm hỏng liên kết cũ và thứ hạng tìm kiếm.
            Muốn đổi thì bấm &quot;Tạo lại từ tên&quot;.
          </span>
        </p>
      ) : isEditing ? (
        <p className="text-xs text-muted-foreground">Đổi đường dẫn sẽ làm hỏng các liên kết cũ.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {suggestion ? `Tự tạo: ${suggestion}` : 'Bỏ trống để hệ thống tự tạo từ tên'}
        </p>
      )}
    </div>
  );
}
