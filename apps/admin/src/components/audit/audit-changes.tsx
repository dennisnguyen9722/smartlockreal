'use client';

import { formatVnd } from '@ktm/shared';

/** Tên trường tiếng Việt cho những trường hay gặp trong nhật ký */
const FIELD_LABEL: Record<string, string> = {
    status: 'Trạng thái',
    title: 'Tiêu đề',
    name: 'Tên',
    fullName: 'Họ tên',
    email: 'Email',
    phone: 'Điện thoại',
    role: 'Vai trò',
    slug: 'Đường dẫn',
    isActive: 'Đang hoạt động',
    isPublic: 'Hiện trên website',
    isPublished: 'Hiện trên website',
    publishedAt: 'Thời điểm đăng',
    reason: 'Lý do',
    note: 'Ghi chú',
    revokedSessions: 'Số phiên bị đăng xuất',
    group: 'Nhóm cấu hình',
    contentChanged: 'Nội dung có sửa',
    answerChanged: 'Câu trả lời có sửa',
};

function label(key: string): string {
    return FIELD_LABEL[key] ?? key;
}

/** Số tiền trong nhật ký lưu bằng đồng (BigInt -> chuỗi), hiện cho dễ đọc */
function isMoneyField(key: string): boolean {
    return /total|amount|price|deposit|subtotal|vat/i.test(key);
}

function display(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    if (typeof value === 'object') return JSON.stringify(value);
    if (isMoneyField(key) && /^\d+$/.test(String(value))) return formatVnd(BigInt(String(value)));
    return String(value);
}

/**
 * Hiện phần "changes" của một dòng nhật ký.
 * Có before/after thì so sánh cạnh nhau; còn lại liệt kê theo cặp trường - giá trị.
 * Dữ liệu lạ (mảng, chuỗi dài) thì hiện JSON thô để không giấu thông tin.
 */
export function AuditChanges({ changes }: { changes: unknown }) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        return changes ? <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(changes, null, 2)}</pre> : null;
    }

    const record = changes as Record<string, unknown>;
    const before = record.before as Record<string, unknown> | undefined;
    const after = record.after as Record<string, unknown> | undefined;
    const others = Object.entries(record).filter(([key]) => key !== 'before' && key !== 'after');

    const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
    const hasPair = Boolean(before || after);

    return (
        <div className="space-y-3 text-xs">
            {hasPair && keys.length > 0 && (
                <table className="w-full">
                    <thead>
                        <tr className="text-muted-foreground">
                            <th className="w-40 pb-1 text-left font-normal">Trường</th>
                            <th className="pb-1 text-left font-normal">Trước</th>
                            <th className="pb-1 text-left font-normal">Sau</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map((key) => {
                            const oldValue = display(key, before?.[key]);
                            const newValue = display(key, after?.[key]);
                            if (oldValue === newValue && before && after) return null;
                            return (
                                <tr key={key} className="border-t">
                                    <td className="py-1 pr-2 align-top text-muted-foreground">{label(key)}</td>
                                    <td className="py-1 pr-2 align-top break-all line-through decoration-muted-foreground/50">{before ? oldValue : '—'}</td>
                                    <td className="py-1 align-top break-all font-medium">{after ? newValue : '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            {others.length > 0 && (
                <ul className="space-y-0.5">
                    {others.map(([key, value]) => (
                        <li key={key} className="break-all">
                            <span className="text-muted-foreground">{label(key)}: </span>
                            {display(key, value)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
