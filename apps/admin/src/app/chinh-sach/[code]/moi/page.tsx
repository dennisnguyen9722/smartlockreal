'use client';

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
    POLICY_CODES,
    POLICY_INFO,
    PolicyVersionCreateSchema,
    htmlPlainText,
    suggestPolicyVersion,
    type PolicyCode,
    type PolicyVersionDetail,
    type PolicyVersionItem,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { useAuth } from '@/components/auth-provider';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { RichTextEditor } from '@/components/post/rich-text-editor';
import { errorText } from '@/lib/error-text';
import { useApiMutation, useApiQuery } from '@/lib/hooks';
import { formatDateTimeVn, fromLocalInput, toLocalInput } from '@/lib/order-types';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

export default function PolicyCreatePage() {
    return (
        <Suspense fallback={<LoadingRows rows={6} />}>
            <PolicyCreate />
        </Suspense>
    );
}

function PolicyCreate() {
    const { code: rawCode } = useParams<{ code: string }>();
    const searchParams = useSearchParams();
    const { can } = useAuth();
    const code = (POLICY_CODES as readonly string[]).includes(rawCode) ? (rawCode as PolicyCode) : null;
    const sourceId = searchParams.get('tu');

    const versions = useApiQuery<PolicyVersionItem[]>(['policies', code, 'versions'], `/policies/${code}/versions`, { enabled: Boolean(code) });
    const source = useApiQuery<PolicyVersionDetail>(['policies', 'version', sourceId], `/policies/versions/${sourceId}`, { enabled: Boolean(sourceId) });

    const back = (
        <Link href={code ? `/chinh-sach/${code}` : '/chinh-sach'}>
            <Button variant="outline">
                <ArrowLeft className="size-4" />
                Quay lại
            </Button>
        </Link>
    );

    if (!code) return <EmptyState message="Không có loại chính sách này" action={back} />;
    if (!can('setting.manage')) {
        return (
            <>
                <PageHeader title="Tạo phiên bản chính sách" actions={back} />
                <EmptyState message="Chỉ quản trị mới tạo được phiên bản chính sách" />
            </>
        );
    }
    if (versions.isPending || (sourceId && source.isPending)) {
        return (
            <>
                <PageHeader title="Tạo phiên bản chính sách" actions={back} />
                <LoadingRows rows={6} />
            </>
        );
    }

    return (
        <PolicyForm
            code={code}
            back={back}
            existingVersions={(versions.data ?? []).map((item) => item.version)}
            source={source.data ?? null}
        />
    );
}

function PolicyForm({
    code,
    back,
    existingVersions,
    source,
}: {
    code: PolicyCode;
    back: ReactNode;
    existingVersions: string[];
    source: PolicyVersionDetail | null;
}) {
    const router = useRouter();
    const info = POLICY_INFO[code];
    const [title, setTitle] = useState(source?.title ?? info.label);
    const [version, setVersion] = useState(() => suggestPolicyVersion(existingVersions));
    const [content, setContent] = useState(source?.content ?? '');
    const [when, setWhen] = useState<'now' | 'later'>('now');
    const [effectiveAt, setEffectiveAt] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirming, setConfirming] = useState(false);
    const original = useRef(source?.content ?? '');
    const [baseline, setBaseline] = useState(source?.content ?? '');

    const changedFromSource = content !== baseline;
    const dirty = changedFromSource || title !== (source?.title ?? info.label);

    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const create = useApiMutation<PolicyVersionDetail, Record<string, unknown>>((body) => ({ path: '/policies/versions', method: 'POST', body }), {
        invalidate: [['policies']],
        onSuccess: (created) => {
            toast.success(`Đã tạo bản ${created.version}`);
            router.replace(`/chinh-sach/${code}?v=${created.id}`);
        },
        onError: (error) => {
            setConfirming(false);
            const fields = apiFieldErrors(error);
            if (fields) {
                setErrors(fields);
                toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
                return;
            }
            toast.error(errorText(error));
        },
    });

    function body() {
        return {
            code,
            version: version.trim(),
            title: title.trim(),
            content,
            ...(when === 'later' ? { effectiveAt: fromLocalInput(effectiveAt) ?? undefined } : {}),
        };
    }

    function review() {
        const errs: Record<string, string> = {};
        const parsed = PolicyVersionCreateSchema.safeParse(body());
        if (!parsed.success) Object.assign(errs, collectFieldErrors([...parsed.error.issues]));
        if (!htmlPlainText(content)) errs.content = 'Chưa có nội dung chính sách';
        if (when === 'later') {
            const iso = fromLocalInput(effectiveAt);
            if (!iso || new Date(iso) <= new Date()) errs.effectiveAt = 'Chọn thời điểm trong tương lai';
        }
        if (source && !changedFromSource) errs.content = 'Nội dung giống hệt bản cũ, chưa cần tạo bản mới';
        setErrors(errs);
        if (Object.keys(errs).length > 0) {
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }
        setConfirming(true);
    }

    return (
        <>
            <PageHeader
                title={`Phiên bản mới: ${info.label}`}
                description={source ? `Soạn từ bản ${source.version}. Bản cũ vẫn giữ nguyên.` : 'Bản đầu tiên của chính sách này.'}
                actions={back}
            />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-4">
                    <div className="space-y-1.5">
                        <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 text-lg font-semibold" />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <RichTextEditor
                        value={content}
                        onChange={setContent}
                        onReady={(normalized) => {
                            // Mốc so sánh "đã sửa gì so với bản cũ" theo HTML TinyMCE đã chuẩn hóa
                            setBaseline(normalized);
                            setContent((current) => (current === original.current ? normalized : current));
                            original.current = normalized;
                        }}
                        invalid={Boolean(errors.content)}
                    />
                    {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Phát hành</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-1.5">
                                <Label>Số phiên bản</Label>
                                <Input value={version} onChange={(event) => setVersion(event.target.value)} className="font-mono" />
                                {errors.version ? (
                                    <p className="text-xs text-destructive">{errors.version}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Gợi ý theo tháng. Đã có: {existingVersions.length > 0 ? existingVersions.join(', ') : 'chưa có'}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Có hiệu lực</Label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} />
                                    Ngay khi tạo
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} />
                                    Từ ngày
                                </label>
                                {when === 'later' && (
                                    <Input
                                        type="datetime-local"
                                        value={effectiveAt}
                                        min={toLocalInput(new Date().toISOString())}
                                        onChange={(event) => setEffectiveAt(event.target.value)}
                                    />
                                )}
                                {errors.effectiveAt ? (
                                    <p className="text-xs text-destructive">{errors.effectiveAt}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Đổi điều khoản quan trọng nên báo trước cho khách vài ngày.</p>
                                )}
                            </div>
                            <Button className="w-full" onClick={review} disabled={create.isPending}>
                                Tạo phiên bản
                            </Button>
                            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                                Tạo xong không sửa hay xóa được. Cần sửa thì tạo bản mới tiếp theo.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Tạo phiên bản chính sách"
                description={
                    <>
                        Tạo <strong>bản {version.trim()}</strong> của {info.label.toLowerCase()}, có hiệu lực{' '}
                        {when === 'now' ? 'ngay' : `từ ${formatDateTimeVn(fromLocalInput(effectiveAt))}`}? Sau khi tạo sẽ{' '}
                        <strong>không sửa hay xóa được</strong>.
                    </>
                }
                confirmLabel="Tạo phiên bản"
                loading={create.isPending}
                onConfirm={() => create.mutate(body())}
            />
        </>
    );
}