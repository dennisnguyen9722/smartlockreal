import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  type DoorTypeAssignQuery,
  type DoorTypeCreateInput,
  type DoorTypeRow,
  type DoorTypeUpdateInput,
  type Paginated,
  type ProductDoorTypeBulkInput,
  type ProductDoorTypeRow,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';

@Injectable()
export class DoorTypeService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  // ---------- Loại cửa ----------

  async list(includeInactive = false): Promise<DoorTypeRow[]> {
    const rows = await this.db.doorType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      productCount: row._count.products,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async create(input: DoorTypeCreateInput, staffId: string, ctx: AuditContext) {
    const slug =
      input.slug ??
      (await generateUniqueSlug(input.name, async (candidate) =>
        Boolean(await this.db.doorType.findUnique({ where: { slug: candidate }, select: { id: true } })),
      ));

    try {
      const created = await this.db.doorType.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await this.audit.log({
        staffId,
        action: 'door_type.create',
        entityType: 'DOOR_TYPE',
        entityId: created.id,
        changes: { after: { name: created.name, slug: created.slug } },
        ctx,
      });
      return created;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async update(id: string, input: DoorTypeUpdateInput, staffId: string, ctx: AuditContext) {
    const current = await this.db.doorType.findUnique({ where: { id } });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const { expectedUpdatedAt, ...data } = input;

    try {
      // updateMany + updatedAt trong where: ai lưu trước thì người sau bị chặn
      const result = await this.db.doorType.updateMany({
        where: {
          id,
          ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
        },
        data,
      });
      if (result.count === 0) {
        throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT, {
          currentUpdatedAt: current.updatedAt.toISOString(),
        });
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error);
    }

    await this.audit.log({
      staffId,
      action: 'door_type.update',
      entityType: 'DOOR_TYPE',
      entityId: id,
      changes: { before: { name: current.name, isActive: current.isActive }, after: data },
      ctx,
    });
    return this.db.doorType.findUnique({ where: { id } });
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const doorType = await this.db.doorType.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!doorType) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    // Còn sản phẩm thì không xóa: xóa xong link cũ trên Google sẽ thành 404
    if (doorType._count.products > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        hint: `Còn ${doorType._count.products} sản phẩm thuộc loại cửa này. Hãy gỡ hết rồi xóa, hoặc tắt hoạt động thay vì xóa.`,
      });
    }

    await this.db.doorType.delete({ where: { id } });
    await this.audit.log({
      staffId,
      action: 'door_type.delete',
      entityType: 'DOOR_TYPE',
      entityId: id,
      changes: { before: { name: doorType.name, slug: doorType.slug } },
      ctx,
    });
  }

  // ---------- Gắn loại cửa cho sản phẩm ----------

  /** Danh sách sản phẩm kèm loại cửa đang có, để trang gắn hàng loạt hiển thị */
  async listProducts(query: DoorTypeAssignQuery): Promise<Paginated<ProductDoorTypeRow>> {
    const where: Prisma.ProductWhereInput = {
      status: { not: 'ARCHIVED' },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { manufacturerCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.doorTypeId === 'CHUA_GAN'
        ? { doorTypes: { none: {} } }
        : query.doorTypeId
          ? { doorTypes: { some: { doorTypeId: query.doorTypeId } } }
          : {}),
    };

    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          category: { select: { name: true } },
          brand: { select: { name: true } },
          doorTypes: { select: { doorTypeId: true } },
        },
      }),
      this.db.product.count({ where }),
    ]);

    return {
      items: items.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        categoryName: product.category.name,
        brandName: product.brand?.name ?? null,
        doorTypeIds: product.doorTypes.map((link) => link.doorTypeId),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Đặt lại toàn bộ loại cửa của một sản phẩm */
  async setForProduct(productId: string, doorTypeIds: string[], staffId: string, ctx: AuditContext) {
    const product = await this.db.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    await this.assertDoorTypesExist(doorTypeIds);

    await this.db.$transaction(async (tx) => {
      await tx.productDoorType.deleteMany({ where: { productId } });
      if (doorTypeIds.length > 0) {
        await tx.productDoorType.createMany({
          data: doorTypeIds.map((doorTypeId) => ({ productId, doorTypeId })),
          skipDuplicates: true,
        });
      }
    });

    await this.audit.log({
      staffId,
      action: 'product.door_types',
      entityType: 'PRODUCT',
      entityId: productId,
      changes: { after: { doorTypeIds } },
      ctx,
    });

    return { productId, doorTypeIds };
  }

  /** Gắn hoặc gỡ cho nhiều sản phẩm trong MỘT transaction */
  async bulkAssign(input: ProductDoorTypeBulkInput, staffId: string, ctx: AuditContext) {
    await this.assertDoorTypesExist(input.doorTypeIds);

    const products = await this.db.product.findMany({
      where: { id: { in: input.productIds } },
      select: { id: true },
    });
    const productIds = products.map((product) => product.id);
    const missing = input.productIds.length - productIds.length;

    let changed = 0;
    await this.db.$transaction(async (tx) => {
      if (input.mode === 'REMOVE') {
        const result = await tx.productDoorType.deleteMany({
          where: { productId: { in: productIds }, doorTypeId: { in: input.doorTypeIds } },
        });
        changed = result.count;
        return;
      }

      if (input.mode === 'REPLACE') {
        await tx.productDoorType.deleteMany({ where: { productId: { in: productIds } } });
      }

      const result = await tx.productDoorType.createMany({
        data: productIds.flatMap((productId) =>
          input.doorTypeIds.map((doorTypeId) => ({ productId, doorTypeId })),
        ),
        skipDuplicates: true,
      });
      changed = result.count;
    });

    await this.audit.log({
      staffId,
      action: 'product.door_types_bulk',
      entityType: 'PRODUCT',
      changes: {
        after: {
          mode: input.mode,
          productCount: productIds.length,
          doorTypeIds: input.doorTypeIds,
          changed,
        },
      },
      ctx,
    });

    return { productCount: productIds.length, changed, missing };
  }

  private async assertDoorTypesExist(ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.db.doorType.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'doorTypeIds',
        message: 'Có loại cửa không tồn tại',
      });
    }
  }
}
