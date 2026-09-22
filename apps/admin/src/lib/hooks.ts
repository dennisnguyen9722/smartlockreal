'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useAuth } from '@/components/auth-provider';

/**
 * Gọi API đọc dữ liệu. Token và việc làm mới token do authFetch lo.
 * Chỉ chạy khi đã đăng nhập.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>,
) {
  const { authFetch, status } = useAuth();

  return useQuery<T, Error, T, readonly unknown[]>({
    ...options,
    queryKey: key,
    queryFn: () => authFetch<T>(path),
    // Đặt SAU ...options: nếu để trước, trang truyền `enabled` sẽ ghi đè mất điều kiện "đã đăng nhập"
    enabled: status === 'authenticated' && (options?.enabled ?? true),
  });
}

/** Gọi API ghi dữ liệu (tạo, sửa, xóa) */
export function useApiMutation<TData, TVariables = void>(
  request: (variables: TVariables) => { path: string; method?: string; body?: unknown },
  options?: {
    /** Các khóa cần tải lại sau khi ghi thành công */
    invalidate?: readonly unknown[][];
  } & Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const { invalidate, onSuccess, ...rest } = options ?? {};

  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) => {
      const { path, method = 'POST', body } = request(variables);
      return authFetch<TData>(path, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    },
    onSuccess: async (data, variables, context, mutation) => {
      for (const key of invalidate ?? []) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      await onSuccess?.(data, variables, context, mutation);
    },
    ...rest,
  });
}