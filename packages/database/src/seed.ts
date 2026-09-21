import { createPrismaClient } from './index';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Thiếu biến DATABASE_URL');
  process.exit(1);
}

const db = createPrismaClient({ connectionString, maxConnections: 1 });

/** Showroom: chỉ là thông tin (SEO, nhận hàng tại showroom), không theo dõi tồn kho */
const locations = [
  { code: 'CH-HCM-01', name: 'Showroom TP.HCM 1', type: 'STORE', region: 'HCM' },
  { code: 'CH-HCM-02', name: 'Showroom TP.HCM 2', type: 'STORE', region: 'HCM' },
  { code: 'CH-HN-01', name: 'Showroom Hà Nội', type: 'STORE', region: 'HN' },
] as const;

/**
 * Nhóm khách. Mỗi khách bắt buộc thuộc một nhóm; khách tự đặt trên web vào nhóm mặc định.
 * Database cho phép tối đa MỘT nhóm is_default.
 */
const customerGroups = [
  { code: 'RETAIL', name: 'Khách lẻ', description: 'Khách mua lẻ trên website, Zalo hoặc tại showroom', isDefault: true, sortOrder: 0 },
  { code: 'PROJECT', name: 'Khách công trình', description: 'Chủ đầu tư, nhà thầu mua số lượng lớn theo báo giá', isDefault: false, sortOrder: 1 },
] as const;

async function main() {
  for (const location of locations) {
    await db.location.upsert({
      where: { code: location.code },
      update: {},
      create: { ...location, address: 'Chưa cập nhật' },
    });
  }

  for (const group of customerGroups) {
    await db.customerGroup.upsert({
      where: { code: group.code },
      // Không ghi đè tên/mô tả nếu quản trị đã sửa
      update: {},
      create: group,
    });
  }

  const [locationCount, groupCount] = await Promise.all([db.location.count(), db.customerGroup.count()]);
  console.log(`✅ Seed xong. Showroom: ${locationCount}, nhóm khách: ${groupCount}`);
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());