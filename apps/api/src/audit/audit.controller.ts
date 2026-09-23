import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditListQuerySchema, ErrorCode, Permission } from '@ktm/shared';
import { RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { AuditQueryService } from './audit-query.service';

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

/** Nhật ký chỉ ĐỌC: không có endpoint sửa hay xóa */
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly logs: AuditQueryService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_VIEW)
  list(@Query() query: unknown) {
    return this.logs.list(parse(AuditListQuerySchema, query));
  }

  /** Danh sách người từng có thao tác (đổ vào ô lọc) */
  @Get('actors')
  @RequirePermissions(Permission.AUDIT_VIEW)
  actors() {
    return this.logs.actors();
  }
}
