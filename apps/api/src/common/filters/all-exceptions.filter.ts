import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { type ApiErrorBody, ErrorCode, ErrorMessageVi } from '@ktm/shared';
import { AppException } from '../errors/app.exception';

/** Mã HTTP thường gặp -> mã lỗi của hệ thống */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  429: ErrorCode.RATE_LIMITED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

/** Chỉ chấp nhận request id gồm chữ, số, gạch; tối đa 64 ký tự */
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    // Bộ lọc này chỉ xử lý HTTP; WebSocket sẽ có bộ lọc riêng
    if (host.getType() !== 'http') throw exception;

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const incomingId = req.header('x-request-id');
    const traceId = incomingId && SAFE_REQUEST_ID.test(incomingId) ? incomingId : randomUUID();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = {
      code: ErrorCode.INTERNAL_ERROR,
      message: ErrorMessageVi.INTERNAL_ERROR,
      traceId,
    };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, details: exception.details, traceId };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const code = STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
      const response = exception.getResponse();
      const details =
        status === 400 && typeof response === 'object' && response !== null && 'message' in response
          ? response.message
          : undefined;
      body = { code, message: ErrorMessageVi[code], details, traceId };
    }

    if (status >= 500) {
      // Chi tiết lỗi chỉ ghi vào log server, KHÔNG gửi cho client
      this.logger.error(
        `[${traceId}] ${req.method} ${req.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.setHeader('x-request-id', traceId);
    res.status(status).json(body);
  }
}