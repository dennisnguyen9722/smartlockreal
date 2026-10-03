import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Prisma, PrismaClient } from '@ktm/database';
import {
  ErrorCode,
  FAQ_GROUP_LABEL,
  POLICY_INFO,
  type FaqGroupCode,
  type PolicyCode,
  type StorefrontPolicy,
  type StorefrontPolicyDetail,
  type OpeningHoursEntry,
  type Paginated,
  type ReviewPhoto,
  type StorefrontBanner,
  type StorefrontBrand,
  type StorefrontCard,
  type StorefrontFaq,
  type StorefrontHome,
  type StorefrontListQuery,
  type StorefrontPost,
  type StorefrontPostCategory,
  type StorefrontPostDetail,
  type StorefrontPostList,
  type StorefrontPostListQuery,
  type StorefrontProduct,
  type StorefrontReview,
  type StorefrontShowroom,
  type StorefrontShowroomDetail,
  type StorefrontTaxonomy,
  directionsUrl,
  formatOpeningHours,
  mapEmbedUrl,
} from '@ktm/shared';
import { AppException } from '../common/errors/app.exception';
import { PRISMA } from '../database/database.module';
import { REDIS } from '../redis/redis.module';
import { SettingsService } from '../settings/settings.service';
import { SpecDefinitionService } from '../catalog/spec-definition.service';

// Đổi v1 -> v2 vì hình dạng dữ liệu đổi: bản cũ còn trong Redis sẽ thiếu
// showrooms/reviews/posts/faqs và làm website vỡ cho tới khi hết hạn.
const HOME_CACHE_KEY = 'storefront:home:v2';
const HOME_CACHE_SECONDS = 60;
const FEATURED_COUNT = 8;
/** Mỗi hãng một dải ở cuối trang: 4 sản phẩm vừa đúng một hàng trên máy tính */
const BRAND_PRODUCT_COUNT = 4;
const BRAND_SECTION_MAX = 6;
const REVIEW_COUNT = 9;
const POST_COUNT = 3;
const FAQ_COUNT = 8;
const RELATED_POST_COUNT = 3;
/** Chỉ khoe đánh giá từ 4 sao trở lên và có viết nội dung */
const REVIEW_MIN_RATING = 4;

/** BigInt sang number: tiền VND luôn dưới 2^53 nên không mất chính xác */
function money(value: bigint | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

@Injectable()
export class StorefrontService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly settings: SettingsService,
    private readonly specs: SpecDefinitionService,
  ) {}

  // ================= Trang chủ =================

  async home(): Promise<StorefrontHome> {
    const cached = await this.redis.get(HOME_CACHE_KEY);
    if (cached) return JSON.parse(cached) as StorefrontHome;

    const now = new Date();
    const [
      doorTypes,
      brands,
      banners,
      promoBanners,
      featuredRows,
      newestRows,
      productTotal,
      company,
      showroomRows,
      reviewRows,
      postRows,
      faqRows,
      ratingAgg,
    ] = await Promise.all([
      this.db.doorType.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          description: true,
          _count: { select: { products: { where: { product: { status: 'ACTIVE' } } } } },
        },
      }),
      this.db.brand.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          description: true,
          logoUrl: true,
          countryOfOrigin: true,
          isAuthorized: true,
          _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        },
      }),
      this.activeBanners('HOME_HERO'),
      this.activeBanners('HOME_SECONDARY'),
      // Sản phẩm admin tự chọn, theo đúng thứ tự đã sắp
      this.db.product.findMany({
        where: { ...this.publicWhere({}), isFeatured: true },
        orderBy: [{ featuredOrder: 'asc' }],
        take: FEATURED_COUNT,
        select: this.cardSelect(),
      }),
      // Dự phòng: chưa ai chọn thì lấy hàng mới nhất, trang chủ không được để trống
      this.db.product.findMany({
        where: this.publicWhere({}),
        orderBy: [{ publishedAt: 'desc' }],
        take: FEATURED_COUNT,
        select: this.cardSelect(),
      }),
      this.db.product.count({ where: { status: 'ACTIVE' } }),
      this.settings.companyInfo(),

      // Showroom: Location type STORE, đã bật hiện trên website
      this.db.location.findMany({
        where: { type: 'STORE', isActive: true, isPublic: true, slug: { not: null } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: this.showroomSelect(),
      }),

      // Đánh giá: đã duyệt, từ 4 sao, có viết nội dung, sản phẩm còn đang bán
      this.db.productReview.findMany({
        where: {
          status: 'APPROVED',
          rating: { gte: REVIEW_MIN_RATING },
          content: { not: null },
          product: { status: 'ACTIVE' },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: REVIEW_COUNT,
        select: {
          reviewerName: true,
          rating: true,
          content: true,
          photos: true,
          verifiedPurchase: true,
          createdAt: true,
          product: { select: { slug: true, name: true } },
        },
      }),

      this.db.post.findMany({
        where: { status: 'PUBLISHED', publishedAt: { lte: now } },
        orderBy: [{ publishedAt: 'desc' }],
        take: POST_COUNT,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          coverMedia: { select: { url: true } },
          category: { select: { name: true, slug: true } },
        },
      }),

      // productId null = câu hỏi chung, không gắn vào sản phẩm nào
      this.db.faq.findMany({
        where: { isPublished: true, productId: null },
        orderBy: [{ groupCode: 'asc' }, { sortOrder: 'asc' }],
        take: FAQ_COUNT,
        select: { question: true, answerHtml: true, groupCode: true },
      }),

      this.db.productReview.aggregate({
        where: { status: 'APPROVED' },
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ]);

    const showrooms = showroomRows.map((row) => this.toShowroom(row));

    const featuredIsAuto = featuredRows.length === 0;
    const featuredDung = featuredIsAuto ? newestRows : featuredRows;

    // Mỗi hãng một dải riêng ở cuối trang. Mỗi hãng một truy vấn, nhưng toàn bộ
    // trang chủ đã đệm 60 giây nên tính ra là 5 truy vấn mỗi phút, không đáng kể.
    const hangCoHang = brands.filter((item) => item._count.products > 0).slice(0, BRAND_SECTION_MAX);
    const byBrand = await Promise.all(
      hangCoHang.map(async (item) => ({
        brand: this.toBrand(item, item._count.products),
        products: (
          await this.db.product.findMany({
            where: { ...this.publicWhere({}), brand: { slug: item.slug } },
            orderBy: [{ publishedAt: 'desc' }],
            take: BRAND_PRODUCT_COUNT,
            select: this.cardSelect(),
          })
        ).map((row) => this.toCard(row)),
      })),
    );

    const home: StorefrontHome = {
      doorTypes: doorTypes.map((item) => this.toTaxonomy(item, item._count.products)),
      brands: brands
        .filter((item) => item._count.products > 0)
        .map((item) => this.toBrand(item, item._count.products)),
      banners,
      promoBanners,
      featured: featuredDung.map((row) => this.toCard(row)),
      featuredIsAuto,
      byBrand,
      showrooms,
      reviews: reviewRows.map((row) => this.toReview(row)),
      posts: postRows.map((row) => this.toPost(row)),
      faqs: faqRows.map((row) => this.toFaq(row)),
      company: this.pickCompany(company),
      totals: {
        products: productTotal,
        brands: brands.filter((b) => b._count.products > 0).length,
        showrooms: showrooms.length,
        reviews: ratingAgg._count._all,
        ratingAverage:
          ratingAgg._avg.rating === null ? null : Math.round(ratingAgg._avg.rating * 10) / 10,
      },
    };

    await this.redis.set(HOME_CACHE_KEY, JSON.stringify(home), 'EX', HOME_CACHE_SECONDS);
    return home;
  }

  /** Gọi khi sửa sản phẩm, banner hay cấu hình để trang chủ cập nhật ngay */
  async clearHomeCache() {
    await this.redis.del(HOME_CACHE_KEY);
  }

  // ================= Danh sách sản phẩm =================

  async listProducts(query: StorefrontListQuery): Promise<
    Paginated<StorefrontCard> & { appliedFilters: { doorType?: StorefrontTaxonomy } }
  > {
    const where = this.publicWhere(query);

    // Sắp theo giá dùng cột products.price_from (trigger giữ cho đúng),
    // không sắp trong JavaScript sau khi phân trang — làm vậy thì trang 1
    // chỉ là những cái rẻ nhất TRONG trang đó, không phải rẻ nhất toàn bộ.
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'ban-chay'
        ? [{ ratingCount: 'desc' }, { publishedAt: 'desc' }]
        : query.sort === 'gia-tang'
          ? [{ priceFrom: 'asc' }, { name: 'asc' }]
          : query.sort === 'gia-giam'
            ? [{ priceFrom: 'desc' }, { name: 'asc' }]
            : [{ publishedAt: 'desc' }];

    const [rows, total] = await Promise.all([
      this.db.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: this.cardSelect(),
      }),
      this.db.product.count({ where }),
    ]);

    const items = rows.map((row) => this.toCard(row));

    const doorType = query.doorType
      ? await this.db.doorType.findUnique({
          where: { slug: query.doorType },
          select: {
            slug: true,
            name: true,
            description: true,
            _count: { select: { products: { where: { product: { status: 'ACTIVE' } } } } },
          },
        })
      : null;

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      appliedFilters: {
        ...(doorType ? { doorType: this.toTaxonomy(doorType, doorType._count.products) } : {}),
      },
    };
  }

  async listDoorTypes(): Promise<StorefrontTaxonomy[]> {
    const rows = await this.db.doorType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        slug: true,
        name: true,
        description: true,
        _count: { select: { products: { where: { product: { status: 'ACTIVE' } } } } },
      },
    });
    return rows.map((row) => this.toTaxonomy(row, row._count.products));
  }

  // ================= Bài viết =================

  /** Chỉ lấy bài ĐÃ đăng và đã tới giờ đăng; bài hẹn giờ chưa tới thì website chưa thấy */
  private postWhere(): Prisma.PostWhereInput {
    return { status: 'PUBLISHED', publishedAt: { lte: new Date() } };
  }

  private postSelect() {
    return {
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      coverMedia: { select: { url: true } },
      category: { select: { name: true, slug: true } },
    } as const;
  }

  async listPosts(query: StorefrontPostListQuery): Promise<StorefrontPostList> {
    const where: Prisma.PostWhereInput = {
      ...this.postWhere(),
      ...(query.category ? { category: { slug: query.category } } : {}),
    };

    const [items, total, categoryRows] = await Promise.all([
      this.db.post.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: this.postSelect(),
      }),
      this.db.post.count({ where }),
      this.db.postCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          _count: { select: { posts: { where: this.postWhere() } } },
        },
      }),
    ]);

    const categories: StorefrontPostCategory[] = categoryRows
      // Chuyên mục chưa có bài nào thì không hiện, bấm vào chỉ ra trang trống
      .filter((row) => row._count.posts > 0)
      .map((row) => ({ slug: row.slug, name: row.name, postCount: row._count.posts }));

    return {
      items: items.map((row) => this.toPost(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      categories,
    };
  }

  async getPost(slug: string): Promise<StorefrontPostDetail> {
    const post = await this.db.post.findFirst({
      where: { slug, ...this.postWhere() },
      select: {
        ...this.postSelect(),
        contentHtml: true,
        seoTitle: true,
        seoDescription: true,
        author: { select: { fullName: true } },
        products: {
          // Lọc ngay ở truy vấn: sản phẩm đã lưu trữ hoặc hết biến thể thì không
          // lấy ra, khỏi dẫn khách từ bài viết tới một trang 404.
          where: { product: this.publicWhere({}) },
          orderBy: { sortOrder: 'asc' },
          select: { product: { select: this.cardSelect() } },
        },
      },
    });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const related = post.category
      ? await this.db.post.findMany({
          where: { ...this.postWhere(), category: { slug: post.category.slug }, slug: { not: slug } },
          orderBy: [{ publishedAt: 'desc' }],
          take: RELATED_POST_COUNT,
          select: this.postSelect(),
        })
      : [];

    return {
      ...this.toPost(post),
      contentHtml: post.contentHtml,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      authorName: post.author?.fullName ?? null,
      // Đã lọc ở truy vấn; vẫn chặn biến thể rỗng vì toCard đọc variants[0]
      products: post.products
        .map((link) => link.product)
        .filter((row) => row.variants.length > 0)
        .map((row) => this.toCard(row)),
      related: related.map((row) => this.toPost(row)),
    };
  }

  private toPost(row: {
    slug: string;
    title: string;
    excerpt: string | null;
    publishedAt: Date | null;
    coverMedia: { url: string } | null;
    category: { name: string; slug: string } | null;
  }): StorefrontPost {
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      coverUrl: row.coverMedia?.url ?? null,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  // ================= Showroom =================

  /** Dùng chung cho trang danh sách showroom; trang chủ lấy luôn trong home() */
  /* ========================== Chính sách ========================== */

  /**
   * Đường dẫn trên website ("bao-hanh") -> mã trong database ("WARRANTY").
   * Bảng tra POLICY_INFO nằm ở packages/shared/src/schemas/content.ts, dùng chung
   * với trang quản trị nên hai bên không bao giờ lệch nhau.
   */
  private maChinhSach(slug: string): PolicyCode | null {
    const cac = Object.keys(POLICY_INFO) as PolicyCode[];
    return cac.find((ma) => POLICY_INFO[ma].slug === slug) ?? null;
  }

  /**
   * Danh sách chính sách ĐANG CÓ HIỆU LỰC.
   *
   * Mỗi loại chính sách có nhiều phiên bản. Bản đang hiệu lực là bản có
   * effectiveAt mới nhất nhưng KHÔNG nằm ở tương lai — bản hẹn ngày thì khách
   * chưa được thấy. Lọc ngay trong truy vấn rồi lấy bản đầu tiên của mỗi mã,
   * vì đã sắp xếp mới trước.
   */
  async listPolicies(): Promise<StorefrontPolicy[]> {
    const rows = await this.db.policyVersion.findMany({
      where: { effectiveAt: { lte: new Date() } },
      orderBy: { effectiveAt: 'desc' },
      select: { code: true, version: true, title: true, effectiveAt: true },
    });

    const daCo = new Set<string>();
    const ra: StorefrontPolicy[] = [];
    for (const row of rows) {
      if (daCo.has(row.code)) continue;
      daCo.add(row.code);
      const thongTin = POLICY_INFO[row.code as PolicyCode];
      // Mã lạ trong database (bản cũ, hoặc nhập tay) thì bỏ qua chứ không vỡ trang
      if (!thongTin) continue;
      ra.push({
        slug: thongTin.slug,
        label: thongTin.label,
        title: row.title,
        version: row.version,
        effectiveAt: row.effectiveAt.toISOString(),
      });
    }

    // Sắp theo đúng thứ tự khai trong POLICY_INFO để chân trang lúc nào cũng
    // cùng một thứ tự, không đổi theo ngày ai sửa chính sách nào sau cùng
    const thuTu = Object.values(POLICY_INFO).map((muc) => muc.slug);
    ra.sort((a, b) => thuTu.indexOf(a.slug) - thuTu.indexOf(b.slug));
    return ra;
  }

  async getPolicy(slug: string): Promise<StorefrontPolicyDetail> {
    const ma = this.maChinhSach(slug);
    if (!ma) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    const row = await this.db.policyVersion.findFirst({
      where: { code: ma, effectiveAt: { lte: new Date() } },
      orderBy: { effectiveAt: 'desc' },
      select: { version: true, title: true, contentHtml: true, effectiveAt: true },
    });
    // Loại chính sách có thật nhưng chưa ai soạn bản nào, hoặc bản duy nhất còn
    // hẹn ngày: coi như chưa có trang, trả 404 để web gọi notFound()
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    return {
      slug,
      label: POLICY_INFO[ma].label,
      title: row.title,
      version: row.version,
      effectiveAt: row.effectiveAt.toISOString(),
      contentHtml: row.contentHtml,
    };
  }

  async listShowrooms(): Promise<StorefrontShowroom[]> {
    const rows = await this.db.location.findMany({
      where: { type: 'STORE', isActive: true, isPublic: true, slug: { not: null } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: this.showroomSelect(),
    });
    return rows.map((row) => this.toShowroom(row));
  }

  async getShowroom(slug: string): Promise<StorefrontShowroomDetail> {
    const row = await this.db.location.findFirst({
      where: { slug, type: 'STORE', isActive: true, isPublic: true },
      select: { ...this.showroomSelect(), description: true, email: true },
    });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

    return {
      ...this.toShowroom(row),
      description: row.description,
      email: row.email,
      images: row.imageUrls,
      mapEmbedUrl:
        row.latitude !== null && row.longitude !== null
          ? mapEmbedUrl({ latitude: row.latitude, longitude: row.longitude })
          : null,
    };
  }

  // ================= Chi tiết sản phẩm =================

  async getProduct(slug: string): Promise<StorefrontProduct> {
    const product = await this.db.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        brand: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
        doorTypes: { include: { doorType: { select: { slug: true, name: true } } } },
        media: { orderBy: { sortOrder: 'asc' }, select: { url: true, variantId: true } },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            optionValues: { include: { optionValue: { include: { option: true } } } },
            media: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
          },
        },
      },
    });

    if (!product) throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (product.variants.length === 0) {
      // Đang bán mà không còn biến thể nào bật: coi như không tồn tại với khách
      throw new AppException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const shapes = await this.specs.getShapes(product.categoryId);
    const specValues = (product.specs ?? {}) as Record<string, unknown>;
    const specs = shapes
      .filter((shape) => specValues[shape.code] !== undefined && specValues[shape.code] !== null)
      .map((shape) => ({
        name: shape.name,
        value: this.formatSpec(specValues[shape.code]),
      }))
      .filter((row) => row.value.length > 0);

    const prices = product.variants.map((variant) => money(variant.price));

    return {
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      brand: product.brand,
      category: product.category,
      doorTypes: product.doorTypes.map((link) => link.doorType),
      warrantyMonths: product.warrantyMonths,
      specs,
      highlights: Array.isArray(product.highlights)
        ? (product.highlights as { title: string; items: string[] }[])
        : [],
      images: product.media.map((item) => item.url),
      options: product.options.map((option) => ({
        code: option.code,
        name: option.name,
        values: option.values.map((value) => ({ code: value.code, value: value.value })),
      })),
      variants: product.variants.map((variant) => ({
        sku: variant.sku,
        name: variant.name,
        price: money(variant.price),
        compareAtPrice: variant.compareAtPrice === null ? null : money(variant.compareAtPrice),
        optionValues: Object.fromEntries(
          variant.optionValues.map((link) => [link.optionValue.option.code, link.optionValue.code]),
        ),
        imageUrl: variant.media[0]?.url ?? null,
      })),
      priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      ratingCount: product.ratingCount,
      ratingAverage:
        product.ratingCount > 0
          ? Math.round((product.ratingSum / product.ratingCount) * 10) / 10
          : null,
    };
  }

  // ================= Dùng chung =================

  /** Khách chỉ thấy sản phẩm ĐANG BÁN và còn ít nhất một biến thể bật */
  private publicWhere(query: Partial<StorefrontListQuery>): Prisma.ProductWhereInput {
    // Một điều kiện biến thể duy nhất: vừa phải đang bật, vừa phải lọt khoảng giá.
    // Tách làm hai lần khai `variants` thì lần sau ghi đè lần trước, rất khó thấy.
    const variantWhere: Prisma.ProductVariantWhereInput = {
      isActive: true,
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: BigInt(query.minPrice) } : {}),
              ...(query.maxPrice !== undefined ? { lte: BigInt(query.maxPrice) } : {}),
            },
          }
        : {}),
    };

    return {
      status: 'ACTIVE',
      variants: { some: variantWhere },
      ...(query.doorType ? { doorTypes: { some: { doorType: { slug: query.doorType } } } } : {}),
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { manufacturerCode: { contains: query.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: query.q.toUpperCase() } } } },
            ],
          }
        : {}),
    };
  }

  private cardSelect() {
    return {
      slug: true,
      name: true,
      warrantyMonths: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      doorTypes: { select: { doorType: { select: { slug: true } } } },
      media: { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { url: true } },
      variants: {
        where: { isActive: true },
        orderBy: { price: 'asc' as const },
        select: {
          price: true,
          compareAtPrice: true,
          optionValues: {
            select: { optionValue: { select: { value: true, option: { select: { code: true } } } } },
          },
        },
      },
    };
  }

  private toCard(row: {
    slug: string;
    name: string;
    warrantyMonths: number;
    brand: { name: string } | null;
    category: { name: string };
    doorTypes: { doorType: { slug: string } }[];
    media: { url: string }[];
    variants: {
      price: bigint;
      compareAtPrice: bigint | null;
      optionValues: { optionValue: { value: string; option: { code: string } } }[];
    }[];
  }): StorefrontCard {
    const cheapest = row.variants[0];
    // Chỉ lấy màu, không lấy app hay remote: chấm tròn trên thẻ chỉ nói về màu
    const colors = new Set<string>();
    for (const variant of row.variants) {
      for (const link of variant.optionValues) {
        if (link.optionValue.option.code === 'mau') colors.add(link.optionValue.value);
      }
    }

    return {
      slug: row.slug,
      name: row.name,
      brandName: row.brand?.name ?? null,
      categoryName: row.category.name,
      doorTypeSlugs: row.doorTypes.map((link) => link.doorType.slug),
      priceFrom: money(cheapest?.price),
      compareAtPrice:
        cheapest?.compareAtPrice === null || cheapest?.compareAtPrice === undefined
          ? null
          : money(cheapest.compareAtPrice),
      variantCount: row.variants.length,
      colorLabels: [...colors],
      imageUrl: row.media[0]?.url ?? null,
      warrantyMonths: row.warrantyMonths,
    };
  }

  private toBrand(
    row: {
      slug: string;
      name: string;
      description: string | null;
      logoUrl: string | null;
      countryOfOrigin: string | null;
      isAuthorized: boolean;
    },
    productCount: number,
  ): StorefrontBrand {
    return {
      ...this.toTaxonomy(row, productCount),
      logoUrl: row.logoUrl,
      countryOfOrigin: row.countryOfOrigin,
      isAuthorized: row.isAuthorized,
    };
  }

  private toTaxonomy(
    row: { slug: string; name: string; description: string | null },
    productCount: number,
  ): StorefrontTaxonomy {
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      productCount,
    };
  }

  private async activeBanners(
    placement: 'HOME_HERO' | 'HOME_SECONDARY',
  ): Promise<StorefrontBanner[]> {
    const now = new Date();
    const rows = await this.db.banner.findMany({
      where: {
        isActive: true,
        placement,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ sortOrder: 'asc' }],
      select: {
        title: true,
        linkUrl: true,
        desktopMedia: { select: { url: true } },
        mobileMedia: { select: { url: true } },
      },
    });

    return rows.map((row) => ({
      title: row.title,
      imageUrl: row.desktopMedia?.url ?? null,
      mobileImageUrl: row.mobileMedia?.url ?? null,
      linkUrl: row.linkUrl,
    }));
  }

  private showroomSelect() {
    return {
      slug: true,
      name: true,
      address: true,
      phone: true,
      openingHours: true,
      imageUrls: true,
      latitude: true,
      longitude: true,
      region: true,
    } as const;
  }

  private toShowroom(row: {
    slug: string | null;
    name: string;
    address: string;
    phone: string | null;
    openingHours: unknown;
    imageUrls: string[];
    latitude: number | null;
    longitude: number | null;
    region: 'HCM' | 'HN';
  }): StorefrontShowroom {
    // openingHours là cột Json: dữ liệu cũ hoặc nhập tay có thể không đúng dạng,
    // nên lọc từng phần tử thay vì tin cả mảng rồi để website vỡ.
    const raw = Array.isArray(row.openingHours) ? row.openingHours : [];
    const entries = raw.filter(
      (item): item is OpeningHoursEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as OpeningHoursEntry).day === 'number' &&
        typeof (item as OpeningHoursEntry).opens === 'string' &&
        typeof (item as OpeningHoursEntry).closes === 'string',
    );

    return {
      // Đã lọc slug khác null ở truy vấn, ?? chỉ để TypeScript yên tâm
      slug: row.slug ?? '',
      name: row.name,
      address: row.address,
      phone: row.phone,
      openingHours: formatOpeningHours(entries),
      imageUrl: row.imageUrls[0] ?? null,
      directionsUrl:
        row.latitude !== null && row.longitude !== null
          ? directionsUrl({ latitude: row.latitude, longitude: row.longitude })
          : null,
      region: row.region,
    };
  }

  private toReview(row: {
    reviewerName: string;
    rating: number;
    content: string | null;
    photos: unknown;
    verifiedPurchase: boolean;
    createdAt: Date;
    product: { slug: string; name: string };
  }): StorefrontReview {
    const photos = Array.isArray(row.photos) ? (row.photos as ReviewPhoto[]) : [];

    return {
      reviewerName: row.reviewerName,
      rating: row.rating,
      content: row.content,
      // Ảnh nhỏ cho trang chủ; thiếu thì lấy ảnh gốc
      photoUrls: photos.map((photo) => photo.thumbUrl ?? photo.url).filter(Boolean),
      verifiedPurchase: row.verifiedPurchase,
      createdAt: row.createdAt.toISOString(),
      product: row.product,
    };
  }

  private toFaq(row: { question: string; answerHtml: string; groupCode: string }): StorefrontFaq {
    // groupCode là VarChar trong CSDL, không phải enum: dữ liệu lạ thì để nhãn trống
    const label = FAQ_GROUP_LABEL[row.groupCode as FaqGroupCode] ?? '';
    return { question: row.question, answerHtml: row.answerHtml, groupLabel: label };
  }

  /**
   * Đọc thông tin công ty từ cấu hình mà không ràng vào tên trường cụ thể:
   * nhận nhiều tên gọi có thể có, thiếu thì trả null chứ không làm vỡ build.
   */
  private pickCompany(raw: unknown): StorefrontHome['company'] {
    const info = (raw ?? {}) as Record<string, unknown>;
    const pick = (...keys: string[]): string | null => {
      for (const key of keys) {
        const value = info[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    };
    return {
      name: pick('name', 'companyName', 'shortName'),
      hotline: pick('hotline', 'phone', 'phoneNumber', 'tel'),
      email: pick('email', 'contactEmail'),
      address: pick('address', 'headOffice', 'addressLine'),
    };
  }

  private formatSpec(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    return String(value ?? '').trim();
  }
}


