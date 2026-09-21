import { Injectable } from '@nestjs/common';
import { VN_PROVINCES, VN_WARDS } from './vn-admin-units';

export interface ResolvedAddress {
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  /** Khu vực công ty có showroom; null nếu ở tỉnh khác */
  region: 'HCM' | 'HN' | null;
}

/** Mã tỉnh có showroom: TP.HCM (79), Hà Nội (01) */
const REGION_BY_PROVINCE: Record<string, 'HCM' | 'HN'> = { '79': 'HCM', '01': 'HN' };

/** Đơn vị hành chính 2 cấp (34 tỉnh, 3.321 phường/xã) sau sáp nhập 01/07/2025 */
@Injectable()
export class GeoService {
  provinces() {
    return VN_PROVINCES;
  }

  wards(provinceCode: string) {
    return (VN_WARDS[provinceCode] ?? []).map(([code, name]) => ({ code, name }));
  }

  /** Tra tên từ mã và kiểm tra phường thuộc đúng tỉnh. Trả về null nếu không hợp lệ. */
  resolve(provinceCode: string, wardCode: string): ResolvedAddress | null {
    const province = VN_PROVINCES.find((item) => item.code === provinceCode);
    const ward = VN_WARDS[provinceCode]?.find(([code]) => code === wardCode);
    if (!province || !ward) return null;
    return {
      provinceCode,
      provinceName: province.name,
      wardCode,
      wardName: ward[1],
      region: REGION_BY_PROVINCE[provinceCode] ?? null,
    };
  }
}