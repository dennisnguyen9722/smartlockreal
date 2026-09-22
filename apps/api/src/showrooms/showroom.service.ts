import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  OpeningHoursSchema,
  showroomPath,
  type OpeningHoursEntry,
  type ShowroomCreateInput,
  type ShowroomDetail,
  type ShowroomListItem,
  type ShowroomUpdateInput,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { generateUniqueSlug } from '../common/slug.util';
import { PRISMA } from '../database/database.module';
import { GeoService } from '../geo/geo.service';

type Tx = Prisma.TransactionClient;
type FieldError = { field: string; message: string };

function invalid(details: FieldError[]): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, details);
}

function rethrow(error: unknown): never {
  if (error instanceof AppException) throw error;
  mapPrismaError(error);
}

const SHOWROOM_SELECT = {
  id: true,
  code: true,
  name: true,
  slug: true,
  address: true,
  phone: true,
  region: true,
  isActive: true,
  isPublic: true,
  sortOrder: true,
  provinceCode: true,
  provinceName: true,
  wardCode: true,
  wardName: true,
  street: true,
  email: true,
  latitude: true,
  longitude: true,
  googleMapsUrl: true,
  openingHours: true,
  description: true,
  imageUrls: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.LocationSelect;

type ShowroomRow = Prisma.LocationGetPayload<{ select: typeof SHOWROOM_SELECT }>;

/** Giờ mở cửa đọc từ JSON: sai định dạng (sửa tay trong database) thì coi như chưa khai báo */
function readOpeningHours(value: unknown): OpeningHoursEntry[] {
  const parsed = OpeningHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Điều kiện BẮT BUỘC để hiện trên website. Tọa độ, ảnh, mô tả chỉ là nên có (giao diện nhắc).
 * Database cũng chặn phần địa chỉ và slug (CHECK locations_public_complete).
 */
function missingForPublic(row: Pick<ShowroomRow, 'slug' | 'provinceCode' | 'street' | 'phone' | 'openingHours'>): string[] {
  const missing: string[] = [];
  if (!row.slug) missing.push('Đường dẫn');
  if (!row.provinceCode || !row.street) missing.push('Địa chỉ chuẩn (tỉnh, phường, số nhà)');
  if (!row.phone) missing.push('Số điện thoại');
  if (readOpeningHours(row.openingHours).length === 0) missing.push('Giờ mở cửa');
  return missing;
}

@Injectable()
export class ShowroomService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
    private readonly geo: GeoService,
  ) {}

  // ================= Đọc =================

  async list(): Promise<ShowroomListItem[]> {
    const rows = await this.db.location.findMany({
      where: { type: 'STORE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: SHOWROOM_SELECT,
    });
    return rows.map((row) => this.toListItem(row));
  }

  async getById(id: string): Promise<ShowroomDetail> {
    const row = await this.db.location.findFirst({ where: { id, type: 'STORE' }, select: SHOWROOM_SELECT });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    const orderCount = await this.db.order.count({ where: { fulfillmentLocationId: id } });
    return this.toDetail(row, orderCount);
  }

  // ================= Ghi =================

  async create(input: ShowroomCreateInput, staffId: string, ctx: AuditContext): Promise<ShowroomDetail> {
    const address = this.resolveAddress(input.provinceCode, input.wardCode, input.street);
    const openingHours = input.openingHours ?? [];
    const slug = input.slug ?? (await generateUniqueSlug(input.name, (value) => this.slugTaken(value), 120));
    if (input.slug && (await this.slugTaken(input.slug))) {
      invalid([{ field: 'slug', message: 'Đường dẫn này đã có showroom khác dùng' }]);
    }

    const isPublic = input.isPublic ?? false;
    if (isPublic) {
      this.assertPublishable({ slug, provinceCode: address.provinceCode, street: address.street, phone: input.phone ?? null, openingHours });
    }

    let id: string;
    try {
      const created = await this.db.location.create({
        data: {
          code: await this.uniqueCode(slug),
          name: input.name,
          type: 'STORE',
          region: address.region,
          address: address.full,
          provinceCode: address.provinceCode,
          provinceName: address.provinceName,
          wardCode: address.wardCode,
          wardName: address.wardName,
          street: address.street,
          slug,
          phone: input.phone ?? null,
          email: input.email ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          googleMapsUrl: input.googleMapsUrl ?? null,
          openingHours: openingHours as Prisma.InputJsonValue,
          description: input.description ?? null,
          imageUrls: input.imageUrls ?? [],
          isActive: input.isActive ?? true,
          isPublic,
          publishedAt: isPublic ? new Date() : null,
          sortOrder: input.sortOrder ?? 0,
        },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({ staffId, action: 'showroom.create', entityType: 'LOCATION', entityId: id, changes: { after: input }, ctx });
    return this.getById(id);
  }

  async update(id: string, input: ShowroomUpdateInput, staffId: string, ctx: AuditContext): Promise<ShowroomDetail> {
    const current = await this.db.location.findFirst({ where: { id, type: 'STORE' }, select: SHOWROOM_SELECT });
    if (!current) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
      throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
    }

    const changes = input;
    const data: Prisma.LocationUncheckedUpdateManyInput = {};

    if (changes.name !== undefined) data.name = changes.name;
    if (changes.phone !== undefined) data.phone = changes.phone;
    if (changes.email !== undefined) data.email = changes.email;
    if (changes.latitude !== undefined) data.latitude = changes.latitude;
    if (changes.longitude !== undefined) data.longitude = changes.longitude;
    if (changes.googleMapsUrl !== undefined) data.googleMapsUrl = changes.googleMapsUrl;
    if (changes.openingHours !== undefined) data.openingHours = changes.openingHours as Prisma.InputJsonValue;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.imageUrls !== undefined) data.imageUrls = changes.imageUrls;
    if (changes.sortOrder !== undefined) data.sortOrder = changes.sortOrder;

    // Địa chỉ: đổi phần nào cũng dựng lại địa chỉ đầy đủ (cột address dùng cho đơn nhận tại showroom)
    let nextProvinceCode = current.provinceCode;
    let nextStreet = current.street;
    if (changes.provinceCode !== undefined || changes.street !== undefined) {
      const provinceCode = changes.provinceCode ?? current.provinceCode;
      const wardCode = changes.wardCode ?? current.wardCode;
      const street = changes.street ?? current.street;
      if (!provinceCode || !wardCode || !street) {
        invalid([{ field: 'provinceCode', message: 'Cần đủ tỉnh, phường và số nhà' }]);
      }
      const address = this.resolveAddress(provinceCode, wardCode, street);
      Object.assign(data, {
        region: address.region,
        address: address.full,
        provinceCode: address.provinceCode,
        provinceName: address.provinceName,
        wardCode: address.wardCode,
        wardName: address.wardName,
        street: address.street,
      });
      nextProvinceCode = address.provinceCode;
      nextStreet = address.street;
    }

    const nextSlug = changes.slug ?? current.slug;
    if (changes.slug !== undefined && changes.slug !== current.slug) {
      if (await this.slugTaken(changes.slug, id)) invalid([{ field: 'slug', message: 'Đường dẫn này đã có showroom khác dùng' }]);
      data.slug = changes.slug;
    }

    // Trạng thái: tắt showroom thì tự gỡ khỏi website (database cũng bắt buộc như vậy)
    const isActive = changes.isActive ?? current.isActive;
    let isPublic = changes.isPublic ?? current.isPublic;
    if (changes.isActive !== undefined) data.isActive = changes.isActive;
    if (!isActive) isPublic = false;
    if (isPublic !== current.isPublic) data.isPublic = isPublic;

    if (isPublic) {
      this.assertPublishable({
        slug: nextSlug,
        provinceCode: nextProvinceCode,
        street: nextStreet,
        phone: changes.phone !== undefined ? changes.phone : current.phone,
        openingHours: changes.openingHours ?? current.openingHours,
      });
      // Lần đầu đăng: ghi mốc để từ đó đổi slug sẽ tạo redirect
      if (!current.publishedAt) data.publishedAt = new Date();
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Khóa lạc quan: chỉ ghi khi chưa ai sửa kể từ lúc tải
        const result = await tx.location.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
        if (result.count === 0) throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);

        if (nextSlug && nextSlug !== current.slug && current.slug && current.publishedAt) {
          await this.redirectSlug(tx, current.slug, nextSlug, staffId);
        }
      });
    } catch (error) {
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'showroom.update',
      entityType: 'LOCATION',
      entityId: id,
      changes: {
        before: Object.fromEntries(Object.keys(data).map((key) => [key, current[key as keyof ShowroomRow]])),
        after: data,
      },
      ctx,
    });
    return this.getById(id);
  }

  /**
   * Xóa hẳn: CHỈ khi showroom chưa từng được dùng (vd tạo nhầm, tạo để thử).
   * Đã có đơn "nhận tại showroom" thì chặn, hướng dẫn tắt thay thế.
   * Các bảng kho di sản cũng trỏ tới locations (Restrict): database chặn, ở đây dịch thành IN_USE.
   */
  async remove(id: string, staffId: string, ctx: AuditContext): Promise<void> {
    const showroom = await this.db.location.findFirst({
      where: { id, type: 'STORE' },
      select: { id: true, code: true, name: true, slug: true, isPublic: true },
    });
    if (!showroom) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const orderCount = await this.db.order.count({ where: { fulfillmentLocationId: id } });
    if (orderCount > 0) {
      throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
        orders: orderCount,
        hint: `Showroom đã có ${orderCount} đơn nhận hàng nên không xóa được. Bỏ tick "Đang hoạt động" thay thế.`,
      });
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Link cũ đang chuyển về trang showroom này sẽ thành link chết: xóa luôn
        if (showroom.slug) await tx.urlRedirect.deleteMany({ where: { toPath: showroomPath(showroom.slug) } });
        await tx.location.delete({ where: { id } });
      });
    } catch (error) {
      // P2003 khi XÓA nghĩa là còn dữ liệu trỏ tới (không phải "tham chiếu không tồn tại" như mapPrismaError dịch)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppException(ErrorCode.IN_USE, HttpStatus.CONFLICT, {
          hint: 'Showroom còn dữ liệu kho cũ liên quan nên không xóa được. Bỏ tick "Đang hoạt động" thay thế.',
        });
      }
      rethrow(error);
    }

    await this.audit.log({
      staffId,
      action: 'showroom.delete',
      entityType: 'LOCATION',
      entityId: id,
      changes: { before: { code: showroom.code, name: showroom.name, slug: showroom.slug, isPublic: showroom.isPublic } },
      ctx,
    });
  }

  // ================= Nội bộ =================

  private resolveAddress(provinceCode: string, wardCode: string, street: string) {
    const resolved = this.geo.resolve(provinceCode, wardCode);
    if (!resolved) invalid([{ field: 'wardCode', message: 'Phường/xã không thuộc tỉnh đã chọn' }]);
    // Cột region là enum HCM/HN (bảng giá theo khu vực dùng chung). Mở showroom tỉnh khác cần migration thêm giá trị enum
    if (!resolved.region) {
      invalid([{ field: 'provinceCode', message: 'Hiện chỉ hỗ trợ showroom ở TP. Hồ Chí Minh và Hà Nội' }]);
    }
    const cleanStreet = street.trim();
    return {
      ...resolved,
      region: resolved.region,
      street: cleanStreet,
      full: [cleanStreet, resolved.wardName, resolved.provinceName].join(', '),
    };
  }

  private assertPublishable(row: Pick<ShowroomRow, 'slug' | 'provinceCode' | 'street' | 'phone' | 'openingHours'>) {
    const missing = missingForPublic(row);
    if (missing.length > 0) {
      invalid([{ field: 'isPublic', message: `Chưa đủ thông tin để hiện trên website: ${missing.join(', ')}` }]);
    }
  }

  private async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const found = await this.db.location.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  }

  /** Mã nội bộ (cột code, bắt buộc và duy nhất): người dùng không cần biết, sinh từ slug */
  private async uniqueCode(slug: string): Promise<string> {
    const base = `SR-${slug.toUpperCase()}`.slice(0, 28);
    for (let index = 1; index <= 99; index += 1) {
      const candidate = index === 1 ? base : `${base}-${index}`;
      const found = await this.db.location.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!found) return candidate;
    }
    return `SR-${Date.now().toString(36).toUpperCase()}`;
  }

  /**
   * Link cũ đã chia sẻ chuyển 301 sang slug mới. Cùng quy tắc với sản phẩm (ProductService.redirectSlug):
   * không tạo chuỗi A→B→C, và xóa redirect xuất phát từ đường dẫn mới để không bị vòng lặp.
   */
  private async redirectSlug(tx: Tx, oldSlug: string, newSlug: string, staffId: string) {
    const fromPath = showroomPath(oldSlug);
    const toPath = showroomPath(newSlug);
    await tx.urlRedirect.deleteMany({ where: { fromPath: toPath } });
    await tx.urlRedirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
    await tx.urlRedirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 301, createdById: staffId },
      update: { toPath },
    });
  }

  private toListItem(row: ShowroomRow): ShowroomListItem {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      slug: row.slug,
      address: row.address,
      phone: row.phone,
      region: row.region,
      isActive: row.isActive,
      isPublic: row.isPublic,
      sortOrder: row.sortOrder,
      coverUrl: row.imageUrls[0] ?? null,
      missing: missingForPublic(row),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: ShowroomRow, orderCount: number): ShowroomDetail {
    return {
      ...this.toListItem(row),
      provinceCode: row.provinceCode,
      provinceName: row.provinceName,
      wardCode: row.wardCode,
      wardName: row.wardName,
      street: row.street,
      email: row.email,
      latitude: row.latitude,
      longitude: row.longitude,
      googleMapsUrl: row.googleMapsUrl,
      openingHours: readOpeningHours(row.openingHours),
      description: row.description,
      imageUrls: row.imageUrls,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      orderCount,
    };
  }
}