import 'reflect-metadata';
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { EntitySchema as MikroEntitySchema } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { Client } from 'pg';
import { DataSource, EntitySchema } from 'typeorm';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { MikroOrmAdminAdapter, PrismaAdminAdapter, TypeOrmAdminAdapter } from '../src/index.js';
import type { AdminAdapter, AdminAdapterResource } from '../src/index.js';
import { InMemoryAdminAdapter, createInMemoryAdminStore } from '../src/admin/adapters/in-memory.adapter.js';
import { Order as PrismaOrder } from '../examples/prisma-demo-app/src/modules/order/order.entity.js';
import { User as PrismaUser } from '../examples/prisma-demo-app/src/modules/user/user.entity.js';

const execFileAsync = promisify(execFile);

type AdapterHarness = {
  adapter: AdminAdapter;
  resource: AdminAdapterResource;
  orderResource: AdminAdapterResource;
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

const TEST_ORDERS = [
  {
    number: 'ORD-1001',
    orderDate: '2026-04-01',
    deliveryTime: '09:00',
    fulfillmentAt: '2026-04-01T09:30:00.000Z',
    userEmail: 'ada@example.com',
    status: 'pending',
    total: 129.99,
    internalNote: 'Call before delivery.',
  },
  {
    number: 'ORD-1002',
    orderDate: '2026-04-02',
    deliveryTime: '14:30',
    fulfillmentAt: '2026-04-02T14:15:00.000Z',
    userEmail: 'grace@example.com',
    status: 'paid',
    total: 349.5,
    internalNote: 'Gift order.',
  },
  {
    number: 'ORD-1003',
    orderDate: '2026-04-03',
    deliveryTime: null,
    fulfillmentAt: null,
    userEmail: 'ada@example.com',
    status: 'cancelled',
    total: 79,
    internalNote: '',
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
class PlainOrderModel {}

class MikroOrmUserModel {}
class MikroOrmOrderModel {}

const MikroOrmUserSchema = new MikroEntitySchema({
  class: MikroOrmUserModel,
  tableName: 'users',
  properties: {
    id: { type: Number, primary: true, autoincrement: true },
    email: { type: String, unique: true },
    phone: { type: String, default: '' },
    profileUrl: { type: String, default: '' },
    role: { type: String },
    passwordHash: { type: String },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, onCreate: () => new Date() },
    updatedAt: { type: Date, onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});

const MikroOrmOrderSchema = new MikroEntitySchema({
  class: MikroOrmOrderModel,
  tableName: 'orders',
  properties: {
    id: { type: Number, primary: true, autoincrement: true },
    number: { type: String, unique: true },
    orderDate: { type: 'date' },
    deliveryTime: { type: 'time', nullable: true },
    fulfillmentAt: { type: Date, nullable: true },
    userId: { type: Number },
    status: { type: String },
    total: { type: 'decimal', precision: 10, scale: 2 },
    internalNote: { type: 'text', default: '' },
    createdAt: { type: Date, onCreate: () => new Date() },
    updatedAt: { type: Date, onCreate: () => new Date(), onUpdate: () => new Date() },
  },
});

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

const TypeOrmOrderSchema = new EntitySchema({
  name: 'Order',
  tableName: 'orders',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    number: {
      type: String,
      unique: true,
    },
    orderDate: {
      type: 'date',
    },
    deliveryTime: {
      type: 'time',
      nullable: true,
    },
    fulfillmentAt: {
      type: 'timestamptz',
      nullable: true,
    },
    userId: {
      type: Number,
    },
    status: {
      type: String,
    },
    total: {
      type: 'decimal',
      precision: 10,
      scale: 2,
    },
    internalNote: {
      type: 'text',
      default: '',
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

describe(
  'MikroOrmAdminAdapter contract',
  { skip: !postgresAvailable },
  async () => {
    const harness = await createMikroOrmHarness();
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

  it('findMany supports relation-aware search', async () => {
    const result = await harness.adapter.findMany(harness.orderResource, {
      page: 1,
      pageSize: 10,
      search: 'grace@example.com',
    });

    assert.equal(result.total, 1);
    assert.equal(String((result.items[0] as Record<string, unknown>).number), 'ORD-1002');
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
  const store = createInMemoryAdminStore();
  const adapter = new InMemoryAdminAdapter(store);
  adapter.onModuleInit();

  return {
    adapter,
    resource: createUserResource(PlainUserModel),
    orderResource: createOrderResource(PlainOrderModel),
    async reset() {
      store.users = TEST_USERS.map((user, index) => ({
        id: String(index + 1),
        ...user,
        createdAt: `2026-04-0${index + 1}T08:00:00.000Z`,
        updatedAt: `2026-04-1${index}T08:00:00.000Z`,
      }));
      const userIds = Object.fromEntries(store.users.map((user) => [String(user.email), String(user.id)]));
      store.orders = TEST_ORDERS.map((order, index) => ({
        id: String(index + 101),
        number: order.number,
        orderDate: order.orderDate,
        deliveryTime: order.deliveryTime,
        fulfillmentAt: order.fulfillmentAt,
        userId: userIds[order.userEmail],
        status: order.status,
        total: order.total,
        internalNote: order.internalNote,
        createdAt: `2026-04-0${index + 4}T08:00:00.000Z`,
        updatedAt: `2026-04-1${index + 3}T08:00:00.000Z`,
      }));
    },
    async dispose() {},
    async getIdByEmail(email: string) {
      const record = store.users.find((user) => String(user.email) === email);
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
    entities: [TypeOrmUserSchema, TypeOrmOrderSchema],
    synchronize: true,
  });

  await dataSource.initialize();
  const adapter = new TypeOrmAdminAdapter(dataSource);

  return {
    adapter,
    resource: createUserResource(TypeOrmUserSchema),
    orderResource: createOrderResource(TypeOrmOrderSchema),
    async reset() {
      await truncateTables(schema, ['orders', 'users']);
      const savedUsers = await dataSource
        .getRepository(TypeOrmUserSchema)
        .save(TEST_USERS.map((user) => ({ ...user })));
      const userIds = Object.fromEntries(savedUsers.map((user) => [String(user.email), Number(user.id)]));
      await dataSource.getRepository(TypeOrmOrderSchema).save(
        TEST_ORDERS.map((order) => ({
          number: order.number,
          orderDate: order.orderDate,
          deliveryTime: order.deliveryTime,
          fulfillmentAt: order.fulfillmentAt ? new Date(order.fulfillmentAt) : null,
          userId: userIds[order.userEmail],
          status: order.status,
          total: order.total,
          internalNote: order.internalNote,
        })),
      );
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
    orderResource: createOrderResource(PrismaOrder),
    async reset() {
      await prisma.order.deleteMany();
      await prisma.user.deleteMany();
      await prisma.user.createMany({
        data: TEST_USERS.map((user) => ({ ...user })),
      });
      const users = await prisma.user.findMany({ select: { id: true, email: true } });
      const userIds = Object.fromEntries(users.map((user) => [String(user.email), Number(user.id)]));
      await prisma.order.createMany({
        data: TEST_ORDERS.map((order) => ({
          number: order.number,
          orderDate: new Date(order.orderDate),
          deliveryTime: order.deliveryTime,
          fulfillmentAt: order.fulfillmentAt ? new Date(order.fulfillmentAt) : null,
          userId: userIds[order.userEmail],
          status: order.status as never,
          total: order.total,
          internalNote: order.internalNote,
        })),
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

async function createMikroOrmHarness(): Promise<AdapterHarness> {
  const databaseName = `adapter_contract_mikroorm_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  await createDatabase(databaseName);

  const orm = await MikroORM.init({
    host: POSTGRES_CONFIG.host,
    port: POSTGRES_CONFIG.port,
    user: POSTGRES_CONFIG.user,
    password: POSTGRES_CONFIG.password,
    dbName: databaseName,
    entities: [MikroOrmUserSchema, MikroOrmOrderSchema],
    allowGlobalContext: true,
  });
  await orm.schema.create();

  return {
    adapter: new MikroOrmAdminAdapter(orm.em),
    resource: createUserResource(MikroOrmUserModel),
    orderResource: createOrderResource(MikroOrmOrderModel),
    async reset() {
      const em = orm.em.fork({ clear: true });
      await em.nativeDelete(MikroOrmOrderModel, {});
      await em.nativeDelete(MikroOrmUserModel, {});

      for (const user of TEST_USERS) {
        em.persist(em.create(MikroOrmUserModel, { ...user } as never));
      }

      await em.flush();

      const users = await em.find(MikroOrmUserModel, {}, { fields: ['id', 'email'] as never });
      const userIds = Object.fromEntries(users.map((user) => [String(user.email), Number(user.id)]));

      for (const order of TEST_ORDERS) {
        em.persist(em.create(MikroOrmOrderModel, {
          number: order.number,
          orderDate: order.orderDate,
          deliveryTime: order.deliveryTime,
          fulfillmentAt: order.fulfillmentAt ? new Date(order.fulfillmentAt) : null,
          userId: userIds[order.userEmail],
          status: order.status,
          total: order.total,
          internalNote: order.internalNote,
        } as never));
      }

      await em.flush();
    },
    async dispose() {
      await orm.close(true);
      await dropDatabase(databaseName);
    },
    async getIdByEmail(email: string) {
      const user = await orm.em.fork({ clear: true }).findOneOrFail(MikroOrmUserModel, { email });
      return String(user.id);
    },
  };
}

function createUserResource(model: unknown): AdminAdapterResource {
  return {
    resourceName: 'users',
    label: 'User',
    model: model as never,
    search: [
      { kind: 'field', path: 'email', label: 'email' },
      { kind: 'field', path: 'phone', label: 'phone' },
      { kind: 'field', path: 'profileUrl', label: 'profileUrl' },
    ],
    filters: ['role', 'active'],
    fields: [...USER_RESOURCE_FIELDS],
  };
}

function createOrderResource(model: unknown): AdminAdapterResource {
  return {
    resourceName: 'orders',
    label: 'Order',
    model: model as never,
    search: [
      { kind: 'field', path: 'number', label: 'number' },
      {
        kind: 'relation',
        path: 'userId.email',
        label: 'user email',
        relationField: 'userId',
        relationResource: 'users',
        targetField: 'email',
        valueField: 'id',
        relationKind: 'many-to-one',
      },
    ],
    filters: ['status', 'userId'],
    fields: [
      { name: 'id', label: 'Id', input: 'text', required: false, readOnly: true },
      { name: 'number', label: 'Number', input: 'text', required: true, readOnly: false },
      {
        name: 'userId',
        label: 'User',
        input: 'select',
        required: true,
        readOnly: false,
        relation: {
          kind: 'many-to-one',
          option: { resource: 'users', labelField: 'email', valueField: 'id' },
        },
      },
      { name: 'status', label: 'Status', input: 'select', required: true, readOnly: false },
    ],
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

async function truncateTables(schema: string, tables: string[]): Promise<void> {
  const client = new Client(POSTGRES_CONFIG);
  await client.connect();
  try {
    const tableList = tables.map((table) => `"${schema}"."${table}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
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
