import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditQueryService } from './audit-query.service';
import { AuditService } from './audit.service';

/**
 * Global: mọi module ghi nhật ký qua AuditService.
 * AuditQueryService chỉ phục vụ trang Nhật ký (quyền audit.view).
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService],
  exports: [AuditService, AuditQueryService],
})
export class AuditModule {}
