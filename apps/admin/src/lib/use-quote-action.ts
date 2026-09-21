'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import type { QuoteDetail } from '@/lib/quote-types';

/** Giống useOrderAction: API trả về chi tiết mới; xung đột thì tải lại */
export function useQuoteAction(quote: QuoteDetail) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function run(path: string, method: 'POST' | 'PATCH' | 'PUT', body: Record<string, unknown>, success?: string) {
    setPending(true);
    try {
      const data = await authFetch<QuoteDetail>(path, {
        method,
        body: JSON.stringify({ expectedVersion: quote.version, ...body }),
      });
      queryClient.setQueryData(['quote', quote.id], data);
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
      if (success) toast.success(success);
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
        toast.error('Báo giá vừa được người khác cập nhật. Đã tải lại, vui lòng kiểm tra rồi thao tác lại.');
        void queryClient.invalidateQueries({ queryKey: ['quote', quote.id] });
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