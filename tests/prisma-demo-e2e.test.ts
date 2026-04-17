import { defineDemoAdminE2ETests } from './helpers/admin-demo-e2e-suite.js';

defineDemoAdminE2ETests({
  name: 'Prisma demo e2e',
  port: 3112,
  entrypoint: 'examples/prisma-demo-app/src/main.ts',
  setupCommand: ['npm', 'run', 'prisma:setup:example'],
  env: {
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/nestjs_dj_admin_prisma_e2e?schema=public',
  },
});
