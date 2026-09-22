import { z } from 'zod';
import { SlugSchema } from './catalog';
import { ExpectedUpdatedAtSchema } from './product';

/**
 * SHOWROOM (Bước 8)
 *
 * Showroom là dòng `locations` có type = STORE. Công ty không giữ kho nên KHÔNG theo dõi hàng ở showroom;
 * thông tin showroom dùng cho: trang showroom trên website (SEO địa phương, schema.org LocalBusiness)
 * và cho đơn "nhận tại showroom". Dòng WAREHOUSE (di sản) không hiện ở CMS.
 */

/** Đường dẫn trang showroom trên website. API (redirect khi đổi slug) và storefront PHẢI dùng hàm này */
export const SHOWROOM_PATH_PREFIX = '/showroom';

export function showroomPath(slug: string): string {
  return `${SHOWROOM_PATH_PREFIX}/${slug}`;
}

export const SHOWROOM_MAX_IMAGES = 10;

// ---------- Giờ mở cửa ----------

/** 1 = Thứ Hai ... 7 = Chủ nhật (giống ISO 8601) */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};

const SCHEMA_ORG_DAY: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ dạng HH:MM, vd 08:00');

export const OpeningHoursEntrySchema = z
  .object({
    day: z.number().int().min(1).max(7),
    opens: TimeSchema,
    closes: TimeSchema,
  })
  .strict()
  // Không hỗ trợ mở qua đêm: showroom không mở sau 0 giờ
  .refine((entry) => entry.closes > entry.opens, { message: 'Giờ đóng cửa phải sau giờ mở cửa', path: ['closes'] });

/** Ngày không có trong danh sách = nghỉ. Mỗi ngày một khung giờ */
export const OpeningHoursSchema = z
  .array(OpeningHoursEntrySchema)
  .max(7)
  .refine((entries) => new Set(entries.map((entry) => entry.day)).size === entries.length, 'Mỗi ngày chỉ một khung giờ');

export type OpeningHoursEntry = z.infer<typeof OpeningHoursEntrySchema>;

/**
 * Gộp các ngày liền nhau cùng giờ để hiển thị:
 * "Thứ Hai – Thứ Sáu: 08:00–21:00", "Thứ Bảy – Chủ nhật: 08:00–17:00"
 */
export function formatOpeningHours(entries: OpeningHoursEntry[]): string[] {
  const sorted = [...entries].sort((a, b) => a.day - b.day);
  const groups: { from: number; to: number; opens: string; closes: string }[] = [];
  for (const entry of sorted) {
    const last = groups.at(-1);
    if (last && last.to === entry.day - 1 && last.opens === entry.opens && last.closes === entry.closes) {
      last.to = entry.day;
    } else {
      groups.push({ from: entry.day, to: entry.day, opens: entry.opens, closes: entry.closes });
    }
  }
  return groups.map((group) => {
    const days =
      group.from === group.to ? WEEKDAY_LABEL[group.from] : `${WEEKDAY_LABEL[group.from]} – ${WEEKDAY_LABEL[group.to]}`;
    return `${days}: ${group.opens}–${group.closes}`;
  });
}

// ---------- Tọa độ ----------

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Lấy tọa độ từ chuỗi người dùng dán vào:
 * - "10.7769, 106.7009" (chuột phải trên Google Maps -> bấm vào dòng tọa độ để sao chép)
 * - Link Google Maps đầy đủ: ".../@10.7769,106.7009,17z", "...!3d10.7769!4d106.7009", "?q=10.7769,106.7009"
 * Link rút gọn (maps.app.goo.gl) KHÔNG đọc được tọa độ -> trả null.
 */
export function parseCoordinates(input: string): Coordinates | null {
  const text = decodeURIComponent(input.trim());
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // tọa độ chính xác của địa điểm (ưu tiên)
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // tâm bản đồ
    /[?&](?:q|query|ll|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      // 6 chữ số thập phân ~ 10 cm, đủ cho bản đồ
      return { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
    }
  }
  return null;
}

/** Bản đồ nhúng không cần API key (dùng ở CMS và website) */
export function mapEmbedUrl({ latitude, longitude }: Coordinates, zoom = 16): string {
  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=${zoom}&output=embed`;
}

/** Link "Chỉ đường" mở ứng dụng Google Maps */
export function directionsUrl({ latitude, longitude }: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

// ---------- Nhập liệu ----------

const OptionalText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự`).nullable().optional();
const ImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Đường dẫn ảnh không hợp lệ');

const ShowroomFields = {
  name: z.string().trim().min(1, 'Chưa nhập tên showroom').max(255, 'Tối đa 255 ký tự'),
  /** Bỏ trống thì hệ thống tự tạo từ tên */
  slug: SlugSchema.max(120).optional(),
  provinceCode: z.string().trim().min(1, 'Chưa chọn tỉnh/thành phố').max(10),
  wardCode: z.string().trim().min(1, 'Chưa chọn phường/xã').max(10),
  street: z.string().trim().min(1, 'Chưa nhập số nhà, tên đường').max(500),
  /** Hotline showroom: cho phép 1900..., 028... nên không ép dạng di động */
  phone: OptionalText(20),
  email: z
    .union([z.literal(''), z.email('Email không hợp lệ')])
    .transform((value) => (value === '' ? null : value.toLowerCase()))
    .nullable()
    .optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  googleMapsUrl: z
    .union([z.literal(''), z.url({ protocol: /^https$/, message: 'Link phải bắt đầu bằng https://' })])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  openingHours: OpeningHoursSchema.optional(),
  description: OptionalText(5000),
  imageUrls: z.array(ImageUrlSchema).max(SHOWROOM_MAX_IMAGES, `Tối đa ${SHOWROOM_MAX_IMAGES} ảnh`).optional(),
  /** Hiện trên website. Bật lần đầu cần đủ địa chỉ; API kiểm tra, database cũng chặn */
  isPublic: z.boolean().optional(),
  /** Tắt: không nhận đơn "nhận tại showroom" và ẩn khỏi website */
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
};

/** Tọa độ đi theo cặp */
function bothOrNeither(data: { latitude?: number | null; longitude?: number | null }) {
  const hasLat = data.latitude !== undefined && data.latitude !== null;
  const hasLng = data.longitude !== undefined && data.longitude !== null;
  return hasLat === hasLng;
}

export const ShowroomCreateSchema = z
  .object(ShowroomFields)
  .strict()
  .refine(bothOrNeither, { message: 'Tọa độ cần đủ vĩ độ và kinh độ', path: ['latitude'] });
export type ShowroomCreateInput = z.infer<typeof ShowroomCreateSchema>;

export const ShowroomUpdateSchema = z
  .object({
    ...ShowroomFields,
    name: ShowroomFields.name.optional(),
    // Địa chỉ đổi thì gửi đủ cả tỉnh và phường
    provinceCode: ShowroomFields.provinceCode.optional(),
    wardCode: ShowroomFields.wardCode.optional(),
    street: ShowroomFields.street.optional(),
    expectedUpdatedAt: ExpectedUpdatedAtSchema,
  })
  .strict()
  .refine((data) => (data.provinceCode === undefined) === (data.wardCode === undefined), {
    message: 'Đổi địa chỉ cần gửi cả tỉnh và phường',
    path: ['wardCode'],
  })
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined) && bothOrNeither(data), {
    message: 'Tọa độ cần đủ vĩ độ và kinh độ',
    path: ['latitude'],
  });
export type ShowroomUpdateInput = z.infer<typeof ShowroomUpdateSchema>;

// ---------- Dữ liệu API trả về ----------

export interface ShowroomListItem {
  id: string;
  code: string;
  name: string;
  slug: string | null;
  address: string;
  phone: string | null;
  region: 'HCM' | 'HN';
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  coverUrl: string | null;
  /** Còn thiếu gì để đăng lên website (rỗng = đủ) */
  missing: string[];
  updatedAt: string;
}

export interface ShowroomDetail extends ShowroomListItem {
  provinceCode: string | null;
  provinceName: string | null;
  wardCode: string | null;
  wardName: string | null;
  street: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  openingHours: OpeningHoursEntry[];
  description: string | null;
  imageUrls: string[];
  publishedAt: string | null;
  /** Số đơn "nhận tại showroom" đã gắn (để giải thích vì sao không xóa được) */
  orderCount: number;
}