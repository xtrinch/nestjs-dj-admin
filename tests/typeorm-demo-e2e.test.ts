import { defineDemoAdminE2ETests } from './helpers/admin-demo-e2e-suite.js';

defineDemoAdminE2ETests({
  name: 'TypeORM demo e2e',
  port: 3111,
  entrypoint: 'examples/typeorm-demo-app/src/main.ts',
  setupCommand: ['npm', 'run', 'typeorm:setup:example'],
  env: {
    DB_NAME: 'nestjs_dj_admin_demo_e2e',
  },
  expectedPageSlug: 'grafana-overview',
});
