import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ErrorCode, Permission, WarrantyLookupQuerySchema } from '@ktm/shared';
import { RequirePermissions } from '../auth/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { WarrantyService } from './warranty.service';

/** Tra cứu bảo hành cho nhân viên. Bảo hành do hãng làm, đây chỉ là tra cứu (không ghi gì) */
@Controller('warranty')
export class WarrantyController {
  constructor(private readonly warranty: WarrantyService) {}

  /** GET /warranty/lookup?q=0901234567 | serial (một phần) | DH-260922-0001 */
  @Get('lookup')
  @RequirePermissions(Permission.WARRANTY_VIEW)
  lookup(@Query() query: unknown) {
    const result = WarrantyLookupQuerySchema.safeParse(query);
    if (!result.success) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        HttpStatus.BAD_REQUEST,
        result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    }
    return this.warranty.lookup(result.data.q);
  }
}