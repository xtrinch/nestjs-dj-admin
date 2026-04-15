import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export const DEFAULT_PRISMA_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:5432/nestjs_dj_admin_prisma?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? DEFAULT_PRISMA_DATABASE_URL,
  },
});
