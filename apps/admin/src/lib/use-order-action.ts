'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import type { OrderDetail } from '@/lib/order-types';

/**
 * Gửi một thao tác lên đơn (sửa, đổi trạng thái, thu tiền...). API trả về chi tiết đơn mới:
 * cập nhật thẳng vào bộ nhớ đệm, danh sách đơn tải lại. Xung đột (người khác vừa sửa) thì tải lại đơn.
 */
export function useOrderAction(order: OrderDetail) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function run(path: string, method: 'POST' | 'PATCH' | 'PUT', body: Record<string, unknown>, success?: string) {
    setPending(true);
    try {
      const data = await authFetch<OrderDetail>(path, {
        method,
        body: JSON.stringify({ expectedVersion: order.version, ...body }),
      });
      queryClient.setQueryData(['order', order.id], data);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (success) toast.success(success);
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
        toast.error('Đơn vừa được người khác cập nhật. Đã tải lại, vui lòng kiểm tra rồi thao tác lại.');
        void queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      } else {
        toast.error(errorText(error));
      }
      return null;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}