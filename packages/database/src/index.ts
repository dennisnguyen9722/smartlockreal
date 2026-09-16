import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

// Cho phép app dùng các kiểu và enum: Location, LocationType, Prisma...
export * from './generated/prisma/client';

export interface CreatePrismaClientOptions {
  connectionString: string;
  /** Số kết nối tối đa của MỖI tiến trình (API, worker). Mặc định 10. */
  maxConnections?: number;
}

/**
 * Tạo Prisma client dùng chung cho mọi app.
 * Mỗi tiến trình chỉ nên gọi hàm này MỘT lần và dùng lại kết quả.
 */
export function createPrismaClient({
  connectionString,
  maxConnections = 10,
}: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({ connectionString, max: maxConnections });
  return new PrismaClient({ adapter });
}