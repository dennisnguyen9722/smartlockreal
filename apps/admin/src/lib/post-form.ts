import type { PostDetail } from '@ktm/shared';
import { htmlPlainText } from '@ktm/shared';

/** Sản phẩm gắn kèm bài (giữ tên, ảnh để hiển thị, API chỉ nhận id) */
export interface PostProductRef {
    id: string;
    name: string;
    coverUrl: string | null;
    status: string;
}

export interface PostDraft {
    title: string;
    slug: string;
    excerpt: string;
    /** HTML từ TinyMCE */
    content: string;
    categoryId: string;
    cover: { id: string; url: string } | null;
    seoTitle: string;
    seoDescription: string;
    products: PostProductRef[];
}

export function emptyPostDraft(): PostDraft {
    return {
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        categoryId: '',
        cover: null,
        seoTitle: '',
        seoDescription: '',
        products: [],
    };
}

export function draftFromPost(post: PostDetail): PostDraft {
    return {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? '',
        content: post.content,
        categoryId: post.categoryId ?? '',
        cover: post.coverMediaId && post.coverUrl ? { id: post.coverMediaId, url: post.coverUrl } : null,
        seoTitle: post.seoTitle ?? '',
        seoDescription: post.seoDescription ?? '',
        products: post.products.map((product) => ({
            id: product.id,
            name: product.name,
            coverUrl: product.coverUrl,
            status: product.status,
        })),
    };
}

const nullable = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Dữ liệu gửi API. snapshot = null: tạo mới (gửi đủ); có snapshot: chỉ gửi trường đã đổi.
 * Nội dung so sánh theo chuỗi HTML (TinyMCE đã chuẩn hóa lúc mở, xem RichTextEditor onReady).
 */
export function buildPostPayload(draft: PostDraft, snapshot: PostDraft | null): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const changed = <K extends keyof PostDraft>(key: K) =>
        !snapshot || JSON.stringify(draft[key]) !== JSON.stringify(snapshot[key]);

    if (changed('title')) payload.title = draft.title.trim();
    // Tạo mới mà bỏ trống đường dẫn thì API tự sinh từ tiêu đề
    if (changed('slug') && draft.slug.trim()) payload.slug = draft.slug.trim();
    if (changed('excerpt')) payload.excerpt = nullable(draft.excerpt);
    if (changed('content')) payload.content = draft.content;
    if (changed('categoryId')) payload.categoryId = draft.categoryId || null;
    if (changed('cover')) payload.coverMediaId = draft.cover?.id ?? null;
    if (changed('seoTitle')) payload.seoTitle = nullable(draft.seoTitle);
    if (changed('seoDescription')) payload.seoDescription = nullable(draft.seoDescription);
    if (changed('products')) payload.productIds = draft.products.map((product) => product.id);
    return payload;
}

/** Bắt buộc để đăng: khớp missingForPublish() ở API */
export function missingForPublish(draft: PostDraft): string[] {
    const missing: string[] = [];
    if (!draft.title.trim()) missing.push('Tiêu đề');
    if (!htmlPlainText(draft.content)) missing.push('Nội dung');
    return missing;
}

/** Nên có để bài đẹp khi chia sẻ và dễ lên Google (không chặn đăng) */
export function recommendedForPublish(draft: PostDraft): string[] {
    const items: string[] = [];
    if (!draft.cover) items.push('Ảnh bìa (hiện khi chia sẻ qua Zalo, Facebook)');
    if (!draft.excerpt.trim()) items.push('Tóm tắt');
    if (!draft.seoDescription.trim() && !draft.excerpt.trim()) items.push('Mô tả trên Google');
    if (!draft.categoryId) items.push('Chuyên mục');
    const words = htmlPlainText(draft.content).split(' ').filter(Boolean).length;
    if (words > 0 && words < 300) items.push(`Bài hơi ngắn (${words} chữ); bài hướng dẫn nên từ 600 chữ`);
    return items;
}