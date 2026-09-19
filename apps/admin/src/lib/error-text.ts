import { ApiError } from '@/lib/api';

/**
 * Thông báo lỗi dễ đọc nhất có thể:
 * danh sách lỗi từng ô → gộp lại; có gợi ý (hint) → dùng gợi ý; còn lại → message chuẩn.
 */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const details: unknown = error.details;
    if (Array.isArray(details)) {
      const messages = details
        .map((item: unknown) =>
          item && typeof item === 'object' && 'message' in item ? String(item.message) : null,
        )
        .filter((message): message is string => Boolean(message));
      if (messages.length > 0) return messages.join('; ');
    }
    if (details && typeof details === 'object' && 'hint' in details && typeof details.hint === 'string') {
      return details.hint;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại';
}