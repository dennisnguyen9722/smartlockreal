'use client';

import { CircleAlert, CircleCheck, Globe, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@ktm/ui/components/card';
import { missingForPublic, recommendedForPublic, type ShowroomDraft } from '@/lib/showroom-form';

function Toggle({
    checked,
    onChange,
    label,
    hint,
    disabled,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    hint: string;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-start gap-3 text-sm">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                disabled={disabled}
                className="mt-0.5 size-4"
            />
            <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
        </label>
    );
}

/** Thẻ trạng thái: đang hoạt động, hiện trên website, kèm những gì còn thiếu */
export function ShowroomStatusCard({
    value,
    onChange,
    orderCount,
    publishedAt,
}: {
    value: ShowroomDraft;
    onChange: (next: ShowroomDraft) => void;
    /** Trang tạo mới không có */
    orderCount?: number;
    publishedAt?: string | null;
}) {
    const missing = missingForPublic(value);
    const recommended = recommendedForPublic(value);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Trạng thái</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Toggle
                    checked={value.isActive}
                    // Tắt showroom thì tự gỡ khỏi website (API và database cũng làm vậy)
                    onChange={(checked) => onChange({ ...value, isActive: checked, isPublic: checked ? value.isPublic : false })}
                    label="Đang hoạt động"
                    hint="Tắt khi showroom đóng cửa: không chọn được làm nơi nhận hàng, ẩn khỏi website"
                />
                <Toggle
                    checked={value.isPublic}
                    onChange={(checked) => onChange({ ...value, isPublic: checked })}
                    disabled={!value.isActive || (!value.isPublic && missing.length > 0)}
                    label="Hiện trên website"
                    hint="Trang showroom riêng, có bản đồ và giờ mở cửa để khách tìm thấy trên Google"
                />

                {missing.length > 0 ? (
                    <div className="space-y-1 rounded-lg bg-destructive/5 p-3 text-xs">
                        <p className="flex items-center gap-1.5 font-medium text-destructive">
                            <CircleAlert className="size-3.5" />
                            Cần bổ sung để hiện trên website
                        </p>
                        <ul className="list-disc space-y-0.5 pl-5">
                            {missing.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                        <CircleCheck className="size-3.5" />
                        Đủ thông tin để hiện trên website
                    </p>
                )}

                {recommended.length > 0 && (
                    <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs">
                        <p className="flex items-center gap-1.5 font-medium">
                            <Lightbulb className="size-3.5" />
                            Nên có thêm
                        </p>
                        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                            {recommended.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {(orderCount !== undefined || publishedAt) && (
                    <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                        {publishedAt && (
                            <p className="flex items-center gap-1.5">
                                <Globe className="size-3.5" />
                                Đăng lần đầu {new Date(publishedAt).toLocaleDateString('vi-VN')}. Đổi đường dẫn sẽ tự chuyển link cũ.
                            </p>
                        )}
                        {orderCount !== undefined && <p>{orderCount} đơn nhận hàng tại showroom này</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}