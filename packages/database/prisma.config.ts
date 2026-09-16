import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// File .env nằm ở thư mục gốc monorepo.
// pnpm luôn chạy script từ thư mục packages/database, nên đường dẫn là ../../.env
config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
