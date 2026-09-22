'use client';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SETTING_GROUPS, type SettingGroupCode, type SettingsResponse } from '@ktm/shared';
import { cn } from '@ktm/ui/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, ErrorState, LoadingRows } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { SettingsGroupForm } from '@/components/settings/settings-group-form';
import { useApiQuery } from '@/lib/hooks';

function isGroupCode(value: string | null): value is SettingGroupCode {
    return SETTING_GROUPS.some((group) => group.code === value);
}

export default function SettingsPage() {
    // useSearchParams cần Suspense bao ngoài, nếu không Next.js báo lỗi khi build
    return (
        <Suspense fallback={<LoadingRows rows={6} />}>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { can } = useAuth();
    const allowed = can('setting.manage');

    const tabParam = searchParams.get('tab');
    const tab: SettingGroupCode = isGroupCode(tabParam) ? tabParam : 'company';
    const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<SettingGroupCode, boolean>>>({});

    const query = useApiQuery<SettingsResponse>(['settings'], '/settings', {
        enabled: allowed,
        // Luôn lấy bản mới khi mở trang, tránh sửa trên dữ liệu cũ rồi bị báo trùng
        refetchOnMount: 'always',
    });

    // Mỗi tab một hàm cố định (tạo một lần), để useEffect trong form không chạy lại liên tục
    const [dirtyHandlers] = useState(
        () =>
            Object.fromEntries(
                SETTING_GROUPS.map((group) => [
                    group.code,
                    (dirty: boolean) =>
                        setDirtyTabs((current) => (current[group.code] === dirty ? current : { ...current, [group.code]: dirty })),
                ]),
            ) as Record<SettingGroupCode, (dirty: boolean) => void>,
    );

    function selectTab(code: SettingGroupCode) {
        // replace: đổi tab không tạo thêm lịch sử
        router.replace(code === 'company' ? pathname : `${pathname}?tab=${code}`, { scroll: false });
    }

    async function reloadGroup(code: SettingGroupCode) {
        const result = await query.refetch();
        return result.data?.groups.find((group) => group.code === code);
    }

    const header = <PageHeader title="Cấu hình" description="Thông tin công ty, SEO chung và quy tắc bán hàng" />;

    if (!allowed) {
        return (
            <>
                {header}
                <EmptyState message="Bạn không có quyền xem trang này" />
            </>
        );
    }

    if (query.isPending) {
        return (
            <>
                {header}
                <LoadingRows rows={6} />
            </>
        );
    }

    if (query.isError) {
        return (
            <>
                {header}
                <ErrorState message={query.error.message} />
            </>
        );
    }

    return (
        <>
            {header}

            <div className="max-w-4xl space-y-4">
                <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
                    {SETTING_GROUPS.map((group) => (
                        <button
                            key={group.code}
                            type="button"
                            role="tab"
                            aria-selected={tab === group.code}
                            onClick={() => selectTab(group.code)}
                            className={cn(
                                '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                                tab === group.code
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {group.label}
                            {dirtyTabs[group.code] && (
                                <span className="size-1.5 rounded-full bg-amber-500" title="Có thay đổi chưa lưu" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Giữ cả 3 form trong trang (chỉ ẩn đi) để chuyển tab không mất phần đang sửa */}
                {query.data.groups.map((group) => (
                    <div key={group.code} role="tabpanel" hidden={tab !== group.code}>
                        <SettingsGroupForm
                            data={group}
                            onDirtyChange={dirtyHandlers[group.code]}
                            onReload={() => reloadGroup(group.code)}
                        />
                    </div>
                ))}
            </div>
        </>
    );
}