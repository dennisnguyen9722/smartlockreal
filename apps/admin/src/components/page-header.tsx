import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Tiêu đề trang. Gọn hơn trước (chữ nhỏ hơn, khoảng cách dưới ít hơn) để danh sách
 * hiện được nhiều dòng hơn trong một màn hình.
 */
export function PageHeader({
    title,
    description,
    actions,
    backHref,
    backLabel = 'Quay lại',
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    /** Có thì hiện mũi tên quay lại ngay trên tiêu đề */
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                {backHref && (
                    <Link
                        href={backHref}
                        className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-3.5" />
                        {backLabel}
                    </Link>
                )}
                <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
