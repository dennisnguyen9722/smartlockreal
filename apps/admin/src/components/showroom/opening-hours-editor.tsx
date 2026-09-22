'use client';

import { CopyCheck } from 'lucide-react';
import { WEEKDAY_LABEL } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import type { DayHours } from '@/lib/showroom-form';

/**
 * Bảng giờ mở cửa 7 ngày: bỏ tick = nghỉ. Mỗi ngày một khung giờ (showroom không nghỉ trưa).
 * Nút "Áp dụng cho cả tuần" chép giờ của Thứ Hai sang các ngày đang mở.
 */
export function OpeningHoursEditor({
    value,
    onChange,
    error,
}: {
    value: DayHours[];
    onChange: (next: DayHours[]) => void;
    error?: string;
}) {
    function update(day: number, patch: Partial<DayHours>) {
        onChange(value.map((item) => (item.day === day ? { ...item, ...patch } : item)));
    }

    const monday = value.find((item) => item.day === 1);

    return (
        <div className="space-y-2">
            <div className="divide-y rounded-lg border">
                {value.map((item) => {
                    const wrong = item.open && item.closes <= item.opens;
                    return (
                        <div key={item.day} className="flex flex-wrap items-center gap-3 px-3 py-2">
                            <label className="flex w-32 items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={item.open}
                                    onChange={(event) => update(item.day, { open: event.target.checked })}
                                    className="size-4"
                                />
                                {WEEKDAY_LABEL[item.day]}
                            </label>
                            {item.open ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="time"
                                        value={item.opens}
                                        onChange={(event) => update(item.day, { opens: event.target.value })}
                                        className="w-28"
                                        aria-invalid={wrong || undefined}
                                    />
                                    <span className="text-muted-foreground">–</span>
                                    <Input
                                        type="time"
                                        value={item.closes}
                                        onChange={(event) => update(item.day, { closes: event.target.value })}
                                        className="w-28"
                                        aria-invalid={wrong || undefined}
                                    />
                                    {wrong && <span className="text-xs text-destructive">Giờ đóng phải sau giờ mở</span>}
                                </div>
                            ) : (
                                <span className="text-sm text-muted-foreground">Nghỉ</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                {error ? <p className="text-xs text-destructive">{error}</p> : <span />}
                {monday?.open && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            onChange(value.map((item) => (item.open ? { ...item, opens: monday.opens, closes: monday.closes } : item)))
                        }
                    >
                        <CopyCheck className="size-4" />
                        Áp dụng giờ Thứ Hai cho các ngày mở cửa
                    </Button>
                )}
            </div>
        </div>
    );
}