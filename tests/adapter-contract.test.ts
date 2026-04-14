import 'reflect-metadata';
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { DataSource, EntitySchema } from 'typeorm';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PrismaAdminAdapter, TypeOrmAdminAdapter } from '../src/index.js';
import type { AdminAdapter, AdminAdapterResource } from '../src/index.js';
import { InMemoryAdminAdapter, IN_MEMORY_ADMIN_STORE } from '../src/admin/adapters/in-memory.adapter.js';
import { User as PrismaUser } from '../examples/prisma-demo-app/src/modules/user/user.entity.js';

const execFileAsync = promisify(execFile);

type AdapterHarness = {
  adapter: AdminAdapter;
  resource: AdminAdapterResource;
  reset(): Promise<void>;
  dispose(): Promise<void>;
  getIdByEmail(email: string): Promise<string>;
};

const TEST_USERS = [
  {
    email: 'ada@example.com',
    phone: '+1 206 555 0101',
    profileUrl: 'https://example.com/users/ada',
    role: 'admin',
    passwordHash: 'hash-ada',
    active: true,
  },
  {
    email: 'grace@example.com',
    phone: '+1 206 555 0102',
    profileUrl: 'https://example.com/users/grace',
    role: 'editor',
    passwordHash: 'hash-grace',
    active: true,
  },
  {
    email: 'linus@example.com',
    phone: '+1 206 555 0103',
    profileUrl: 'https://example.com/users/linus',
    role: 'viewer',
    passwordHash: 'hash-linus',
    active: false,
  },
] as const;

const POSTGRES_CONFIG = {
  host: process.env['DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['DB_PORT'] ?? 5432),
  user: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  database: process.env['DB_NAME'] ?? 'nestjs_dj_admin_demo',
};

const USER_RESOURCE_FIELDS = [
  { name: 'id', label: 'Id', input: 'text', required: false, readOnly: true },
  { name: 'email', label: 'Email', input: 'email', required: true, readOnly: false },
  { name: 'phone', label: 'Phone', input: 'tel', required: false, readOnly: false },
  { name: 'profileUrl', label: 'Profile URL', input: 'url', required: false, readOnly: false },
  { name: 'role', label: 'Role', input: 'select', required: true, readOnly: false },
  { name: 'active', label: 'Active', input: 'checkbox', required: true, readOnly: false },
  { name: 'passwordHash', label: 'Password Hash', input: 'text', required: true, readOnly: false },
  { name: 'createdAt', label: 'Created At', input: 'datetime-local', required: false, readOnly: true },
  { name: 'updatedAt', label: 'Updated At', input: 'datetime-local', required: false, readOnly: true },
] as const;

const postgresAvailable = await canConnectToPostgres();

class PlainUserModel {}

const TypeOrmUserSchema = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    email: {
      type: String,
      unique: true,
    },
    phone: {
      type: String,
      default: '',
    },
    profileUrl: {
      type: String,
      default: '',
    },
    role: {
      type: String,
    },
    passwordHash: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: 'timestamptz',
      createDate: true,
    },
    updatedAt: {
      type: 'timestamptz',
      updateDate: true,
    },
  },
});

describe('InMemoryAdminAdapter contract', async () => {
  const harness = await createInMemoryHarness();
  await runAdapterContractSuite(harness);
});

describe(
  'TypeOrmAdminAdapter contract',
  { skip: !postgresAvailable },
  async () => {
    const harness = await createTypeOrmHarness();
    await runAdapterContractSuite(harness);
  },
);

describe(
  'PrismaAdminAdapter contract',
  { skip: !postgresAvailable },
  async () => {
    const harness = await createPrismaHarness();
    await runAdapterContractSuite(harness);
  },
);

async function runAdapterContractSuite(harness: AdapterHarness) {
  beforeEach(async () => {
    await harness.reset();
  });

  after(async () => {
    await harness.dispose();
  });

  it('findMany supports pagination and sorting', async () => {
    const pageOne = await harness.adapter.findMany(harness.resource, {
      page: 1,
      pageSize: 2,
      sort: 'email',
      order: 'asc',
    });
    const pageTwo = await harness.adapter.findMany(harness.resource, {
      page: 2,
      pageSize: 2,
      sort: 'email',
      order: 'asc',
    });

    assert.equal(pageOne.total, 3);
    assert.deepEqual(pageOne.items.map((item) => String((item as Record<string, unknown>).email)), [
      'ada@example.com',
      'grace@example.com',
    ]);
    assert.deepEqual(pageTwo.items.map((item) => String((item as Record<string, unknown>).email)), [
      'linus@example.com',
    ]);
  });

  it('findMany supports filtering', async () => {
    const single = await harness.adapter.findMany(harness.resource, {
      page: 1,
      pageSize: 10,
      filters: { role: 'editor' },
    });
    const multi = await harness.adapter.findMany(harness.resource, {
      page: 1,
      pageSize: 10,
      filters: { role: ['admin', 'viewer'] },
    });

    assert.deepEqual(single.items.map((item) => String((item as Record<string, unknown>).email)), [
      'grace@example.com',
    ]);
    assert.deepEqual(
      multi.items.map((item) => String((item as Record<string, unknown>).email)).sort(),
      ['ada@example.com', 'linus@example.com'],
    );
  });

  it('findMany supports search', async () => {
    const result = await harness.adapter.findMany(harness.resource, {
      page: 1,
      pageSize: 10,
      search: 'grace@example.com',
    });

    assert.equal(result.total, 1);
    assert.equal(String((result.items[0] as Record<string, unknown>).email), 'grace@example.com');
  });

  it('findOne returns a matching record', async () => {
    const id = await harness.getIdByEmail('ada@example.com');
    const record = await harness.adapter.findOne(harness.resource, id);

    assert.ok(record);
    assert.equal(String((record as Record<string, unknown>).email), 'ada@example.com');
  });

  it('create persists a new record', async () => {
    const created = await harness.adapter.create(harness.resource, {
      email: 'new-user@example.com',
      phone: '+1 206 555 0199',
      profileUrl: 'https://example.com/users/new-user',
      role: 'viewer',
      passwordHash: 'hash-new',
      active: true,
    });

    const createdId = String((created as Record<string, unknown>).id);
    const fetched = await harness.adapter.findOne(harness.resource, createdId);

    assert.ok(fetched);
    assert.equal(String((fetched as Record<string, unknown>).email), 'new-user@example.com');
    assert.equal(String((fetched as Record<string, unknown>).passwordHash), 'hash-new');
  });

  it('update persists changes', async () => {
    const id = await harness.getIdByEmail('grace@example.com');

    await harness.adapter.update(harness.resource, id, {
      phone: '+1 206 555 9999',
      active: false,
    });

    const updated = await harness.adapter.findOne(harness.resource, id);
    assert.ok(updated);
    assert.equal(String((updated as Record<string, unknown>).phone), '+1 206 555 9999');
    assert.equal(Boolean((updated as Record<string, unknown>).active), false);
  });

  it('delete removes a record', async () => {
    const id = await harness.getIdByEmail('linus@example.com');

    await harness.adapter.delete(harness.resource, id);

    const deleted = await harness.adapter.findOne(harness.resource, id);
    const remaining = await harness.adapter.findMany(harness.resource, {
      page: 1,
      pageSize: 10,
      sort: 'email',
      order: 'asc',
    });

    assert.equal(deleted, null);
    assert.equal(remaining.total, 2);
    assert.deepEqual(remaining.items.map((item) => String((item as Record<string, unknown>).email)), [
      'ada@example.com',
      'grace@example.com',
    ]);
  });

  it('distinct returns unique values', async () => {
    const values = await harness.adapter.distinct?.(harness.resource, 'role');

    assert.deepEqual((values ?? []).map(String).sort(), ['admin', 'editor', 'viewer']);
  });
}

async function createInMemoryHarness(): Promise<AdapterHarness> {
  const adapter = new InMemoryAdminAdapter();
  adapter.onModuleInit();

  return {
    adapter,
    resource: createUserResource(PlainUserModel),
    async reset() {
      IN_MEMORY_ADMIN_STORE.users = TEST_USERS.map((user, index) => ({
        id: String(index + 1),
        ...user,
        createdAt: `2026-04-0${index + 1}T08:00:00.000Z`,
        updatedAt: `2026-04-1${index}T08:00:00.000Z`,
      }));
    },
    async dispose() {},
    async getIdByEmail(email: string) {
      const record = IN_MEMORY_ADMIN_STORE.users.find((user) => String(user.email) === email);
      assert.ok(record, `Expected to find seeded in-memory user ${email}`);
      return String(record.id);
    },
  };
}

async function createTypeOrmHarness(): Promise<AdapterHarness> {
  const schema = `adapter_contract_typeorm_${randomUUID().replace(/-/g, '')}`;
  await createSchema(schema);

  const dataSource = new DataSource({
    type: 'postgres',
    host: POSTGRES_CONFIG.host,
    port: POSTGRES_CONFIG.port,
    username: POSTGRES_CONFIG.user,
    password: POSTGRES_CONFIG.password,
    database: POSTGRES_CONFIG.database,
    schema,
    entities: [TypeOrmUserSchema],
    synchronize: true,
  });

  await dataSource.initialize();
  const adapter = new TypeOrmAdminAdapter(dataSource);

  return {
    adapter,
    resource: createUserResource(TypeOrmUserSchema),
    async reset() {
      await truncateUsers(schema);
      await dataSource.getRepository(TypeOrmUserSchema).save(TEST_USERS.map((user) => ({ ...user })));
    },
    async dispose() {
      await dataSource.destroy();
      await dropSchema(schema);
    },
    async getIdByEmail(email: string) {
      const user = await dataSource.getRepository(TypeOrmUserSchema).findOneByOrFail({ email });
      return String(user.id);
    },
  };
}

async function createPrismaHarness(): Promise<AdapterHarness> {
  const databaseName = `adapter_contract_prisma_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  await createDatabase(databaseName);

  const databaseUrl = buildDatabaseUrlForDatabase(databaseName);
  await execFileAsync(resolveNpx(), [
    'prisma',
    'db',
    'push',
    '--config',
    'examples/prisma-demo-app/prisma.config.ts',
    '--url',
    databaseUrl,
  ], {
    cwd: process.cwd(),
    env: process.env,
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  await prisma.$connect();

  return {
    adapter: new PrismaAdminAdapter(prisma),
    resource: createUserResource(PrismaUser),
    async reset() {
      await prisma.user.deleteMany();
      await prisma.user.createMany({
        data: TEST_USERS.map((user) => ({ ...user })),
      });
    },
    async dispose() {
      await prisma.$disconnect();
      await dropDatabase(databaseName);
    },
    async getIdByEmail(email: string) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      return String(user.id);
    },
  };
}

function createUserResource(model: unknown): AdminAdapterResource {
  return {
    resourceName: 'users',
    label: 'User',
    model: model as never,
    search: ['email', 'phone', 'profileUrl'],
    filters: ['role', 'active'],
    fields: [...USER_RESOURCE_FIELDS],
  };
}

async function canConnectToPostgres(): Promise<boolean> {
  const client = new Client({
    host: POSTGRES_CONFIG.host,
    port: POSTGRES_CONFIG.port,
    user: POSTGRES_CONFIG.user,
    password: POSTGRES_CONFIG.password,
    database: POSTGRES_CONFIG.database,
    connectionTimeoutMillis: 1000,
  });

  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function createSchema(schema: string): Promise<void> {
  const client = new Client(POSTGRES_CONFIG);
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await client.end();
  }
}

async function dropSchema(schema: string): Promise<void> {
  const client = new Client(POSTGRES_CONFIG);
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}

async function truncateUsers(schema: string): Promise<void> {
  const client = new Client(POSTGRES_CONFIG);
  await client.connect();
  try {
    await client.query(`TRUNCATE TABLE "${schema}"."users" RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

function buildDatabaseUrlForDatabase(databaseName: string): string {
  return `postgresql://${POSTGRES_CONFIG.user}:${POSTGRES_CONFIG.password}@${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}/${databaseName}`;
}

function resolveNpx(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

async function createDatabase(databaseName: string): Promise<void> {
  const client = new Client({
    ...POSTGRES_CONFIG,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }
}

async function dropDatabase(databaseName: string): Promise<void> {
  const client = new Client({
    ...POSTGRES_CONFIG,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await client.end();
  }
}
