import pg from 'pg';

const { Client } = pg;

const database = process.env.DB_NAME ?? 'nestjs_dj_admin_demo';
const dbType = process.env.DB_TYPE ?? 'postgres';

if (dbType !== 'postgres') {
  console.log('[typeorm-demo] skipped database setup because DB_TYPE is not postgres');
  process.exit(0);
}

const client = new Client({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: 'postgres',
});

await client.connect();

try {
  const result = await client.query(
    'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
    [database],
  );

  if (!result.rows[0]?.exists) {
    await client.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
    console.log(`[typeorm-demo] created database "${database}"`);
  } else {
    console.log(`[typeorm-demo] database "${database}" already exists`);
  }
} finally {
  await client.end();
}
