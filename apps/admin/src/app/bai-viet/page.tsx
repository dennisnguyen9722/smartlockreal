'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FolderTree, ImageIcon, Plus, Search } from 'lucide-react';
import {
    POST_STATUS_LABEL,
    imageUrl,
    type Paginated,
    type PostCategoryItem,
    type PostListItem,
    type PostListStatus,
    type PostStatusCounts,
} from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ktm/ui/components/table';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';
import { useDebounced } from '@/lib/use-debounced';

const TABS: { value: PostListStatus; label: string }[] = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'DRAFT', label: 'Nháp' },
    { value: 'PUBLISHED', label: 'Đã đăng' },
    { value: 'SCHEDULED', label: 'Hẹn giờ' },
    { value: 'ARCHIVED', label: 'Lưu trữ' },
];
const PAGE_SIZE = 20;

export default function PostListPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={6} />}>
            <PostListContent />
        </Suspense>
    );
}

function PostListContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { can } = useAuth();

    // Bộ lọc nằm trên URL: bấm Back từ trang sửa bài quay lại đúng tab, đúng trang
    const status = (TABS.find((tab) => tab.value === searchParams.get('status'))?.value ?? 'ALL') as PostListStatus;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const categoryId = searchParams.get('category') ?? '';
    const [search, setSearch] = useState(searchParams.get('q') ?? '');
    const term = useDebounced(search.trim());

    function update(next: Record<string, string | number | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(next)) {
            if (value === null || value === '' || value === 'ALL' || (key === 'page' && value === 1)) params.delete(key);
            else params.set(key, String(value));
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    useEffect(() => {
        if (term !== (searchParams.get('q') ?? '')) update({ q: term, page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status });
    if (term) params.set('search', term);
    if (categoryId) params.set('categoryId', categoryId);
    const query = useApiQuery<Paginated<PostListItem> & { statusCounts: PostStatusCounts }>(
        ['posts', status, page, term, categoryId],
        `/posts?${params.toString()}`,
        { placeholderData: (previous) => previous },
    );
    const categories = useApiQuery<PostCategoryItem[]>(['post-categories'], '/post-categories');

    const actions = (
        <div className="flex gap-2">
            <Link href="/bai-viet/chuyen-muc">
                <Button variant="outline">
                    <FolderTree className="size-4" />
                    Chuyên mục
                </Button>
            </Link>
            {can('content.manage') && (
                <Link href="/bai-viet/moi">
                    <Button>
                        <Plus className="size-4" />
                        Viết bài
                    </Button>
                </Link>
            )}
        </div>
    );

    return (
        <>
            <PageHeader title="Bài viết" description="Tin tức, hướng dẫn chọn khóa, so sánh sản phẩm" actions={actions} />

            <div className="mb-3 flex gap-1 overflow-x-auto border-b">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => update({ status: tab.value, page: 1 })}
                        className={cn(
                            '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium',
                            status === tab.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {tab.label}
                        <span className="ml-1.5 text-xs text-muted-foreground">{query.data?.statusCounts[tab.value] ?? ''}</span>
                    </button>
                ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
                <div className="relative min-w-60 flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tiêu đề" className="pl-9" />
                </div>
                <select
                    value={categoryId}
                    onChange={(event) => update({ category: event.target.value, page: 1 })}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                    <option value="">Mọi chuyên mục</option>
                    {(categories.data ?? []).map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>
            </div>

            {query.isPending ? (
                <LoadingRows rows={6} />
            ) : query.isError ? (
                <ErrorState message={query.error.message} />
            ) : query.data.items.length === 0 ? (
                <EmptyState message={term || categoryId ? 'Không có bài nào khớp bộ lọc' : 'Chưa có bài viết nào'} />
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-24" />
                                <TableHead>Tiêu đề</TableHead>
                                <TableHead>Chuyên mục</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead>Sửa lần cuối</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {query.data.items.map((post) => (
                                <TableRow key={post.id}>
                                    <TableCell>
                                        <div className="flex aspect-[1200/630] w-20 items-center justify-center overflow-hidden rounded border bg-muted">
                                            {post.coverUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được server tối ưu sẵn
                                                <img src={post.coverUrl.endsWith('.webp') ? imageUrl(post.coverUrl, 'sm') : post.coverUrl} alt="" className="size-full object-cover" />
                                            ) : (
                                                <ImageIcon className="size-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="min-w-72">
                                        <Link href={`/bai-viet/${post.id}`} className="font-medium hover:underline">
                                            {post.title}
                                        </Link>
                                        {post.author && <p className="text-xs text-muted-foreground">{post.author.fullName}</p>}
                                    </TableCell>
                                    <TableCell>{post.category?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell>
                                        {post.scheduled ? (
                                            <Badge variant="outline">Hẹn {formatDateTimeVn(post.publishedAt)}</Badge>
                                        ) : (
                                            <Badge variant={post.status === 'PUBLISHED' ? 'default' : 'secondary'}>{POST_STATUS_LABEL[post.status]}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTimeVn(post.updatedAt)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={(next) => update({ page: next })} />
                </div>
            )}
        </>
    );
}