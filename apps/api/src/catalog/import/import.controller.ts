import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { ErrorCode, Permission } from '@ktm/shared';
import { CurrentUser, RequirePermissions } from '../../auth/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import type { AuthUser } from '../../common/types/express';
import { ImportService } from './import.service';
import { ImportParserService } from './parser.service';
import { ImportTemplateService } from './template.service';
import { Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../../audit/audit.service';

const CategoryIdSchema = z.uuid().optional();
const MAX_FILE_MB = 5;

@Controller('catalog/import')
export class ImportController {
  constructor(
    private readonly template: ImportTemplateService,
    private readonly parser: ImportParserService,
    private readonly importer: ImportService,
    private readonly audit: AuditService,
  ) {}

  @Get('template')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  async downloadTemplate(@Query('categoryId') categoryId: string | undefined, @Res() res: Response) {
    const parsed = CategoryIdSchema.safeParse(categoryId || undefined);
    if (!parsed.success) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'categoryId',
      });
    }

    const buffer = await this.template.build(parsed.data);
    const fileName = `mau-nhap-san-pham-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  /** Đọc file và trả về kết quả xem trước; CHƯA ghi gì vào database */
  @Post('preview')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 } }))
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'file',
        message: 'Chưa chọn file',
      });
    }
    const rows = await this.parser.parse(file.buffer);
    return this.importer.preview(rows, user.id);
  }

  /** Xác nhận ghi kế hoạch đã xem trước vào database */
  @Post('apply')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @HttpCode(HttpStatus.OK)
  async apply(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const parsed = z.object({ sessionId: z.uuid() }).safeParse(body ?? {});
    if (!parsed.success) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'sessionId',
      });
    }

    const result = await this.importer.apply(parsed.data.sessionId, user.id);

    await this.audit.log({
      staffId: user.id,
      action: 'product.import',
      entityType: 'PRODUCT',
      changes: { ...result },
      ctx: {
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
        traceId: req.get('x-request-id') ?? undefined,
      },
    });

    return result;
  }
}
