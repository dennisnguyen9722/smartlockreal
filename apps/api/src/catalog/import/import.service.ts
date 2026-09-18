import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import type { PrismaClient } from '@ktm/database';
import {
  buildOptionKey,
  buildSku,
  ErrorCode,
  parseOptionValues,
  slugifyVi,
  validateSpecs,
  toJsonSafe,
  type JsonObject,
  type ImportPreviewResult,
  type ImportPreviewRow,
  type ImportRowIssue,
  type SpecDefinitionShape,
} from '@ktm/shared';
import { AppException } from '../../common/errors/app.exception';
import { generateUniqueSlug } from '../../common/slug.util';
import { PRISMA } from '../../database/database.module';
import { REDIS } from '../../redis/redis.module';
import { SpecDefinitionService } from '../spec-definition.service';
import type { RawImportRow } from './parser.service';

const SESSION_TTL_SECONDS = 30 * 60;

/** Kế hoạch ghi, lưu trong Redis giữa bước xem trước và bước xác nhận */
export interface ImportPlan {
  staffId: string;
  createdAt: string;
  products: PlannedProduct[];
}

interface PlannedProduct {
  productCode: string;
  existingProductId: string | null;
  slug: string;
  name: string;
  type: string;
  brandId: string | null;
  categoryId: string;
  manufacturerCode: string | null;
  shortDescription: string | null;
  warrantyMonths: number;
  specs: Record<string, unknown>;
  /** Tùy chọn cần tạo cho sản phẩm mới: { code, name, values: [{code, value}] } */
  options: { code: string; name: string; values: { code: string; value: string }[] }[];
  variants: PlannedVariant[];
}

interface PlannedVariant {
  rowNumber: number;
  existingVariantId: string | null;
  sku: string;
  name: string;
  optionKey: string;
  optionValues: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  vatRateBps: number;
  trackSerial: boolean;
  weightGrams: number | null;
}

@Injectable()
export class ImportService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly specs: SpecDefinitionService,
  ) {}

  async preview(rows: RawImportRow[], staffId: string): Promise<ImportPreviewResult> {
    const [brands, categories] = await Promise.all([
      this.db.brand.findMany({ select: { id: true, slug: true } }),
      this.db.category.findMany({ select: { id: true, slug: true } }),
    ]);
    const brandBySlug = new Map(brands.map((brand) => [brand.slug, brand.id]));
    const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

    // Khuôn thông số của từng danh mục, lấy một lần để dùng lại
    const shapesByCategory = new Map<string, SpecDefinitionShape[]>();
    const previewRows: ImportPreviewRow[] = [];
    const groups = new Map<string, RawImportRow[]>();

    for (const row of rows) {
      const code = row.fields.productCode?.trim();
      if (!code) {
        previewRows.push(this.errorRow(row, [{ column: 'Mã sản phẩm', message: 'Bắt buộc nhập' }]));
        continue;
      }
      const list = groups.get(code) ?? [];
      list.push(row);
      groups.set(code, list);
    }

    const plan: ImportPlan = { staffId, createdAt: new Date().toISOString(), products: [] };

    for (const [productCode, groupRows] of groups) {
      const head = groupRows[0];
      if (!head) continue;
      const headIssues: ImportRowIssue[] = [];

      const name = head.fields.name?.trim();
      if (!name) headIssues.push({ column: 'Tên sản phẩm', message: 'Bắt buộc nhập' });

      const type = (head.fields.type || '').trim().toUpperCase();
      if (!['LOCK', 'ACCESSORY', 'SERVICE', 'BUNDLE'].includes(type)) {
        headIssues.push({ column: 'Loại', message: 'Phải là LOCK, ACCESSORY, SERVICE hoặc BUNDLE' });
      }

      const categoryId = categoryBySlug.get(head.fields.categoryCode?.trim() ?? '');
      if (!categoryId) {
        headIssues.push({ column: 'Mã danh mục', message: 'Không tìm thấy, xem trang Tham chiếu' });
      }

      const brandCode = head.fields.brandCode?.trim();
      const brandId = brandCode ? brandBySlug.get(brandCode) : undefined;
      if (brandCode && !brandId) {
        headIssues.push({ column: 'Mã hãng', message: 'Không tìm thấy, xem trang Tham chiếu' });
      }
      if (type === 'LOCK' && !brandId) {
        headIssues.push({ column: 'Mã hãng', message: 'Khóa bắt buộc có hãng' });
      }

      if (headIssues.length > 0 || !categoryId) {
        for (const row of groupRows) previewRows.push(this.errorRow(row, headIssues));
        continue;
      }

      // Thông số: đổi từ tên cột sang mã, rồi kiểm tra theo khuôn danh mục
      if (!shapesByCategory.has(categoryId)) {
        shapesByCategory.set(categoryId, await this.specs.getShapes(categoryId));
      }
      const shapes = shapesByCategory.get(categoryId) ?? [];
      const specsInput: Record<string, unknown> = {};
      const specIssues: ImportRowIssue[] = [];

      for (const [specName, value] of Object.entries(head.specsByName)) {
        const shape = shapes.find((item) => item.name === specName);
        if (!shape) {
          specIssues.push({ column: specName, message: 'Thông số không thuộc danh mục này' });
          continue;
        }
        specsInput[shape.code] = value;
      }
      const specResult = validateSpecs(shapes, specsInput);
      for (const error of specResult.errors) {
        const code = error.field.replace('specs.', '');
        const shape = shapes.find((item) => item.code === code);
        // Thông báo đã có tên thông số ở đầu, nên bỏ phần trùng đi
        specIssues.push({
          column: shape?.name ?? code,
          message: error.message.replace(`${shape?.name ?? ''}: `, ''),
        });
      }

      if (specIssues.length > 0) {
        for (const row of groupRows) previewRows.push(this.errorRow(row, specIssues));
        continue;
      }

      // Xác định sản phẩm đã có: dựa vào SKU trong file
      const providedSkus = groupRows
        .map((row) => row.fields.sku?.trim().toUpperCase())
        .filter((sku): sku is string => Boolean(sku));

      const existingVariants = providedSkus.length
        ? await this.db.productVariant.findMany({
            where: { sku: { in: providedSkus } },
            select: { id: true, sku: true, productId: true },
          })
        : [];

      const productIds = new Set(existingVariants.map((variant) => variant.productId));
      if (productIds.size > 1) {
        for (const row of groupRows) {
          previewRows.push(
            this.errorRow(row, [
              { column: 'SKU', message: 'Các SKU trong nhóm đang thuộc nhiều sản phẩm khác nhau' },
            ]),
          );
        }
        continue;
      }

      const existingProductId = [...productIds][0] ?? null;
      const existingProduct = existingProductId
        ? await this.db.product.findUnique({
            where: { id: existingProductId },
            include: { options: { include: { values: true } } },
          })
        : null;

      const slug =
        existingProduct?.slug ??
        (await generateUniqueSlug(name ?? productCode, async (candidate) =>
          Boolean(await this.db.product.findUnique({ where: { slug: candidate }, select: { id: true } })),
        ));

      // Tùy chọn: gom từ mọi dòng trong nhóm
      const optionMap = new Map<string, { name: string; values: Map<string, string> }>();
      const plannedVariants: PlannedVariant[] = [];
      let groupHasError = false;

      for (const row of groupRows) {
        const issues: ImportRowIssue[] = [];
        const variantName = row.fields.variantName?.trim();
        if (!variantName) issues.push({ column: 'Tên biến thể', message: 'Bắt buộc nhập' });

        const priceText = (row.fields.price || '').replace(/[.,\s]/g, '');
        const price = Number(priceText);
        if (!priceText || !Number.isInteger(price) || price < 0) {
          issues.push({ column: 'Giá bán', message: 'Phải là số nguyên không âm' });
        }

        let compareAtPrice: number | null = null;
        const compareText = (row.fields.compareAtPrice || '').replace(/[.,\s]/g, '');
        if (compareText) {
          compareAtPrice = Number(compareText);
          if (!Number.isInteger(compareAtPrice) || compareAtPrice <= price) {
            issues.push({ column: 'Giá gạch ngang', message: 'Phải là số nguyên lớn hơn giá bán' });
          }
        }

        const parsed = parseOptionValues(row.fields.optionValues ?? '');
        for (const error of parsed.errors) issues.push({ column: 'Tùy chọn', message: error });

        for (const [optionCode, valueCode] of Object.entries(parsed.values)) {
          const label = parsed.labels[`${optionCode}:${valueCode}`] ?? valueCode;
          const option = optionMap.get(optionCode) ?? { name: optionCode, values: new Map() };
          option.values.set(valueCode, label);
          optionMap.set(optionCode, option);

          // Sản phẩm đã có thì giá trị tùy chọn phải khớp với những gì đã khai báo
          if (existingProduct) {
            const known = existingProduct.options.find((item) => item.code === optionCode);
            if (!known) {
              issues.push({ column: 'Tùy chọn', message: `Sản phẩm chưa có tùy chọn "${optionCode}"` });
            } else if (!known.values.some((value) => value.code === valueCode)) {
              issues.push({
                column: 'Tùy chọn',
                message: `Tùy chọn "${optionCode}" chưa có giá trị "${valueCode}"`,
              });
            }
          }
        }

        const vatText = (row.fields.vatRate || '').replace(',', '.');
        const vatRateBps = vatText ? Math.round(Number(vatText) * 100) : 1000;
        if (!Number.isInteger(vatRateBps) || vatRateBps < 0 || vatRateBps > 10000) {
          issues.push({ column: 'Thuế VAT', message: 'Phải từ 0 đến 100' });
        }

        const weightText = (row.fields.weightGrams || '').replace(/[.,\s]/g, '');
        const weightGrams = weightText ? Number(weightText) : null;
        if (weightText && (!Number.isInteger(weightGrams) || (weightGrams ?? 0) <= 0)) {
          issues.push({ column: 'Cân nặng', message: 'Phải là số nguyên dương' });
        }

        const sku = (row.fields.sku?.trim() || buildSku(slug, parsed.values)).toUpperCase();
        if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(sku)) {
          issues.push({ column: 'SKU', message: 'Chỉ gồm chữ IN HOA, số và gạch ngang' });
        }

        const trackSerialText = (row.fields.trackSerial || '').toLowerCase();
        const trackSerial = trackSerialText
          ? ['có', 'co', 'true', '1'].includes(trackSerialText)
          : type === 'LOCK';

        const existing = existingVariants.find((variant) => variant.sku === sku);

        if (issues.length > 0) {
          groupHasError = true;
          previewRows.push(this.errorRow(row, issues));
          continue;
        }

        plannedVariants.push({
          rowNumber: row.rowNumber,
          existingVariantId: existing?.id ?? null,
          sku,
          name: variantName ?? '',
          optionKey: buildOptionKey(parsed.values),
          optionValues: parsed.values,
          price,
          compareAtPrice,
          vatRateBps,
          trackSerial,
          weightGrams,
        });

        previewRows.push({
          rowNumber: row.rowNumber,
          productCode,
          productName: name ?? '',
          sku,
          variantName: variantName ?? '',
          status: existing ? 'UPDATE' : 'CREATE',
          issues: [],
        });
      }

      // Hai dòng cùng SKU trong một file
      const skus = plannedVariants.map((variant) => variant.sku);
      const duplicated = skus.filter((sku, index) => skus.indexOf(sku) !== index);
      if (duplicated.length > 0) {
        groupHasError = true;
        for (const row of previewRows.filter((item) => duplicated.includes(item.sku))) {
          row.status = 'ERROR';
          row.issues.push({ column: 'SKU', message: 'Trùng với dòng khác trong file' });
        }
      }

      if (groupHasError) continue;

      plan.products.push({
        productCode,
        existingProductId,
        slug,
        name: name ?? '',
        type,
        brandId: brandId ?? null,
        categoryId,
        manufacturerCode: head.fields.manufacturerCode?.trim() || null,
        shortDescription: head.fields.shortDescription?.trim() || null,
        warrantyMonths: Number(head.fields.warrantyMonths || 0) || 0,
        specs: specResult.value,
        options: existingProduct
          ? []
          : [...optionMap.entries()].map(([code, option]) => ({
              code,
              name: option.name,
              values: [...option.values.entries()].map(([valueCode, label]) => ({
                code: valueCode,
                value: label,
              })),
            })),
        variants: plannedVariants,
      });
    }

    previewRows.sort((a, b) => a.rowNumber - b.rowNumber);
    const errorCount = previewRows.filter((row) => row.status === 'ERROR').length;

    const sessionId = randomUUID();
    // Chỉ lưu kế hoạch khi không có lỗi, vì có lỗi thì không ghi gì cả
    if (errorCount === 0) {
      await this.redis.set(
        ImportService.sessionKey(sessionId),
        JSON.stringify(plan),
        'EX',
        SESSION_TTL_SECONDS,
      );
    }

    return {
      sessionId,
      totalRows: previewRows.length,
      productsToCreate: plan.products.filter((product) => !product.existingProductId).length,
      productsToUpdate: plan.products.filter((product) => product.existingProductId).length,
      variantsToCreate: previewRows.filter((row) => row.status === 'CREATE').length,
      variantsToUpdate: previewRows.filter((row) => row.status === 'UPDATE').length,
      errorCount,
      rows: previewRows,
    };
  }

    async apply(sessionId: string, staffId: string) {
    const raw = await this.redis.get(ImportService.sessionKey(sessionId));
    if (!raw) {
      throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, {
        message: 'Phiên nhập đã hết hạn hoặc không tồn tại. Hãy tải file lên lại.',
      });
    }

    const plan = JSON.parse(raw) as ImportPlan;
    if (plan.staffId !== staffId) {
      throw new AppException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, {
        message: 'Phiên nhập này thuộc về người khác',
      });
    }

    let productsCreated = 0;
    let productsUpdated = 0;
    let variantsCreated = 0;
    let variantsUpdated = 0;

    // Một transaction cho toàn bộ: có lỗi thì không ghi dòng nào
    await this.db.$transaction(
      async (tx) => {
        for (const product of plan.products) {
          let productId = product.existingProductId;

          if (productId) {
            await tx.product.update({
              where: { id: productId },
              data: {
                name: product.name,
                brandId: product.brandId,
                categoryId: product.categoryId,
                manufacturerCode: product.manufacturerCode,
                shortDescription: product.shortDescription,
                warrantyMonths: product.warrantyMonths,
                specs: toJsonSafe(product.specs) as JsonObject,
              },
            });
            productsUpdated += 1;
          } else {
            const created = await tx.product.create({
              data: {
                type: product.type as 'LOCK' | 'ACCESSORY' | 'SERVICE' | 'BUNDLE',
                slug: product.slug,
                name: product.name,
                brandId: product.brandId,
                categoryId: product.categoryId,
                manufacturerCode: product.manufacturerCode,
                shortDescription: product.shortDescription,
                warrantyMonths: product.warrantyMonths,
                specs: toJsonSafe(product.specs) as JsonObject,
              },
            });
            productId = created.id;
            productsCreated += 1;

            for (const [index, option] of product.options.entries()) {
              const createdOption = await tx.productOption.create({
                data: { productId, code: option.code, name: option.name, sortOrder: index },
              });
              for (const [valueIndex, value] of option.values.entries()) {
                await tx.productOptionValue.create({
                  data: {
                    optionId: createdOption.id,
                    code: value.code,
                    value: value.value,
                    sortOrder: valueIndex,
                  },
                });
              }
            }
          }

          // Lấy id của giá trị tùy chọn để gắn cho biến thể
          const optionValues = await tx.productOptionValue.findMany({
            where: { option: { productId } },
            include: { option: { select: { code: true } } },
          });
          const valueIdByKey = new Map(
            optionValues.map((value) => [`${value.option.code}:${value.code}`, value.id]),
          );

          for (const [index, variant] of product.variants.entries()) {
            const data = {
              name: variant.name,
              price: BigInt(variant.price),
              compareAtPrice: variant.compareAtPrice != null ? BigInt(variant.compareAtPrice) : null,
              vatRateBps: variant.vatRateBps,
              trackSerial: variant.trackSerial,
              weightGrams: variant.weightGrams,
            };

            if (variant.existingVariantId) {
              await tx.productVariant.update({ where: { id: variant.existingVariantId }, data });
              variantsUpdated += 1;
            } else {
              const createdVariant = await tx.productVariant.create({
                data: {
                  ...data,
                  productId,
                  sku: variant.sku,
                  optionKey: variant.optionKey,
                  sortOrder: index,
                },
              });
              for (const [optionCode, valueCode] of Object.entries(variant.optionValues)) {
                const optionValueId = valueIdByKey.get(`${optionCode}:${valueCode}`);
                if (optionValueId) {
                  await tx.variantOptionValue.create({
                    data: { variantId: createdVariant.id, optionValueId },
                  });
                }
              }
              variantsCreated += 1;
            }
          }
        }
      },
      // File lớn cần nhiều thời gian hơn mặc định
      { timeout: 120_000, maxWait: 10_000 },
    );

    // Dùng xong xóa ngay, tránh ghi hai lần khi bấm nút nhiều lần
    await this.redis.del(ImportService.sessionKey(sessionId));

    return { productsCreated, productsUpdated, variantsCreated, variantsUpdated };
  }

  static sessionKey(sessionId: string): string {
    return `import:product:${sessionId}`;
  }

  private errorRow(row: RawImportRow, issues: ImportRowIssue[]): ImportPreviewRow {
    return {
      rowNumber: row.rowNumber,
      productCode: row.fields.productCode ?? '',
      productName: row.fields.name ?? '',
      sku: row.fields.sku ?? '',
      variantName: row.fields.variantName ?? '',
      status: 'ERROR',
      issues,
    };
  }
}
