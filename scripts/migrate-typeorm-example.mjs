import { ensureDemoDatabase } from '../examples/typeorm-demo-app/src/database/ensure-demo-database.ts';
import { demoDataSource } from '../examples/typeorm-demo-app/src/database/demo-data.source.ts';

await ensureDemoDatabase();

console.log('[typeorm-demo] running migrations...');

await demoDataSource.initialize();

try {
  await demoDataSource.runMigrations();
  console.log('[typeorm-demo] migrations complete');
} finally {
  await demoDataSource.destroy();
}
