'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { ORDER_SERIAL_PATTERN } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import type { OrderDetail } from '@/lib/order-types';
import { useOrderAction } from '@/lib/use-order-action';

type Line = OrderDetail['lines'][number];

function normalize(value: string): string {
    return value.trim().toUpperCase();
}

/**
 * Serial các máy đã giao, để báo hãng khi khách cần bảo hành.
 * Mỗi máy một ô (đơn 3 máy = 3 ô). Không bắt buộc nhập đủ: ô trống được bỏ qua.
 */
export function LineSerialEditor({ order, line, editable }: { order: OrderDetail; line: Line; editable: boolean }) {
    const { run, pending } = useOrderAction(order);
    const saved = line.serialNumbers ?? [];
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState<string[]>([]);

    function start() {
        setValues(Array.from({ length: line.quantity }, (_, index) => saved[index] ?? ''));
        setEditing(true);
    }

    const cleaned = values.map(normalize);
    const problems = cleaned.map((value, index) => {
        if (!value) return null;
        if (!ORDER_SERIAL_PATTERN.test(value)) return 'Chỉ gồm chữ, số và . _ / -';
        if (cleaned.indexOf(value) !== index) return 'Trùng với máy khác';
        return null;
    });
    const hasProblem = problems.some(Boolean);
    const filled = cleaned.filter(Boolean).length;

    async function save() {
        const result = await run(
            `/orders/lines/${line.id}/serials`,
            'PATCH',
            { serialNumbers: cleaned.filter(Boolean) },
            'Đã lưu serial',
        );
        if (result) setEditing(false);
    }

    if (!editing) {
        return (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                    Serial ({saved.length}/{line.quantity}): {saved.length > 0 ? saved.join(', ') : 'chưa ghi'}
                </span>
                {editable && (
                    <button type="button" onClick={start} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Pencil className="size-3" />
                        {saved.length > 0 ? 'Sửa' : 'Ghi serial'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3">
            <fieldset disabled={pending} className="space-y-2">
                {values.map((value, index) => (
                    <div key={index} className="flex items-start gap-2">
                        <span className="w-16 shrink-0 pt-1.5 text-xs text-muted-foreground">Máy {index + 1}</span>
                        <div className="flex-1">
                            <Input
                                value={value}
                                onChange={(event) =>
                                    setValues((current) => current.map((item, i) => (i === index ? event.target.value.toUpperCase() : item)))
                                }
                                placeholder="Serial in trên thân máy hoặc hộp"
                                aria-invalid={problems[index] ? true : undefined}
                                className="h-8 bg-background font-mono text-xs"
                                maxLength={100}
                                autoFocus={index === 0}
                            />
                            {problems[index] && <p className="mt-0.5 text-xs text-destructive">{problems[index]}</p>}
                        </div>
                    </div>
                ))}
            </fieldset>
            <div className="flex items-center justify-end gap-2">
                <span className="mr-auto text-xs text-muted-foreground">
                    Đã nhập {filled}/{line.quantity} máy. Ô trống được bỏ qua.
                </span>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                    Hủy
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={pending || hasProblem}>
                    {pending ? 'Đang lưu...' : 'Lưu serial'}
                </Button>
            </div>
        </div>
    );
}