import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ktm/database';
import type { Redis } from 'ioredis';
import {
  ErrorCode,
  SETTING_DEFINITIONS,
  SETTING_GROUP_CODES,
  readSettingValue,
  settingDefinition,
  settingKeysOf,
  type CompanyInfo,
  type SettingGroupCode,
  type SettingGroupData,
  type SettingsResponse,
  type SettingsUpdateInput,
  type SettingValues,
} from '@ktm/shared';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { mapPrismaError } from '../common/errors/prisma-error';
import { PRISMA } from '../database/database.module';
import { REDIS } from '../redis/redis.module';

/** Cache dùng chung giữa các instance API. Đổi hậu tố khi đổi cấu trúc dữ liệu cache */
const CACHE_KEY = 'settings:values:v1';
/**
 * Lưu xong là xóa cache ngay. TTL ngắn chỉ để tự sửa trường hợp hiếm: một request đọc database
 * TRƯỚC lúc lưu nhưng ghi cache SAU lúc xóa -> cache cũ tồn tại tối đa 60 giây.
 */
const CACHE_TTL_SECONDS = 60;

const KNOWN_KEYS = SETTING_DEFINITIONS.map((definition) => definition.key);

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly audit: AuditService,
  ) {}

  // ================= Đọc (dùng ở mọi module) =================

  /** Toàn bộ cấu hình đã khai báo, giá trị đã kiểm tra theo schema (sai thì lấy mặc định) */
  async values(): Promise<SettingValues> {
    const raw = await this.loadRaw();
    return Object.fromEntries(SETTING_DEFINITIONS.map((definition) => [definition.key, readSettingValue(definition, raw[definition.key])]));
  }

  async number(key: string): Promise<number> {
    const value = (await this.values())[key];
    if (typeof value !== 'number') throw new Error(`Cấu hình "${key}" không phải số hoặc chưa khai báo trong registry`);
    return value;
  }

  async text(key: string): Promise<string> {
    const value = (await this.values())[key];
    if (typeof value !== 'string') throw new Error(`Cấu hình "${key}" không phải chuỗi hoặc chưa khai báo trong registry`);
    return value;
  }

  /** Thông tin công ty mới nhất (trang in báo giá, sau này là hóa đơn, chân trang website) */
  async companyInfo(): Promise<CompanyInfo> {
    const values = await this.values();
    const read = (key: string) => {
      const value = values[`company.${key}`];
      return typeof value === 'string' ? value : '';
    };
    return {
      name: read('name'),
      brandName: read('brand_name'),
      taxCode: read('tax_code'),
      address: read('address'),
      hotline: read('hotline'),
      email: read('email'),
      website: read('website'),
      logoUrl: read('logo_url'),
      bankName: read('bank_name'),
      bankAccount: read('bank_account'),
      bankAccountName: read('bank_account_name'),
    };
  }

  // ================= Trang Cấu hình =================

  async listGroups(): Promise<SettingsResponse> {
    const [values, rows] = await Promise.all([
      this.values(),
      this.db.systemSetting.findMany({
        where: { key: { in: KNOWN_KEYS } },
        select: { key: true, updatedAt: true, updatedBy: { select: { id: true, fullName: true } } },
      }),
    ]);
    return {
      groups: SETTING_GROUP_CODES.map((code) => this.groupData(code, values, rows)),
    };
  }

  async updateGroup(code: SettingGroupCode, input: SettingsUpdateInput, staffId: string, ctx: AuditContext): Promise<SettingGroupData> {
    const keys = settingKeysOf(code);
    let changes: { key: string; before: unknown; after: string | number }[] = [];

    try {
      await this.db.$transaction(async (tx) => {
        // Khóa theo nhóm: hai người bấm Lưu cùng lúc thì người sau chờ, rồi bị chặn ở bước so thời gian.
        // Không khóa theo dòng được vì khóa seo.* có thể chưa có dòng nào.
        await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`settings:${code}`}))`;

        const rows = await tx.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true, updatedAt: true } });
        const current = this.lastUpdatedAt(rows);
        const expected = input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt).getTime() : null;
        if ((current?.getTime() ?? null) !== expected) {
          throw new AppException(ErrorCode.EDIT_CONFLICT, HttpStatus.CONFLICT);
        }

        changes = Object.entries(input.values)
          // Zod không đưa khóa vắng mặt vào values, lọc thêm cho chắc
          .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
          .map(([key, after]) => {
            const definition = settingDefinition(key);
            const stored = rows.find((row) => row.key === key)?.value;
            const before = definition ? readSettingValue(definition, stored) : stored;
            return { key, before, after };
          })
          // Chỉ ghi khóa thật sự đổi, để "người sửa gần nhất" và nhật ký phản ánh đúng
          .filter((change) => change.before !== change.after);

        for (const change of changes) {
          const value: Prisma.InputJsonValue = change.after;
          await tx.systemSetting.upsert({
            where: { key: change.key },
            create: { key: change.key, value, description: settingDefinition(change.key)?.label, updatedById: staffId },
            update: { value, updatedById: staffId },
          });
        }
      });
    } catch (error) {
      if (error instanceof AppException) throw error;
      mapPrismaError(error);
    }

    if (changes.length > 0) {
      await this.invalidate();
      await this.audit.log({
        staffId,
        action: 'setting.update',
        entityType: 'SETTING',
        changes: {
          group: code,
          before: Object.fromEntries(changes.map((change) => [change.key, change.before])),
          after: Object.fromEntries(changes.map((change) => [change.key, change.after])),
        },
        ctx,
      });
    }

    const [values, rows] = await Promise.all([
      this.values(),
      this.db.systemSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, updatedAt: true, updatedBy: { select: { id: true, fullName: true } } },
      }),
    ]);
    return this.groupData(code, values, rows);
  }

  // ================= Nội bộ =================

  private groupData(
    code: SettingGroupCode,
    values: SettingValues,
    rows: { key: string; updatedAt: Date; updatedBy: { id: string; fullName: string } | null }[],
  ): SettingGroupData {
    const keys = settingKeysOf(code);
    const groupRows = rows.filter((row) => keys.includes(row.key));
    const latest = groupRows.reduce<(typeof groupRows)[number] | null>(
      (best, row) => (!best || row.updatedAt > best.updatedAt ? row : best),
      null,
    );
    return {
      code,
      values: Object.fromEntries(keys.map((key) => [key, values[key] ?? ''])),
      updatedAt: latest?.updatedAt.toISOString() ?? null,
      updatedBy: latest?.updatedBy ?? null,
    };
  }

  private lastUpdatedAt(rows: { updatedAt: Date }[]): Date | null {
    return rows.reduce<Date | null>((max, row) => (!max || row.updatedAt > max ? row.updatedAt : max), null);
  }

  /** Đọc giá trị thô: Redis trước, lỗi Redis thì đọc thẳng database (cấu hình không được làm sập nghiệp vụ) */
  private async loadRaw(): Promise<Record<string, unknown>> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(`Không đọc được cache cấu hình: ${(error as Error).message}`);
    }

    const rows = await this.db.systemSetting.findMany({ where: { key: { in: KNOWN_KEYS } }, select: { key: true, value: true } });
    const raw = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(raw), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Không ghi được cache cấu hình: ${(error as Error).message}`);
    }
    return raw;
  }

  private async invalidate() {
    try {
      await this.redis.del(CACHE_KEY);
    } catch (error) {
      // Không xóa được thì cache cũ tự hết hạn sau CACHE_TTL_SECONDS
      this.logger.warn(`Không xóa được cache cấu hình: ${(error as Error).message}`);
    }
  }
}