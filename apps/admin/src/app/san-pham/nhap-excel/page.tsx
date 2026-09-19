'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ImportPreviewResult } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ktm/ui/components/table';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { PageHeader } from '@/components/page-header';
import { API_URL } from '@/lib/api';
import { errorText } from '@/lib/error-text';
import { useApiQuery } from '@/lib/hooks';

interface CategoryNode {
    id: string;
    name: string;
    children: CategoryNode[];
}

interface ApplyResult {
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
}

const MAX_FILE_MB = 5;

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    CREATE: { label: 'Tạo mới', variant: 'default' },
    UPDATE: { label: 'Cập nhật', variant: 'secondary' },
    ERROR: { label: 'Lỗi', variant: 'destructive' },
};

export default function ProductImportPage() {
    const queryClient = useQueryClient();
    const { authFetch, accessToken } = useAuth();

    const [categoryId, setCategoryId] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [fileName, setFileName] = useState('');
    const [previewing, setPreviewing] = useState(false);
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [onlyErrors, setOnlyErrors] = useState(false);
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState<ApplyResult | null>(null);

    const categories = useApiQuery<CategoryNode[]>(['categories', 'tree'], '/catalog/categories/tree');
    const flatCategories: { id: string; name: string; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
        for (const node of nodes) {
            flatCategories.push({ id: node.id, name: node.name, depth });
            walk(node.children, depth + 1);
        }
    };
    walk(categories.data ?? [], 0);

    /** File Excel là dữ liệu nhị phân nên không đi qua authFetch (vốn đọc JSON) */
    async function downloadTemplate() {
        setDownloading(true);
        try {
            const query = categoryId ? `?categoryId=${categoryId}` : '';
            const response = await fetch(`${API_URL}/catalog/import/template${query}`, {
                credentials: 'include',
                headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
            });
            if (!response.ok) {
                throw new Error(
                    response.status === 401
                        ? 'Phiên đăng nhập đã hết hạn, hãy tải lại trang rồi thử lại'
                        : 'Không tải được file mẫu',
                );
            }
            const blob = await response.blob();
            const disposition = response.headers.get('content-disposition') ?? '';
            const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'mau-nhap-san-pham.xlsx';

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = name;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setDownloading(false);
        }
    }

    async function uploadFile(file: File) {
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toast.error('Chỉ nhận file Excel .xlsx');
            return;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            toast.error(`File tối đa ${MAX_FILE_MB} MB`);
            return;
        }

        setFileName(file.name);
        setPreview(null);
        setResult(null);
        setPreviewing(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const data = await authFetch<ImportPreviewResult>('/catalog/import/preview', {
                method: 'POST',
                body: form,
            });
            setPreview(data);
            setOnlyErrors(data.errorCount > 0);
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setPreviewing(false);
        }
    }

    async function apply() {
        if (!preview) return;
        setApplying(true);
        try {
            const data = await authFetch<ApplyResult>('/catalog/import/apply', {
                method: 'POST',
                body: JSON.stringify({ sessionId: preview.sessionId }),
            });
            setResult(data);
            setPreview(null);
            await queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Đã nhập xong');
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setApplying(false);
        }
    }

    const rows = preview ? (onlyErrors ? preview.rows.filter((row) => row.status === 'ERROR') : preview.rows) : [];

    return (
        <>
            <PageHeader
                title="Nhập sản phẩm từ Excel"
                description="Tạo mới hoặc cập nhật hàng loạt. Có lỗi ở bất kỳ dòng nào thì không ghi gì cả."
                actions={
                    <Link href="/san-pham">
                        <Button variant="outline">
                            <ArrowLeft className="size-4" />
                            Danh sách
                        </Button>
                    </Link>
                }
            />

            <div className="max-w-5xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Tải file mẫu</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Chọn danh mục để file mẫu có sẵn cột thông số của danh mục đó. File có trang Tham chiếu liệt kê mã hãng,
                            mã danh mục. Mỗi dòng là một biến thể; các dòng cùng Mã sản phẩm thuộc một sản phẩm.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={categoryId}
                                onChange={(event) => setCategoryId(event.target.value)}
                                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                            >
                                <option value="">Mọi danh mục (không có cột thông số)</option>
                                {flatCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {'\u00A0\u00A0'.repeat(category.depth)}
                                        {category.depth > 0 ? '└ ' : ''}
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            <Button variant="outline" onClick={() => void downloadTemplate()} disabled={downloading}>
                                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                                Tải file mẫu
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Tải file đã điền lên để xem trước</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <label
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-sm text-muted-foreground hover:border-primary hover:text-foreground',
                                (previewing || applying) && 'pointer-events-none opacity-60',
                            )}
                        >
                            {previewing ? <Loader2 className="size-7 animate-spin" /> : <FileSpreadsheet className="size-7" />}
                            {previewing ? 'Đang đọc file...' : fileName || 'Bấm để chọn file .xlsx'}
                            <span className="text-xs">Tối đa {MAX_FILE_MB} MB. Chưa ghi gì vào hệ thống ở bước này.</span>
                            <input
                                type="file"
                                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                hidden
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    if (file) void uploadFile(file);
                                }}
                            />
                        </label>
                    </CardContent>
                </Card>

                {preview && (
                    <Card>
                        <CardHeader>
                            <CardTitle>3. Kiểm tra và xác nhận</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                                <Stat label="Tổng số dòng" value={preview.totalRows} />
                                <Stat label="Sản phẩm mới" value={preview.productsToCreate} />
                                <Stat label="Sản phẩm cập nhật" value={preview.productsToUpdate} />
                                <Stat label="Biến thể mới / cập nhật" value={`${preview.variantsToCreate} / ${preview.variantsToUpdate}`} />
                                <Stat label="Dòng lỗi" value={preview.errorCount} danger={preview.errorCount > 0} />
                            </div>

                            {preview.errorCount > 0 ? (
                                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                                    Có {preview.errorCount} dòng lỗi nên <strong>chưa nhập được</strong>. Sửa các dòng dưới đây trong
                                    file Excel rồi tải lên lại.
                                </p>
                            ) : (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-600/40 bg-green-600/5 p-3 text-sm">
                                    <span>Không có lỗi. Kết quả xem trước giữ trong 30 phút, quá hạn thì tải file lên lại.</span>
                                    <Button onClick={() => void apply()} disabled={applying}>
                                        {applying ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                        Xác nhận nhập
                                    </Button>
                                </div>
                            )}

                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={onlyErrors}
                                    onChange={(event) => setOnlyErrors(event.target.checked)}
                                    className="size-4"
                                />
                                Chỉ hiện dòng lỗi
                            </label>

                            <div className="max-h-[60vh] overflow-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">Dòng</TableHead>
                                            <TableHead>Sản phẩm</TableHead>
                                            <TableHead>SKU / Biến thể</TableHead>
                                            <TableHead>Kết quả</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => {
                                            const status = STATUS_LABEL[row.status] ?? { label: row.status, variant: 'outline' as const };
                                            return (
                                                <TableRow key={row.rowNumber}>
                                                    <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                                                    <TableCell>
                                                        <p className="font-medium">{row.productName || '—'}</p>
                                                        <p className="text-xs text-muted-foreground">{row.productCode}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="font-mono text-xs">{row.sku || '(tự sinh)'}</p>
                                                        <p className="text-xs text-muted-foreground">{row.variantName}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={status.variant}>{status.label}</Badge>
                                                        {row.issues.length > 0 && (
                                                            <ul className="mt-1 space-y-0.5 text-xs text-destructive">
                                                                {row.issues.map((issue, index) => (
                                                                    <li key={index}>
                                                                        <strong>{issue.column}:</strong> {issue.message}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {result && (
                    <Card>
                        <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
                            <CheckCircle2 className="size-5 text-green-600" />
                            <span className="flex-1">
                                Đã tạo {result.productsCreated} sản phẩm, cập nhật {result.productsUpdated} sản phẩm; tạo{' '}
                                {result.variantsCreated} và cập nhật {result.variantsUpdated} biến thể. Sản phẩm mới ở trạng thái
                                Nháp, cần thêm ảnh trước khi đăng bán.
                            </span>
                            <Link href="/san-pham">
                                <Button>Xem danh sách sản phẩm</Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

function Stat({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-lg font-semibold tabular-nums', danger && 'text-destructive')}>{value}</p>
        </div>
    );
}