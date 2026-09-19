'use client';

import { Input } from '@ktm/ui/components/input';
import { cn } from '@ktm/ui/lib/utils';

const MAX_DIGITS = 15; // Dưới giới hạn số nguyên an toàn của JavaScript

/**
 * Ô nhập tiền VND: hiển thị "4.990.000", giá trị giữ dạng chuỗi chữ số "4990000".
 * Chuỗi rỗng = chưa nhập (khác với 0).
 */
export function PriceInput({
    value,
    onChange,
    placeholder,
    className,
    disabled,
    invalid,
}: {
    value: string;
    onChange: (digits: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    invalid?: boolean;
}) {
    const display = value === '' ? '' : Number(value).toLocaleString('vi-VN');

    return (
        <div className="relative">
            <Input
                inputMode="numeric"
                value={display}
                onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                    onChange(digits.slice(0, MAX_DIGITS));
                }}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                className={cn('pr-7 text-right tabular-nums', className)}
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                ₫
            </span>
        </div>
    );
}