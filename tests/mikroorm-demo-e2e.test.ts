import { defineDemoAdminE2ETests } from './helpers/admin-demo-e2e-suite.js';

defineDemoAdminE2ETests({
  name: 'MikroORM demo e2e',
  port: 3113,
  entrypoint: 'examples/mikroorm-demo-app/src/main.ts',
  setupCommand: ['npm', 'run', 'mikroorm:setup:example'],
  env: {
    DB_NAME: 'nestjs_dj_admin_mikroorm_e2e',
  },
});
