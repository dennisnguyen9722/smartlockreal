import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { z } from 'zod';
import { ErrorCode, Permission, ReportQuerySchema } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthUser } from '../common/types/express';
import { AppException } from '../common/errors/app.exception';
import { ReportService } from './report.service';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppException(
      ErrorCode.VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

/** Báo cáo chỉ đọc; doanh thu tính theo đơn đã Hoàn tất (xem ghi chú ở @ktm/shared schemas/report.ts) */
@Controller('reports')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  /** Trang chủ CMS: mọi nhân viên đều xem được, nội dung tự cắt theo quyền */
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user.id, user.role);
  }

  @Get('overview')
  @RequirePermissions(Permission.REPORT_VIEW)
  overview(@Query() query: unknown) {
    return this.reports.overview(parse(ReportQuerySchema, query));
  }
}
