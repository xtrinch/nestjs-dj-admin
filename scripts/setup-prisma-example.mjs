import { Client } from 'pg';

const defaultUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/nestjs_dj_admin_prisma?schema=public';
const databaseUrl = process.env.DATABASE_URL ?? defaultUrl;
const parsed = new URL(databaseUrl);
const targetDatabase = parsed.pathname.replace(/^\//, '');

if (!targetDatabase) {
  throw new Error('DATABASE_URL must include a database name');
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';
adminUrl.search = '';

const client = new Client({
  connectionString: adminUrl.toString(),
});

try {
  await client.connect();
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase]);

  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${targetDatabase.replace(/"/g, '""')}"`);
  }
} finally {
  await client.end();
}
