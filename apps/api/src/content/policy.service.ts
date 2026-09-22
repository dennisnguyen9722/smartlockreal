import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  POLICY_CODES,
  htmlPlainText,
  type PolicyCode,
  type PolicySummary,
  type PolicyVersionCreateInput,
  type PolicyVersionDetail,
  type PolicyVersionItem,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { sanitizeRichHtml } from '../common/rich-text';
import { PRISMA } from '../database/database.module';

function invalid(field: string, message: string): never {
  throw new AppException(ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST, [{ field, message }]);
}

/** Cho phép lệch đồng hồ giữa trình duyệt và máy chủ khi chọn "hiệu lực ngay" */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const ITEM_SELECT = {
  id: true,
  code: true,
  version: true,
  title: true,
  effectiveAt: true,
  createdAt: true,
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PolicyVersionSelect;

type ItemRow = Prisma.PolicyVersionGetPayload<{ select: typeof ITEM_SELECT }>;

/**
 * Chính sách theo phiên bản. KHÔNG có sửa/xóa: database có trigger chặn UPDATE/DELETE trên policy_versions.
 * Sửa chính sách = tạo phiên bản mới. Bản đang hiện = bản có effectiveAt mới nhất nhưng không sau hiện tại.
 */
@Injectable()
export class PolicyService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  /** Tổng quan từng loại chính sách: bản đang hiện, bản sắp có hiệu lực */
  async summary(): Promise<PolicySummary[]> {
    const rows = await this.db.policyVersion.findMany({ orderBy: { effectiveAt: 'desc' }, select: ITEM_SELECT });
    const now = new Date();
    return POLICY_CODES.map((code) => {
      const versions = rows.filter((row) => row.code === code);
      const items = this.markCurrent(versions, now);
      return {
        code,
        current: items.find((item) => item.isCurrent) ?? null,
        // Bản sắp hiệu lực gần nhất (danh sách đang xếp mới -> cũ nên lấy phần tử cuối trong nhóm tương lai)
        upcoming: items.filter((item) => item.isUpcoming).at(-1) ?? null,
        versionCount: versions.length,
      };
    });
  }

  async versions(code: PolicyCode): Promise<PolicyVersionItem[]> {
    const rows = await this.db.policyVersion.findMany({ where: { code }, orderBy: { effectiveAt: 'desc' }, select: ITEM_SELECT });
    return this.markCurrent(rows, new Date());
  }

  async getById(id: string): Promise<PolicyVersionDetail> {
    const row = await this.db.policyVersion.findUnique({ where: { id }, select: { ...ITEM_SELECT, contentHtml: true } });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    const item = (await this.versions(row.code as PolicyCode)).find((version) => version.id === id);
    return { ...(item as PolicyVersionItem), content: row.contentHtml };
  }

  async create(input: PolicyVersionCreateInput, staffId: string, ctx: AuditContext): Promise<PolicyVersionDetail> {
    const contentHtml = sanitizeRichHtml(input.content);
    if (!htmlPlainText(contentHtml)) invalid('content', 'Chưa có nội dung chính sách');

    const now = new Date();
    const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : now;
    // Không cho lùi ngày: bản mới không được "có hiệu lực từ trước" khi khách đã đồng ý bản khác
    if (effectiveAt.getTime() < now.getTime() - CLOCK_SKEW_MS) invalid('effectiveAt', 'Ngày hiệu lực không được ở quá khứ');

    const duplicate = await this.db.policyVersion.findUnique({
      where: { code_version: { code: input.code, version: input.version } },
      select: { id: true },
    });
    if (duplicate) invalid('version', 'Số phiên bản này đã có, hãy đặt số khác');

    let id: string;
    try {
      const created = await this.db.policyVersion.create({
        data: {
          code: input.code,
          version: input.version,
          title: input.title,
          contentHtml,
          effectiveAt: effectiveAt < now ? now : effectiveAt,
          createdById: staffId,
        },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      if (error instanceof AppException) throw error;
      mapPrismaError(error);
    }

    await this.audit.log({
      staffId,
      action: 'policy.create_version',
      entityType: 'POLICY_VERSION',
      entityId: id,
      changes: { after: { code: input.code, version: input.version, title: input.title, effectiveAt } },
      ctx,
    });
    return this.getById(id);
  }

  // ================= Nội bộ =================

  /** rows xếp mới -> cũ theo effectiveAt. Bản đầu tiên đã tới hiệu lực là bản đang hiện */
  private markCurrent(rows: ItemRow[], now: Date): PolicyVersionItem[] {
    const currentId = rows.find((row) => row.effectiveAt <= now)?.id;
    return rows.map((row) => ({
      id: row.id,
      code: row.code as PolicyCode,
      version: row.version,
      title: row.title,
      effectiveAt: row.effectiveAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      isCurrent: row.id === currentId,
      isUpcoming: row.effectiveAt > now,
    }));
  }
}