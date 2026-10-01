'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImageIcon, Save, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { imageUrl, type Paginated } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ktm/ui/components/table';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/components/auth-provider';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { errorText } from '@/lib/error-text';

/**
 * Chọn sản phẩm hiện ở khối "Sản phẩm nổi bật" trên trang chủ.
 *
 * Chưa chọn cái nào thì trang chủ tự lấy 8 sản phẩm đăng bán gần nhất — nên
 * trang chủ không bao giờ trống, nhưng cũng dễ bị dồn hết về một hãng. Chọn tay
 * ở đây là để trộn các hãng cho cân.
 */

interface SanPham {
    id: string;
    name: string;
    slug: string;
    status: string;
    manufacturerCode: string | null;
    isFeatured: boolean;
    featuredOrder: number;
    brand: { id: string; name: string } | null;
    category: { id: string; name: string };
    media: { url: string }[];
}

interface HangChon {
    id: string;
    name: string;
}

/** Trang chủ chỉ lấy 8 cái đầu; cho chọn nhiều hơn chỉ tổ gây hiểu nhầm */
const TOI_DA = 8;
const PAGE_SIZE = 20;

export default function TrangNoiBat() {
    const { can } = useAuth();
    const duocSua = can('catalog.manage');

    const [search, setSearch] = useState('');
    const [oTimKiem, setOTimKiem] = useState('');
    const [brandId, setBrandId] = useState('');
    const [page, setPage] = useState(1);

    // Gõ xong 400ms mới gọi API, không gọi theo từng phím
    useEffect(() => {
        const hen = setTimeout(() => {
            setSearch(oTimKiem.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(hen);
    }, [oTimKiem]);

    const dangChonQuery = useApiQuery<Paginated<SanPham>>(
        ['products', 'featured'],
        '/catalog/products?featured=true&status=ACTIVE&pageSize=24',
    );

    const hangQuery = useApiQuery<Paginated<HangChon>>(
        ['brands', 'all'],
        '/catalog/brands?pageSize=100',
    );

    const duongDan = useMemo(() => {
        const p = new URLSearchParams({
            status: 'ACTIVE',
            page: String(page),
            pageSize: String(PAGE_SIZE),
        });
        if (search) p.set('search', search);
        if (brandId) p.set('brandId', brandId);
        return `/catalog/products?${p.toString()}`;
    }, [page, search, brandId]);

    const danhSachQuery = useApiQuery<Paginated<SanPham>>(
        ['products', 'pick', page, search, brandId],
        duongDan,
    );

    /** Danh sách đang chọn, giữ ở đây để bấm lên xuống thấy đổi ngay */
    const [chon, setChon] = useState<SanPham[]>([]);
    /**
     * Mốc để biết "có gì chưa lưu". Giữ thành state riêng chứ không tính lại từ
     * dữ liệu máy chủ: lưu xong mà mốc còn chờ tải lại thì nút Lưu sẽ nhấp nháy
     * sáng lên một nhịp, hoặc tệ hơn là chép đè danh sách cũ lên cái vừa lưu.
     * null = chưa tải xong lần đầu.
     */
    const [idGoc, setIdGoc] = useState<string | null>(null);

    useEffect(() => {
        if (!dangChonQuery.data || idGoc !== null) return;
        const sapXep = [...dangChonQuery.data.items].sort((a, b) => a.featuredOrder - b.featuredOrder);
        setChon(sapXep);
        setIdGoc(sapXep.map((item) => item.id).join(','));
    }, [dangChonQuery.data, idGoc]);

    const idHienTai = chon.map((item) => item.id).join(',');
    const coThayDoi = idGoc !== null && idGoc !== idHienTai;

    const luu = useApiMutation<{ count: number }, string[]>(
        (ids) => ({ path: '/catalog/products/featured', method: 'POST', body: { ids } }),
        {
            invalidate: [['products']],
            onSuccess: (data, ids) => {
                toast.success(
                    data.count === 0
                        ? 'Đã bỏ hết. Trang chủ quay lại tự lấy hàng mới nhất.'
                        : `Đã lưu ${data.count} sản phẩm nổi bật.`,
                );
                // Mốc mới chính là thứ vừa gửi đi, khỏi chờ máy chủ trả lời lần nữa
                setIdGoc(ids.join(','));
            },
            onError: (error) => toast.error(errorText(error)),
        },
    );

    function them(sanPham: SanPham) {
        if (chon.some((item) => item.id === sanPham.id)) return;
        if (chon.length >= TOI_DA) {
            toast.error(`Trang chủ chỉ hiện ${TOI_DA} sản phẩm. Bỏ bớt một cái rồi thêm.`);
            return;
        }
        setChon((truoc) => [...truoc, sanPham]);
    }

    function bo(id: string) {
        setChon((truoc) => truoc.filter((item) => item.id !== id));
    }

    function doiCho(tu: number, den: number) {
        if (den < 0 || den >= chon.length) return;
        setChon((truoc) => {
            const sao = [...truoc];
            [sao[tu], sao[den]] = [sao[den], sao[tu]];
            return sao;
        });
    }

    const dangChonId = new Set(chon.map((item) => item.id));
    const hang = hangQuery.data?.items ?? [];
    const tong = danhSachQuery.data?.total ?? 0;
    const soTrang = Math.max(1, Math.ceil(tong / PAGE_SIZE));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sản phẩm nổi bật"
                description={`Chọn tối đa ${TOI_DA} sản phẩm hiện ở khối nổi bật trang chủ. Không chọn cái nào thì trang chủ tự lấy hàng đăng bán gần nhất.`}
                actions={
                    duocSua ? (
                        <Button
                            onClick={() => luu.mutate(chon.map((item) => item.id))}
                            disabled={!coThayDoi || luu.isPending}
                        >
                            <Save className="size-4" />
                            {luu.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                        </Button>
                    ) : undefined
                }
            />

            {/* ---------- Đang chọn ---------- */}
            <section className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <Star className="size-4 text-amber-500" />
                        Đang chọn
                        <Badge variant="secondary">
                            {chon.length}/{TOI_DA}
                        </Badge>
                    </h2>
                    {coThayDoi && (
                        <span className="text-xs text-amber-600">Có thay đổi chưa lưu</span>
                    )}
                </div>

                {dangChonQuery.isPending ? (
                    <LoadingRows rows={2} />
                ) : chon.length === 0 ? (
                    <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Chưa chọn sản phẩm nào. Trang chủ đang tự lấy 8 sản phẩm đăng bán gần nhất —
                        thường bị dồn về một hãng. Tick ở bảng bên dưới để chọn.
                    </p>
                ) : (
                    <ol className="space-y-2">
                        {chon.map((sanPham, viTri) => (
                            <li
                                key={sanPham.id}
                                className="flex items-center gap-3 rounded-md border bg-background p-2"
                            >
                                <span className="so-lieu w-6 text-center text-sm font-semibold text-muted-foreground">
                                    {viTri + 1}
                                </span>

                                <Anh sanPham={sanPham} />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{sanPham.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {sanPham.brand?.name ?? sanPham.category.name}
                                        {sanPham.manufacturerCode ? ` · ${sanPham.manufacturerCode}` : ''}
                                    </p>
                                </div>

                                {duocSua && (
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Đưa ${sanPham.name} lên trên`}
                                            disabled={viTri === 0}
                                            onClick={() => doiCho(viTri, viTri - 1)}
                                        >
                                            <ArrowUp className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Đưa ${sanPham.name} xuống dưới`}
                                            disabled={viTri === chon.length - 1}
                                            onClick={() => doiCho(viTri, viTri + 1)}
                                        >
                                            <ArrowDown className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Bỏ ${sanPham.name} khỏi danh sách nổi bật`}
                                            onClick={() => bo(sanPham.id)}
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {/* ---------- Chọn thêm ---------- */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-56 flex-1">
                        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={oTimKiem}
                            onChange={(event) => setOTimKiem(event.target.value)}
                            placeholder="Tìm theo tên, mã model hoặc SKU"
                            className="pl-8"
                        />
                    </div>

                    <select
                        value={brandId}
                        onChange={(event) => {
                            setBrandId(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Lọc theo hãng"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                        <option value="">Tất cả hãng</option>
                        {hang.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>

                {danhSachQuery.isPending ? (
                    <LoadingRows />
                ) : danhSachQuery.isError ? (
                    <ErrorState
                        message={errorText(danhSachQuery.error)}
                        onRetry={() => danhSachQuery.refetch()}
                    />
                ) : (danhSachQuery.data?.items.length ?? 0) === 0 ? (
                    <EmptyState message="Không có sản phẩm đang bán nào khớp bộ lọc." />
                ) : (
                    <>
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12 text-center">Nổi bật</TableHead>
                                        <TableHead className="w-14">Ảnh</TableHead>
                                        <TableHead>Tên sản phẩm</TableHead>
                                        <TableHead className="w-32">Hãng</TableHead>
                                        <TableHead className="w-36">Mã model</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {danhSachQuery.data?.items.map((sanPham) => {
                                        const daChon = dangChonId.has(sanPham.id);
                                        return (
                                            <TableRow key={sanPham.id} className={daChon ? 'bg-amber-50/60' : ''}>
                                                <TableCell className="text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={daChon}
                                                        disabled={!duocSua}
                                                        aria-label={`Đưa ${sanPham.name} vào khối nổi bật`}
                                                        onChange={() =>
                                                            daChon ? bo(sanPham.id) : them(sanPham)
                                                        }
                                                        className="size-4 accent-amber-500"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Anh sanPham={sanPham} />
                                                </TableCell>
                                                <TableCell className="font-medium">{sanPham.name}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {sanPham.brand?.name ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {sanPham.manufacturerCode ?? '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <span className="so-lieu text-sm text-muted-foreground">
                                {tong} sản phẩm đang bán · trang {page}/{soTrang}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((truoc) => truoc - 1)}
                                >
                                    Trang trước
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= soTrang}
                                    onClick={() => setPage((truoc) => truoc + 1)}
                                >
                                    Trang sau
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

function Anh({ sanPham }: { sanPham: SanPham }) {
    const anh = sanPham.media[0];
    if (!anh) {
        return (
            <div className="flex size-10 items-center justify-center rounded border bg-muted">
                <ImageIcon className="size-4 text-muted-foreground" />
            </div>
        );
    }
    return (
        <img
            src={imageUrl(anh.url, 'sm')}
            alt=""
            className="size-10 rounded border bg-white object-contain"
        />
    );
}
