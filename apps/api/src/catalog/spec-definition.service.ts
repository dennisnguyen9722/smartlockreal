import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  toJsonSafe,
  validateSpecs,
  type JsonObject,
  type SpecDefinitionCreateInput,
  type SpecDefinitionShape,
  type SpecDefinitionUpdateInput,
  type SpecValidationResult,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';

@Injectable()
export class SpecDefinitionService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async listByCategory(categoryId: string) {
    const category = await this.db.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    return this.db.specDefinition.findMany({
      where: { categoryId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(categoryId: string, input: SpecDefinitionCreateInput, staffId: string, ctx: AuditContext) {
    try {
      const definition = await this.db.specDefinition.create({
        data: {
          categoryId,
          code: input.code,
          name: input.name,
          dataType: input.dataType,
          unit: input.unit,
          options: input.options ? (toJsonSafe(input.options) as JsonObject[]) : undefined,
          isFilterable: input.isFilterable,
          isRequired: input.isRequired,
          sortOrder: input.sortOrder,
        },
      });

      await this.audit.log({
        staffId,
        action: 'spec_definition.create',
        entityType: 'SPEC_DEFINITION',
        entityId: definition.id,
        changes: { after: { categoryId, code: input.code, dataType: input.dataType } },
        ctx,
      });
      return definition;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(id: string, input: SpecDefinitionUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.db.specDefinition.findUnique({ where: { id } });
    if (!before) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    // Đổi kiểu dữ liệu sẽ làm dữ liệu cũ của sản phẩm không còn hợp lệ
    if (input.dataType && input.dataType !== before.dataType) {
      const used = await this.countProductsUsing(before.categoryId, before.code);
      if (used > 0) {
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          products: used,
          hint: 'Đang có sản phẩm dùng thông số này; hãy tạo thông số mới thay vì đổi kiểu',
        });
      }
    }

    try {
      const definition = await this.db.specDefinition.update({
        where: { id },
        data: {
          ...input,
          options: input.options ? (toJsonSafe(input.options) as JsonObject[]) : undefined,
        },
      });

      await this.audit.log({
        staffId,
        action: 'spec_definition.update',
        entityType: 'SPEC_DEFINITION',
        entityId: id,
        changes: { before: { name: before.name, dataType: before.dataType }, after: input },
        ctx,
      });
      return definition;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const definition = await this.db.specDefinition.findUnique({ where: { id } });
    if (!definition) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const used = await this.countProductsUsing(definition.categoryId, definition.code);
    if (used > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, { products: used });
    }

    await this.db.specDefinition.delete({ where: { id } });
    await this.audit.log({
      staffId,
      action: 'spec_definition.delete',
      entityType: 'SPEC_DEFINITION',
      entityId: id,
      changes: { before: { code: definition.code, name: definition.name } },
      ctx,
    });
  }

  /** Lấy khuôn thông số của danh mục, gồm cả thông số kế thừa từ danh mục cha */
  async getShapes(categoryId: string): Promise<SpecDefinitionShape[]> {
    const categoryIds: string[] = [];
    let current: string | null = categoryId;

    for (let depth = 0; depth < 10 && current; depth += 1) {
      categoryIds.push(current);
      const parent: { parentId: string | null } | null = await this.db.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = parent?.parentId ?? null;
    }

    const definitions = await this.db.specDefinition.findMany({
      where: { categoryId: { in: categoryIds } },
      orderBy: [{ sortOrder: 'asc' }],
    });

    // Danh mục con ghi đè thông số cùng mã của danh mục cha
    const byCode = new Map<string, SpecDefinitionShape>();
    for (const id of [...categoryIds].reverse()) {
      for (const definition of definitions.filter((item) => item.categoryId === id)) {
        byCode.set(definition.code, {
          code: definition.code,
          name: definition.name,
          dataType: definition.dataType,
          options: definition.options as SpecDefinitionShape['options'],
          isRequired: definition.isRequired,
        });
      }
    }
    return [...byCode.values()];
  }

  /** Kiểm tra thông số của sản phẩm; dùng ở module sản phẩm và nhập Excel */
  async validate(categoryId: string, specs: Record<string, unknown>): Promise<SpecValidationResult> {
    return validateSpecs(await this.getShapes(categoryId), specs);
  }

  private countProductsUsing(categoryId: string, code: string): Promise<number> {
    return this.db.product.count({
      where: { categoryId, specs: { path: [code], not: Prisma.DbNull } },
    });
  }
}
