'use client';

import { useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';

/** Ảnh trong thư viện (bảng media_assets) */
export interface MediaAssetSummary {
  id: string;
  url: string;
  width: number;
  height: number;
  altText: string | null;
}

/** Khớp với ImageService.assertIsImage phía API */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 20;

/** Kiểm tra nhanh phía trình duyệt; máy chủ vẫn kiểm tra lại nội dung thật của file */
export function checkImageFile(file: File): string | null {
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name}: chỉ nhận ảnh JPG, PNG hoặc WebP (ảnh HEIC từ iPhone hãy đổi sang JPG trước)`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `${file.name}: ảnh tối đa ${MAX_SIZE_MB} MB`;
  }
  return null;
}

/**
 * Tải ảnh lên thư viện (API tự đổi sang WebP 3 kích thước, ảnh trùng thì dùng lại)
 * và gắn ảnh vào sản phẩm/biến thể.
 */
export function useProductImages(productId: string) {
  const { authFetch } = useAuth();

  const upload = useCallback(
    (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return authFetch<MediaAssetSummary>('/media/upload', { method: 'POST', body: form });
    },
    [authFetch],
  );

  const attach = useCallback(
    (mediaAssetId: string, variantId: string | null) =>
      authFetch<{ id: string }>(`/catalog/products/${productId}/media`, {
        method: 'POST',
        body: JSON.stringify({ mediaAssetId, variantId }),
      }),
    [authFetch, productId],
  );

  const detach = useCallback(
    (productMediaId: string) =>
      authFetch<void>(`/catalog/products/media/${productMediaId}`, { method: 'DELETE' }),
    [authFetch],
  );

  return { upload, attach, detach };
}