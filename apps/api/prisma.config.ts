import { defineConfig } from 'prisma/config';

const defaultDatabaseUrl =
  'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
});

