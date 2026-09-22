'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    settingGroup,
    settingsUpdateSchema,
    type SettingDefinition,
    type SettingGroupCode,
    type SettingGroupData,
    type SettingsResponse,
} from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { Input } from '@ktm/ui/components/input';
import { Label } from '@ktm/ui/components/label';
import { SettingImageField } from '@/components/settings/setting-image-field';
import { ApiError } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { formatDateTimeVn } from '@/lib/order-types';
import { apiFieldErrors, collectFieldErrors } from '@/lib/product-form';

const TEXTAREA_CLASS = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm aria-invalid:border-destructive';
/** Giá trị mẫu do migration chèn sẵn, cần nhắc người dùng sửa */
const SAMPLE_VALUE = 'Chưa cập nhật';

/** Ô nhập luôn giữ chuỗi; đổi sang số lúc gửi */
type Draft = Record<string, string>;

function toDraft(definitions: SettingDefinition[], values: SettingGroupData['values']): Draft {
    return Object.fromEntries(
        definitions.map((definition) => {
            const value = values[definition.key] ?? definition.defaultValue;
            // Phần vạn -> %: 1000 -> "10", 1250 -> "12,5"
            if (definition.input === 'percent' && typeof value === 'number') {
                return [definition.key, String(value / 100).replace('.', ',')];
            }
            return [definition.key, String(value)];
        }),
    );
}

/** Chuỗi trong ô -> giá trị gửi API. Nhập sai thì gửi nguyên chuỗi để schema báo lỗi đúng ô */
function toValue(definition: SettingDefinition, text: string): string | number {
    if (definition.input === 'percent' || definition.input === 'integer') {
        const trimmed = text.trim().replace(',', '.');
        const number = trimmed === '' ? Number.NaN : Number(trimmed);
        if (!Number.isFinite(number)) return text;
        return definition.input === 'percent' ? Math.round(number * 100) : number;
    }
    return text;
}

/** Lỗi của Zod/API có dạng "values.company.name" -> "company.name" */
function fieldKey(path: string): string {
    return path.startsWith('values.') ? path.slice('values.'.length) : path;
}

export function SettingsGroupForm({
    data,
    onDirtyChange,
    onReload,
}: {
    data: SettingGroupData;
    onDirtyChange: (dirty: boolean) => void;
    /** Tải lại toàn bộ cấu hình, trả về nhóm này bản mới nhất */
    onReload: () => Promise<SettingGroupData | undefined>;
}) {
    const queryClient = useQueryClient();
    const group = settingGroup(data.code);
    const definitions = useMemo(() => group.sections.flatMap((section) => section.items), [group]);

    const [snapshot, setSnapshot] = useState<Draft>(() => toDraft(definitions, data.values));
    const [base, setBase] = useState(data.updatedAt);
    const [draft, setDraft] = useState<Draft>(snapshot);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [conflict, setConflict] = useState(false);

    const changedKeys = useMemo(() => definitions.filter((item) => draft[item.key] !== snapshot[item.key]).map((item) => item.key), [definitions, draft, snapshot]);
    const dirty = changedKeys.length > 0;

    function resetFrom(next: SettingGroupData) {
        const fresh = toDraft(definitions, next.values);
        setSnapshot(fresh);
        setDraft(fresh);
        setBase(next.updatedAt);
        setErrors({});
        setConflict(false);
    }

    // Máy chủ có bản mới (vd: tải lại trang): chưa sửa gì thì cập nhật theo
    useEffect(() => {
        if (data.updatedAt !== base && !dirty) resetFrom(data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.updatedAt]);

    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    // Cảnh báo khi đóng tab hoặc tải lại trình duyệt lúc còn thay đổi chưa lưu
    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const save = useApiMutation<SettingGroupData, { expectedUpdatedAt: string | null; values: Record<string, string | number> }>(
        (body) => ({ path: `/settings/${data.code}`, method: 'PATCH', body }),
        {
            // Trang in báo giá đọc thông tin công ty mới nhất
            invalidate: [['quote']],
            onSuccess: (saved) => {
                resetFrom(saved);
                queryClient.setQueryData<SettingsResponse>(['settings'], (old) =>
                    old ? { groups: old.groups.map((item) => (item.code === saved.code ? saved : item)) } : old,
                );
                toast.success('Đã lưu cấu hình');
            },
            onError: (error) => {
                if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
                    setConflict(true);
                    return;
                }
                const fieldErrors = apiFieldErrors(error);
                if (fieldErrors) {
                    setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, message]) => [fieldKey(key), message])));
                    toast.error('Dữ liệu chưa hợp lệ, xem các ô báo đỏ');
                    return;
                }
                toast.error(error.message);
            },
        },
    );

    function submit() {
        const values = Object.fromEntries(
            changedKeys.map((key) => {
                const definition = definitions.find((item) => item.key === key);
                return [key, definition ? toValue(definition, draft[key] ?? '') : (draft[key] ?? '')];
            }),
        );
        const payload = { expectedUpdatedAt: base, values };

        // Kiểm tra bằng đúng schema của API trước khi gửi
        const parsed = settingsUpdateSchema(data.code).safeParse(payload);
        if (!parsed.success) {
            const collected = collectFieldErrors([...parsed.error.issues]);
            setErrors(Object.fromEntries(Object.entries(collected).map(([key, message]) => [fieldKey(key), message])));
            toast.error('Vui lòng kiểm tra các ô báo đỏ');
            return;
        }

        setErrors({});
        // Gửi giá trị đã chuẩn hóa (vd: mã Google lấy từ thẻ meta)
        save.mutate({ expectedUpdatedAt: base, values: parsed.data.values as Record<string, string | number> });
    }

    async function reloadLatest() {
        const latest = await onReload();
        if (latest) {
            resetFrom(latest);
            toast.info('Đã tải bản mới nhất');
        }
    }

    function set(key: string, value: string) {
        setDraft((current) => ({ ...current, [key]: value }));
        // Sửa ô nào thì bỏ lỗi của ô đó
        if (errors[key]) {
            setErrors((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted-foreground">{group.description}</p>
                <p className="text-xs text-muted-foreground">
                    {data.updatedAt
                        ? `Sửa lần cuối ${formatDateTimeVn(data.updatedAt)}${data.updatedBy ? ` · ${data.updatedBy.fullName}` : ''}`
                        : 'Chưa từng lưu, đang dùng giá trị mặc định'}
                </p>
            </div>

            {conflict && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" />
                    <span className="flex-1">
                        Có người vừa sửa phần cấu hình này. Tải bản mới nhất sẽ <strong>bỏ thay đổi của bạn</strong>; nên ghi lại
                        những gì cần sửa trước.
                    </span>
                    <Button variant="outline" onClick={reloadLatest}>
                        <RefreshCw className="size-4" />
                        Tải bản mới nhất
                    </Button>
                </div>
            )}

            <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                {group.sections.map((section) => (
                    <Card key={section.label}>
                        <CardHeader>
                            <CardTitle>{section.label}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            {section.items.map((definition) => (
                                <SettingField
                                    key={definition.key}
                                    definition={definition}
                                    value={draft[definition.key] ?? ''}
                                    error={errors[definition.key]}
                                    disabled={save.isPending}
                                    onChange={(value) => set(definition.key, value)}
                                />
                            ))}
                        </CardContent>
                    </Card>
                ))}

                {data.code === 'seo' && <GooglePreview draft={draft} />}
            </fieldset>

            {dirty && (
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background py-3">
                    <span className="mr-auto text-sm text-muted-foreground">Có {changedKeys.length} thay đổi chưa lưu</span>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setDraft(snapshot);
                            setErrors({});
                        }}
                        disabled={save.isPending}
                    >
                        Hủy thay đổi
                    </Button>
                    <Button onClick={submit} disabled={save.isPending || conflict}>
                        {save.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function SettingField({
    definition,
    value,
    error,
    disabled,
    onChange,
}: {
    definition: SettingDefinition;
    value: string;
    error?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
}) {
    // Ô dài (địa chỉ, mô tả, ảnh) chiếm cả hàng
    const wide = definition.input === 'textarea' || definition.input === 'image';
    const invalid = Boolean(error) || undefined;
    const isSample = value.trim() === SAMPLE_VALUE;

    let control;
    switch (definition.input) {
        case 'textarea':
            control = (
                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    rows={3}
                    placeholder={definition.placeholder}
                    aria-invalid={invalid}
                    className={TEXTAREA_CLASS}
                />
            );
            break;
        case 'image':
            control = <SettingImageField value={value} onChange={onChange} disabled={disabled} invalid={Boolean(error)} />;
            break;
        case 'percent':
        case 'integer':
            control = (
                <div className="relative max-w-40">
                    <Input
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        aria-invalid={invalid}
                        className="pr-12"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        {definition.input === 'percent' ? '%' : definition.unit}
                    </span>
                </div>
            );
            break;
        default:
            control = (
                <Input
                    type={definition.input === 'email' ? 'email' : 'text'}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={definition.placeholder}
                    aria-invalid={invalid}
                />
            );
    }

    return (
        <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
            <Label>{definition.label}</Label>
            {control}
            {error ? (
                <p className="text-xs text-destructive">{error}</p>
            ) : isSample ? (
                <p className="text-xs text-amber-600">Đang là giá trị mẫu, cần cập nhật thông tin thật</p>
            ) : (
                definition.hint && <p className="text-xs text-muted-foreground">{definition.hint}</p>
            )}
        </div>
    );
}

/** Xem trước trang chủ trên kết quả tìm kiếm Google */
function GooglePreview({ draft }: { draft: Draft }) {
    const title = draft['seo.site_title']?.trim() || 'Chưa có tiêu đề';
    const description = draft['seo.default_description']?.trim() ?? '';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Xem trước trên Google</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="max-w-xl rounded-lg border bg-background p-4">
                    <p className="truncate text-xs text-muted-foreground">khoathongminhchinhhang.vn</p>
                    <p className="truncate text-lg text-blue-700 dark:text-blue-400">{title}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {description || 'Chưa có mô tả, Google sẽ tự lấy một đoạn chữ trên trang.'}
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    Tiêu đề: {title.length} ký tự (nên dưới 60) · Mô tả: {description.length} ký tự (nên 120–160). Đây là hình
                    minh họa; Google có thể hiển thị khác.
                </p>
            </CardContent>
        </Card>
    );
}