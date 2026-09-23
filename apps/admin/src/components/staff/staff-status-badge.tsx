import type { StaffListItem } from '@ktm/shared';
import { Badge } from '@ktm/ui/components/badge';

/** Đã khóa (quản trị khóa) / Khóa tạm (nhập sai mật khẩu nhiều lần) / Đang hoạt động */
export function StaffStatusBadge({ staff }: { staff: Pick<StaffListItem, 'status' | 'lockedUntil'> }) {
    if (staff.status === 'DISABLED') return <Badge variant="outline">Đã khóa</Badge>;
    if (staff.lockedUntil) return <Badge variant="destructive">Khóa tạm (sai mật khẩu)</Badge>;
    return <Badge variant="secondary">Đang hoạt động</Badge>;
}
