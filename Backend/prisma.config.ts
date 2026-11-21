import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Las migraciones usan la conexión directa (sin pooling); la API usa DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
