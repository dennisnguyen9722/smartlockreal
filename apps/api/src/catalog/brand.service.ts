import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  type BrandCreateInput,
  type BrandUpdateInput,
  type ListQuery,
  type Paginated,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';

@Injectable()
export class BrandService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery): Promise<Paginated<unknown>> {
    const where: Prisma.BrandWhereInput = {
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.brand.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { products: true } } },
      }),
      this.db.brand.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getById(id: string) {
    const brand = await this.db.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return brand;
  }

  async create(input: BrandCreateInput, staffId: string, ctx: AuditContext) {
    const slug =
      input.slug ??
      (await generateUniqueSlug(input.name, async (candidate) =>
        Boolean(await this.db.brand.findUnique({ where: { slug: candidate }, select: { id: true } })),
      ));

    try {
      const brand = await this.db.brand.create({
        data: {
          name: input.name,
          slug,
          logoUrl: input.logoUrl ?? null,
          description: input.description,
          countryOfOrigin: input.countryOfOrigin,
          isAuthorized: input.isAuthorized ?? false,
          authorizationDocUrl: input.authorizationDocUrl,
          authorizationExpiresAt: input.authorizationExpiresAt
            ? new Date(input.authorizationExpiresAt)
            : undefined,
          sortOrder: input.sortOrder ?? 0,
        },
      });

      await this.audit.log({
        staffId,
        action: 'brand.create',
        entityType: 'BRAND',
        entityId: brand.id,
        changes: { after: { name: brand.name, slug: brand.slug } },
        ctx,
      });
      return brand;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(id: string, input: BrandUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.getById(id);

    try {
      const brand = await this.db.brand.update({
        where: { id },
        data: {
          ...input,
          authorizationExpiresAt: input.authorizationExpiresAt
            ? new Date(input.authorizationExpiresAt)
            : undefined,
        },
      });

      await this.audit.log({
        staffId,
        action: 'brand.update',
        entityType: 'BRAND',
        entityId: id,
        changes: { before: { name: before.name, isActive: before.isActive }, after: input },
        ctx,
      });
      return brand;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const brand = await this.getById(id);

    // Hãng đã có sản phẩm thì không xóa, chỉ tắt hoạt động
    if (brand._count.products > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        products: brand._count.products,
        hint: 'Hãy tắt hoạt động thay vì xóa',
      });
    }

    try {
      await this.db.brand.delete({ where: { id } });
      await this.audit.log({
        staffId,
        action: 'brand.delete',
        entityType: 'BRAND',
        entityId: id,
        changes: { before: { name: brand.name, slug: brand.slug } },
        ctx,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
