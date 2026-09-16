import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessageVi } from '@ktm/shared';

/**
 * Lỗi nghiệp vụ chuẩn. Trong code API, luôn ném lỗi này thay cho HttpException.
 * Ví dụ: throw new AppException(ErrorCode.OUT_OF_STOCK, HttpStatus.CONFLICT, { sku });
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(ErrorMessageVi[code], status);
  }
}