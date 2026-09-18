'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@ktm/ui/components/button';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        Hiển thị {from}–{to} trong {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="size-4" />
          Trước
        </Button>
        <span className="px-2 text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button variant="outline" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
