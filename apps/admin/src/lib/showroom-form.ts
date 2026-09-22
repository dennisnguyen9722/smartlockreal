import {
    parseCoordinates,
    type OpeningHoursEntry,
    type ShowroomDetail,
} from '@ktm/shared';

/** Một dòng trong bảng giờ mở cửa (luôn đủ 7 ngày, bỏ tick = nghỉ) */
export interface DayHours {
    day: number;
    open: boolean;
    opens: string;
    closes: string;
}

/** Dữ liệu form showroom: ô nhập giữ chuỗi, đổi sang kiểu của API lúc gửi */
export interface ShowroomDraft {
    name: string;
    slug: string;
    phone: string;
    email: string;
    description: string;
    sortOrder: string;
    provinceCode: string;
    wardCode: string;
    street: string;
    /** Người dùng dán tọa độ hoặc link Google Maps */
    coordinates: string;
    googleMapsUrl: string;
    hours: DayHours[];
    imageUrls: string[];
    isActive: boolean;
    isPublic: boolean;
}

const DEFAULT_OPENS = '08:00';
const DEFAULT_CLOSES = '21:00';

export function hoursFromEntries(entries: OpeningHoursEntry[]): DayHours[] {
    return [1, 2, 3, 4, 5, 6, 7].map((day) => {
        const entry = entries.find((item) => item.day === day);
        return entry
            ? { day, open: true, opens: entry.opens, closes: entry.closes }
            : { day, open: false, opens: DEFAULT_OPENS, closes: DEFAULT_CLOSES };
    });
}

export function entriesFromHours(hours: DayHours[]): OpeningHoursEntry[] {
    return hours.filter((item) => item.open).map(({ day, opens, closes }) => ({ day, opens, closes }));
}

export function emptyShowroomDraft(): ShowroomDraft {
    return {
        name: '',
        slug: '',
        phone: '',
        email: '',
        description: '',
        sortOrder: '0',
        provinceCode: '',
        wardCode: '',
        street: '',
        coordinates: '',
        googleMapsUrl: '',
        // Mặc định mở cả tuần, người dùng bỏ tick ngày nghỉ
        hours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, open: true, opens: DEFAULT_OPENS, closes: DEFAULT_CLOSES })),
        imageUrls: [],
        isActive: true,
        isPublic: false,
    };
}

export function draftFromShowroom(showroom: ShowroomDetail): ShowroomDraft {
    return {
        name: showroom.name,
        slug: showroom.slug ?? '',
        phone: showroom.phone ?? '',
        email: showroom.email ?? '',
        description: showroom.description ?? '',
        sortOrder: String(showroom.sortOrder),
        provinceCode: showroom.provinceCode ?? '',
        wardCode: showroom.wardCode ?? '',
        street: showroom.street ?? '',
        coordinates:
            showroom.latitude !== null && showroom.longitude !== null ? `${showroom.latitude}, ${showroom.longitude}` : '',
        googleMapsUrl: showroom.googleMapsUrl ?? '',
        hours: hoursFromEntries(showroom.openingHours),
        imageUrls: showroom.imageUrls,
        isActive: showroom.isActive,
        isPublic: showroom.isPublic,
    };
}

/** Điều kiện bắt buộc để hiện trên website: khớp missingForPublic() ở API */
export function missingForPublic(draft: ShowroomDraft): string[] {
    const missing: string[] = [];
    if (!draft.slug.trim() && !draft.name.trim()) missing.push('Đường dẫn');
    if (!draft.provinceCode || !draft.wardCode || !draft.street.trim()) missing.push('Địa chỉ chuẩn (tỉnh, phường, số nhà)');
    if (!draft.phone.trim()) missing.push('Số điện thoại');
    if (!draft.hours.some((item) => item.open)) missing.push('Giờ mở cửa');
    return missing;
}

/** Nên có để trang showroom đẹp và được Google hiểu đúng (không chặn đăng) */
export function recommendedForPublic(draft: ShowroomDraft): string[] {
    const items: string[] = [];
    if (!parseCoordinates(draft.coordinates)) items.push('Tọa độ bản đồ');
    if (draft.imageUrls.length === 0) items.push('Ảnh showroom');
    if (!draft.description.trim()) items.push('Mô tả');
    return items;
}

const nullable = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Dựng dữ liệu gửi API.
 * - snapshot = null: tạo mới, gửi đủ.
 * - có snapshot: chỉ gửi trường đã đổi (địa chỉ đổi thì gửi cả tỉnh, phường, số nhà; tọa độ gửi cả cặp).
 * Trả về lỗi từng ô nếu có ô không đổi được sang kiểu của API.
 */
export function buildShowroomPayload(
    draft: ShowroomDraft,
    snapshot: ShowroomDraft | null,
): { payload: Record<string, unknown>; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const payload: Record<string, unknown> = {};
    const changed = <K extends keyof ShowroomDraft>(key: K) =>
        !snapshot || JSON.stringify(draft[key]) !== JSON.stringify(snapshot[key]);

    if (changed('name')) payload.name = draft.name.trim();
    if (changed('slug')) {
        if (draft.slug.trim()) payload.slug = draft.slug.trim();
        else if (snapshot) errors.slug = 'Đường dẫn không được để trống';
    }
    if (changed('phone')) payload.phone = nullable(draft.phone);
    if (changed('email')) payload.email = draft.email.trim();
    if (changed('description')) payload.description = nullable(draft.description);
    if (changed('googleMapsUrl')) payload.googleMapsUrl = draft.googleMapsUrl.trim();
    if (changed('imageUrls')) payload.imageUrls = draft.imageUrls;
    if (changed('isActive')) payload.isActive = draft.isActive;
    if (changed('isPublic')) payload.isPublic = draft.isPublic;
    if (changed('hours')) payload.openingHours = entriesFromHours(draft.hours);

    if (changed('sortOrder')) {
        const value = Number(draft.sortOrder.trim() || '0');
        if (!Number.isInteger(value) || value < 0) errors.sortOrder = 'Thứ tự là số nguyên từ 0';
        else payload.sortOrder = value;
    }

    if (changed('provinceCode') || changed('wardCode') || changed('street')) {
        payload.provinceCode = draft.provinceCode;
        payload.wardCode = draft.wardCode;
        payload.street = draft.street.trim();
    }

    if (changed('coordinates')) {
        if (!draft.coordinates.trim()) {
            payload.latitude = null;
            payload.longitude = null;
        } else {
            const coordinates = parseCoordinates(draft.coordinates);
            if (!coordinates) {
                errors.coordinates = 'Không đọc được tọa độ. Dán dạng "10.7769, 106.7009" hoặc link Google Maps đầy đủ';
            } else {
                payload.latitude = coordinates.latitude;
                payload.longitude = coordinates.longitude;
            }
        }
    }

    return { payload, errors };
}

/** Đổi tên ô lỗi của API/Zod sang tên ô trên form */
export function showroomFieldKey(path: string): string {
    if (path === 'latitude' || path === 'longitude') return 'coordinates';
    if (path.startsWith('openingHours')) return 'hours';
    if (path.startsWith('imageUrls')) return 'imageUrls';
    return path;
}