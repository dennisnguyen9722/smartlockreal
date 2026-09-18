import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * BigInt không tự chuyển được sang JSON. Tiền của dự án là số nguyên VND,
 * luôn nhỏ hơn giới hạn an toàn của JavaScript (9 triệu tỷ), nên chuyển sang số bình thường.
 * Giá trị vượt giới hạn (rất hiếm) chuyển thành chuỗi để không mất chính xác.
 */
function convert(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(convert);

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = convert(item);
  }
  return result;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(convert));
  }
}
