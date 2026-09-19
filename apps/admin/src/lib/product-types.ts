import type {
  HighlightGroup,
  ProductDeleteBlock,
  ProductStatusValue,
  ProductTypeValue,
} from '@ktm/shared';

/** Khớp summarizeUsage() trong apps/api/src/catalog/variant-usage.ts */
export interface VariantUsage {
  orderLines: number;
  quoteLines: number;
  receiptLines: number;
  transferLines: number;
  stocktakeLines: number;
  stockLevels: number;
  serialUnits: number;
  saleItems: number;
  giftItems: number;
  usedInBundles: number;
  documents: number;
  references: number;
  /** true = không đổi được SKU và cách quản lý serial */
  locked: boolean;
  /** true = xóa hẳn được; false = chỉ tắt */
  deletable: boolean;
}

export interface ProductOptionValueDetail {
  id: string;
  optionId: string;
  code: string;
  value: string;
  sortOrder: number;
}

export interface ProductOptionDetail {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  values: ProductOptionValueDetail[];
}

export interface ProductVariantDetail {
  id: string;
  sku: string;
  name: string;
  optionKey: string;
  /** VND, chưa VAT (API đã đổi BigInt sang số) */
  price: number;
  compareAtPrice: number | null;
  barcode: string | null;
  weightGrams: number | null;
  trackSerial: boolean;
  isActive: boolean;
  sortOrder: number;
  vatRateBps: number;
  optionValues: { optionValue: ProductOptionValueDetail }[];
  bundleItemCount: number;
  usage: VariantUsage;
}

export interface ProductMediaDetail {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  variantId: string | null;
  variant: { id: string; sku: string; name: string } | null;
}

export interface ReadinessIssue {
  field: string;
  message: string;
}

export interface ProductDetail {
  id: string;
  type: ProductTypeValue;
  status: ProductStatusValue;
  name: string;
  slug: string;
  brandId: string | null;
  categoryId: string;
  installationClassId: string | null;
  manufacturerCode: string | null;
  shortDescription: string | null;
  description: string | null;
  specs: Record<string, unknown>;
  highlights: HighlightGroup[];
  warrantyMonths: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string; slug: string; isActive: boolean } | null;
  category: { id: string; name: string; slug: string; isActive: boolean };
  installationClass: { id: string; code: string; name: string } | null;
  options: ProductOptionDetail[];
  variants: ProductVariantDetail[];
  media: ProductMediaDetail[];
  /** Những điều còn thiếu để đăng bán; rỗng = đăng bán được */
  readiness: ReadinessIssue[];
  /** null = xóa hẳn được; có giá trị = lý do không xóa được */
  deletionBlock: ProductDeleteBlock | null;
}