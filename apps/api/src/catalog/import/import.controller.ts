import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ErrorCode, Permission } from '@ktm/shared';
import { RequirePermissions } from '../../auth/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import { ImportTemplateService } from './template.service';

const CategoryIdSchema = z.uuid().optional();

@Controller('catalog/import')
export class ImportController {
  constructor(private readonly template: ImportTemplateService) {}

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
}
