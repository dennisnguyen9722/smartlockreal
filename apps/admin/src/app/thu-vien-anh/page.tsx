'use client';

import { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { imageUrl, type Paginated } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { ImagePicker } from '@/components/image-picker';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { errorText } from '@/lib/error-text';
import { formatDateVn } from '@/lib/format';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { checkImageFile } from '@/lib/product-images';

interface MediaAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  altText: string | null;
  createdAt: string;
}

const PAGE_SIZE = 24;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const { can, authFetch } = useAuth();
  const canManage = can('content.manage');

  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);

  const query = useApiQuery<Paginated<MediaAsset>>(
    ['media', { page }],
    `/media?page=${page}&pageSize=${PAGE_SIZE}`,
    { placeholderData: (previous) => previous },
  );

  async function uploadFiles(files: File[]) {
    const problems = files.map(checkImageFile).filter((problem): problem is string => problem !== null);
    if (problems.length > 0) {
      toast.error(problems.join('; '));
      return;
    }
    setUploading(true);
    let done = 0;
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        await authFetch('/media/upload', { method: 'POST', body: form });
        done += 1;
      }
      toast.success(`Đã tải lên ${done} ảnh`);
    } catch (error) {
      toast.error(`${done > 0 ? `Đã tải ${done} ảnh. ` : ''}${errorText(error)}`);
    } finally {
      setUploading(false);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['media'] });
    }
  }

  const remove = useApiMutation<void, string>((id) => ({ path: `/media/${id}`, method: 'DELETE' }), {
    invalidate: [['media']],
    onSuccess: () => {
      setDeleting(null);
      toast.success('Đã xóa ảnh');
    },
    onError: (error) => {
      setDeleting(null);
      toast.error(errorText(error));
    },
  });

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã sao chép đường dẫn ảnh');
    } catch {
      toast.error('Trình duyệt không cho sao chép, hãy mở ảnh rồi sao chép thủ công');
    }
  }

  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Thư viện ảnh"
        description="Ảnh tự chuyển sang WebP 3 kích thước; tải trùng ảnh cũ sẽ dùng lại, không lưu hai lần"
      />

      {canManage && (
        <div className="mb-6">
          <ImagePicker images={[]} onFiles={(files) => void uploadFiles(files)} uploading={uploading} label="Tải ảnh lên thư viện" />
        </div>
      )}

      {query.isPending ? (
        <LoadingRows rows={4} />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : items.length === 0 ? (
        <EmptyState message="Thư viện chưa có ảnh nào" />
      ) : (
        <div className={cn('space-y-4', query.isFetching && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((asset) => (
              <figure key={asset.id} className="group overflow-hidden rounded-lg border">
                <a href={asset.url} target="_blank" rel="noreferrer" title="Mở ảnh gốc">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn */}
                  <img
                    src={imageUrl(asset.url, 'sm')}
                    alt={asset.altText ?? ''}
                    loading="lazy"
                    className="aspect-square w-full bg-muted object-contain"
                  />
                </a>
                <figcaption className="space-y-1 p-2 text-xs text-muted-foreground">
                  <p>
                    {asset.width}×{asset.height} · {formatSize(asset.sizeBytes)}
                  </p>
                  <p>{formatDateVn(asset.createdAt)}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="xs" onClick={() => void copyUrl(asset.url)}>
                      <Copy />
                      Link
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleting(asset)}
                        className="ml-auto"
                        aria-label="Xóa ảnh"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    )}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa ảnh khỏi thư viện?"
        description="Xóa hẳn file ảnh trên máy chủ. Ảnh đang dùng cho sản phẩm, bài viết hoặc banner sẽ không xóa được."
        confirmLabel="Xóa"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}