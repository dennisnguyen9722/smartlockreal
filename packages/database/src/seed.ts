import { createPrismaClient } from './index';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Thiếu biến DATABASE_URL');
  process.exit(1);
}

const db = createPrismaClient({ connectionString, maxConnections: 1 });

// Mã điểm (code) sẽ dùng để ánh xạ sang mã kho trong MISA
const locations = [
  { code: 'KHO-HCM', name: 'Kho tổng TP.HCM', type: 'WAREHOUSE', region: 'HCM' },
  { code: 'CH-HCM-01', name: 'Cửa hàng TP.HCM 1', type: 'STORE', region: 'HCM' },
  { code: 'CH-HCM-02', name: 'Cửa hàng TP.HCM 2', type: 'STORE', region: 'HCM' },
  { code: 'CH-HN-01', name: 'Cửa hàng Hà Nội', type: 'STORE', region: 'HN' },
] as const;

async function main() {
  for (const location of locations) {
    await db.location.upsert({
      where: { code: location.code },
      update: {},
      create: { ...location, address: 'Chưa cập nhật' },
    });
  }
  const total = await db.location.count();
  console.log(`✅ Seed xong. Tổng số điểm tồn kho: ${total}`);
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());