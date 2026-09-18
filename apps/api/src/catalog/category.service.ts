import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ListQuery,
  type Paginated,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';

/** Giới hạn độ sâu để menu không lồng quá nhiều tầng */
const MAX_DEPTH = 3;

@Injectable()
export class CategoryService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery): Promise<Paginated<unknown>> {
    const where: Prisma.CategoryWhereInput = {
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { products: true, children: true } } },
      }),
      this.db.category.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** Toàn bộ cây danh mục, dùng cho menu và ô chọn danh mục */
  async tree(includeInactive: boolean) {
    const categories = await this.db.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });

    type Node = (typeof categories)[number] & { children: Node[] };
    const byId = new Map<string, Node>();
    for (const category of categories) {
      byId.set(category.id, { ...category, children: [] });
    }

    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async getById(id: string) {
    const category = await this.db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return category;
  }

  async create(input: CategoryCreateInput, staffId: string, ctx: AuditContext) {
    if (input.parentId) {
      await this.assertDepthAllowed(input.parentId);
    }

    const slug =
      input.slug ??
      (await generateUniqueSlug(input.name, async (candidate) =>
        Boolean(await this.db.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
      ));

    try {
      const category = await this.db.category.create({
        data: {
          name: input.name,
          slug,
          parentId: input.parentId,
          description: input.description,
          sortOrder: input.sortOrder ?? 0,
        },
      });

      await this.audit.log({
        staffId,
        action: 'category.create',
        entityType: 'CATEGORY',
        entityId: category.id,
        changes: { after: { name: category.name, slug: category.slug, parentId: category.parentId } },
        ctx,
      });
      return category;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(id: string, input: CategoryUpdateInput, staffId: string, ctx: AuditContext) {
    const before = await this.getById(id);

    if (input.parentId !== undefined && input.parentId !== before.parentId) {
      if (input.parentId) {
        await this.assertNoCycle(id, input.parentId);
        await this.assertDepthAllowed(input.parentId);
      }
    }

    try {
      const category = await this.db.category.update({ where: { id }, data: input });
      await this.audit.log({
        staffId,
        action: 'category.update',
        entityType: 'CATEGORY',
        entityId: id,
        changes: { before: { name: before.name, parentId: before.parentId }, after: input },
        ctx,
      });
      return category;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string, staffId: string, ctx: AuditContext) {
    const category = await this.getById(id);

    if (category._count.products > 0 || category._count.children > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        products: category._count.products,
        children: category._count.children,
        hint: 'Hãy tắt hoạt động thay vì xóa',
      });
    }

    try {
      await this.db.category.delete({ where: { id } });
      await this.audit.log({
        staffId,
        action: 'category.delete',
        entityType: 'CATEGORY',
        entityId: id,
        changes: { before: { name: category.name, slug: category.slug } },
        ctx,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  /** Không cho danh mục trở thành con của chính nó hoặc của con cháu nó */
  private async assertNoCycle(id: string, newParentId: string): Promise<void> {
    let current: string | null = newParentId;
    for (let step = 0; step < 50 && current; step += 1) {
      if (current === id) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
          field: 'parentId',
          message: 'Không thể chuyển danh mục vào bên trong chính nó',
        });
      }
      const parent: { parentId: string | null } | null = await this.db.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = parent?.parentId ?? null;
    }
  }

  private async assertDepthAllowed(parentId: string): Promise<void> {
    let depth = 1;
    let current: string | null = parentId;

    while (current && depth <= MAX_DEPTH) {
      const parent: { parentId: string | null } | null = await this.db.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      if (!parent) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
          field: 'parentId',
          message: 'Danh mục cha không tồn tại',
        });
      }
      current = parent.parentId;
      depth += 1;
    }

    if (depth > MAX_DEPTH) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, {
        field: 'parentId',
        message: `Danh mục chỉ được lồng tối đa ${MAX_DEPTH} cấp`,
      });
    }
  }
}
