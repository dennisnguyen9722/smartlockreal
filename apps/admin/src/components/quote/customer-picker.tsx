'use client';

import { useState } from 'react';
import { Building2, Search, User, X } from 'lucide-react';
import { formatVnPhone, type Paginated } from '@ktm/shared';
import { Button } from '@ktm/ui/components/button';
import { Input } from '@ktm/ui/components/input';
import type { CustomerListItem } from '@/lib/customer-types';
import { useApiQuery } from '@/lib/hooks';
import { useDebounced } from '@/lib/use-debounced';

export type PickedCustomer = Pick<CustomerListItem, 'id' | 'type' | 'fullName' | 'companyName' | 'taxCode' | 'phone'>;

/** Tìm khách theo tên, công ty, mã số thuế, số điện thoại */
export function CustomerPicker({
    value,
    onChange,
    error,
}: {
    value: PickedCustomer | null;
    onChange: (customer: PickedCustomer | null) => void;
    error?: string;
}) {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const search = useDebounced(input.trim());
    const query = useApiQuery<Paginated<CustomerListItem>>(
        ['customers', 'picker', search],
        `/customers?pageSize=8&search=${encodeURIComponent(search)}`,
        { enabled: search.length >= 2 },
    );

    if (value) {
        return (
            <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                {value.type === 'BUSINESS' ? <Building2 className="size-4 text-muted-foreground" /> : <User className="size-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                    <p className="font-medium">{value.companyName ?? value.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                        {[value.taxCode && `MST ${value.taxCode}`, formatVnPhone(value.phone)].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Chọn khách khác">
                    <X className="size-4" />
                </Button>
            </div>
        );
    }

    const results = query.data?.items ?? [];
    return (
        <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={input}
                onChange={(event) => {
                    setInput(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Tìm khách theo tên, công ty, mã số thuế, số điện thoại..."
                className="pl-9"
                aria-invalid={error ? true : undefined}
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            {open && search.length >= 2 && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {query.isFetching && results.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">Đang tìm...</p>
                    ) : results.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">
                            Không tìm thấy. Thêm khách mới ở trang Khách hàng trước khi lập báo giá.
                        </p>
                    ) : (
                        results.map((customer) => (
                            <button
                                key={customer.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onChange(customer);
                                    setInput('');
                                    setOpen(false);
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                            >
                                {customer.type === 'BUSINESS' ? (
                                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                                ) : (
                                    <User className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{customer.companyName ?? customer.fullName}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        {[customer.taxCode && `MST ${customer.taxCode}`, formatVnPhone(customer.phone)].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}