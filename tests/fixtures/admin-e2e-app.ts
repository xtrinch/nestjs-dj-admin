import 'reflect-metadata';
import { BadRequestException, Controller, Injectable, Module, Post, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { hashPassword, verifyPassword } from '../../examples/in-memory-demo-app/src/auth/password.js';
import { permissionsForDemoRole } from '../../examples/shared/src/admin-permissions.js';
import { categoryAdminOptions } from '#examples-shared/modules/category/shared.js';
import { orderAdminOptions } from '#examples-shared/modules/order/shared.js';
import { productAdminOptions } from '#examples-shared/modules/product/shared.js';
import { userAdminOptions } from '#examples-shared/modules/user/shared.js';
import { InMemoryAdminAdapter, createInMemoryAdminStore } from '../../src/admin/adapters/in-memory.adapter.js';
import { AdminModule } from '../../src/admin/admin.module.js';
import { AdminResource } from '../../src/admin/decorators/admin-resource.decorator.js';
import { adminSchemaFromZod } from '../../src/admin/schema/zod-schema.provider.js';
import { dashboardLinkWidgetExtension } from '../../src/extensions/dashboard-link-widget/index.js';
import type {
  JobListResult,
  QueueAdapter,
  QueueDetails,
  QueueJobDetails,
  QueueJobState,
  QueueSummary,
} from '../../src/extensions/bullmq-queue/index.js';
import { bullmqQueueExtension } from '../../src/extensions/bullmq-queue/index.js';
import { embedPageExtension } from '../../src/extensions/embed/index.js';
import { AdminUiService } from '../../src/admin/services/admin-ui.service.js';
import { z } from 'zod';

const dashboardPreviewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Grafana Overview</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(247, 122, 55, 0.22), transparent 22rem),
          linear-gradient(180deg, #111827 0%, #0f172a 100%);
        color: #e5e7eb;
      }
      .wrap {
        padding: 24px;
      }
      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #f59e0b;
      }
      h1 {
        margin: 8px 0 18px;
        font-size: 28px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .card {
        padding: 16px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.78);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      .metric {
        font-size: 30px;
        font-weight: 700;
        color: #f8fafc;
      }
      .label {
        margin-top: 6px;
        font-size: 13px;
        color: #94a3b8;
      }
      .chart {
        height: 280px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 14px;
        background:
          linear-gradient(180deg, rgba(30, 41, 59, 0.88) 0%, rgba(15, 23, 42, 0.95) 100%);
        position: relative;
        overflow: hidden;
      }
      .chart svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="eyebrow">Monitoring</div>
      <h1>Grafana Overview</h1>
      <div class="grid">
        <div class="card"><div class="metric">241 ms</div><div class="label">P95 latency</div></div>
        <div class="card"><div class="metric">99.98%</div><div class="label">Availability</div></div>
        <div class="card"><div class="metric">1.2k</div><div class="label">Requests / min</div></div>
      </div>
      <div class="chart">
        <svg viewBox="0 0 1200 320" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,250 C80,220 120,110 210,140 C280,160 330,250 420,210 C520,165 560,70 650,90 C760,114 790,250 880,230 C970,210 1040,110 1120,130 C1160,140 1180,148 1200,152 L1200,320 L0,320 Z" fill="url(#fill)"></path>
          <path d="M0,250 C80,220 120,110 210,140 C280,160 330,250 420,210 C520,165 560,70 650,90 C760,114 790,250 880,230 C970,210 1040,110 1120,130 C1160,140 1180,148 1200,152" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"></path>
        </svg>
      </div>
    </div>
  </body>
</html>
`;

const dashboardPreviewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(dashboardPreviewHtml)}`;
const emailQueuePayloadSchema = adminSchemaFromZod({
  display: z.object({
    userId: z.coerce.number(),
    orderId: z.coerce.number().optional(),
    template: z.string(),
  }),
  fields: {
    userId: { label: 'User' },
    orderId: { label: 'Order' },
    template: { label: 'Template' },
  },
});
const webhookQueuePayloadSchema = adminSchemaFromZod({
  display: z.object({
    orderId: z.coerce.number().optional(),
    target: z.string(),
  }),
  fields: {
    orderId: { label: 'Order' },
    target: { label: 'Target' },
  },
});
const importQueuePayloadSchema = adminSchemaFromZod({
  display: z.object({
    source: z.string(),
  }),
  fields: {
    source: { label: 'Source' },
  },
});

const SEEDED_USERS = [
  {
    id: '1',
    email: 'ada@example.com',
    phone: '+1 206 555 0101',
    profileUrl: 'https://example.com/users/ada',
    role: 'admin',
    passwordHash: 'afa966a0e009d93ec6b84a85e18b6f05:6cad40e0c9109b42799f300763f58dfe4ed1bcbabe93ff5e4d3198e40e022617eb975b08d2edc6df14c2de5239d6eb965f7881d7c377687b69b0f2c77d152a9a',
    active: true,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-10T09:30:00.000Z',
  },
  {
    id: '2',
    email: 'grace@example.com',
    phone: '+1 206 555 0102',
    profileUrl: 'https://example.com/users/grace',
    role: 'editor',
    passwordHash: '023f35ca7d651fe4461ee1fc8832b017:1ceaeaa0045c7ecde39c002c4286bc4cd418b21afbebdd2a23eaa8cc8d4dff631a2bd3c05f6192f469f57785d1ce3b0322d140dde9efea26a27c0d6c2d7d4f4b',
    active: true,
    createdAt: '2026-04-05T10:30:00.000Z',
    updatedAt: '2026-04-11T11:05:00.000Z',
  },
  {
    id: '3',
    email: 'linus@example.com',
    phone: '+1 206 555 0103',
    profileUrl: 'https://example.com/users/linus',
    role: 'viewer',
    passwordHash: 'a6edd95f7ed30a5269c01d85ba56e2ae:52bc63660f38c953162ea6ea202f333db103258172f4ba1c79bccf9e0ee2b7a7dad5a41c32974aa6640af620acda9444da4b3886fbc091ed2486faa60be8ae62',
    active: false,
    createdAt: '2026-04-07T12:15:00.000Z',
    updatedAt: '2026-04-09T16:40:00.000Z',
  },
] as const;

const SEEDED_CATEGORIES = [
  {
    id: '401',
    name: 'Beverages',
    description: 'Soft drinks, coffees, teas, beers, and ales.',
    createdAt: '2026-04-03T07:40:00.000Z',
    updatedAt: '2026-04-10T07:40:00.000Z',
  },
  {
    id: '402',
    name: 'Condiments',
    description: 'Sweet and savory sauces, relishes, spreads, and seasonings.',
    createdAt: '2026-04-03T07:41:00.000Z',
    updatedAt: '2026-04-10T07:41:00.000Z',
  },
] as const;

const SEEDED_PRODUCTS = [
  {
    id: '201',
    sku: 'NW-001',
    name: 'Chai',
    unitPrice: 18,
    unitsInStock: 39,
    discontinued: false,
    deletedAt: null,
    categories: ['401'],
    createdAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-10T08:00:00.000Z',
  },
  {
    id: '202',
    sku: 'NW-010',
    name: 'Ikura',
    unitPrice: 31,
    unitsInStock: 20,
    discontinued: false,
    deletedAt: '2026-04-12T10:15:00.000Z',
    categories: ['402'],
    createdAt: '2026-04-03T08:30:00.000Z',
    updatedAt: '2026-04-12T10:15:00.000Z',
  },
] as const;

const SEEDED_ORDERS = [
  {
    id: '301',
    number: 'ORD-1001',
    orderDate: '2026-04-08T09:00:00.000Z',
    deliveryTime: '09:30',
    fulfillmentAt: null,
    userId: '1',
    status: 'pending',
    total: 42.5,
    internalNote: 'Priority',
    createdAt: '2026-04-08T09:00:00.000Z',
    updatedAt: '2026-04-08T09:00:00.000Z',
  },
  {
    id: '302',
    number: 'ORD-1002',
    orderDate: '2026-04-09T11:15:00.000Z',
    deliveryTime: '12:00',
    fulfillmentAt: null,
    userId: '2',
    status: 'pending',
    total: 19.99,
    internalNote: '',
    createdAt: '2026-04-09T11:15:00.000Z',
    updatedAt: '2026-04-09T11:15:00.000Z',
  },
] as const;

const SEEDED_QUEUES = [
  {
    key: 'email',
    label: 'Email',
    description: 'Transactional email delivery queue.',
    isPaused: false,
    jobs: [
      {
        id: 'email-1001',
        name: 'send-welcome-email',
        state: 'waiting',
        data: { userId: '1', template: 'welcome' },
        attemptsMade: 0,
        attemptsConfigured: 3,
        progress: 0,
        createdAt: '2026-04-10T08:00:00.000Z',
        failedReason: undefined,
        result: undefined,
        stackTrace: [],
      },
      {
        id: 'email-1002',
        name: 'send-receipt',
        state: 'failed',
        data: { orderId: '301' },
        attemptsMade: 2,
        attemptsConfigured: 3,
        progress: 100,
        createdAt: '2026-04-10T08:05:00.000Z',
        processedAt: '2026-04-10T08:06:00.000Z',
        finishedAt: '2026-04-10T08:06:05.000Z',
        failedReason: 'SMTP timeout',
        result: undefined,
        stackTrace: ['Error: SMTP timeout', '    at Mailer.send (mailer.ts:18:9)'],
      },
    ],
  },
  {
    key: 'webhooks',
    label: 'Webhooks',
    description: 'Outbound webhook fanout for partner systems.',
    isPaused: true,
    jobs: [
      {
        id: 'webhooks-2001',
        name: 'emit-order-created',
        state: 'delayed',
        data: { orderId: '302', attempt: 1 },
        attemptsMade: 0,
        attemptsConfigured: 5,
        progress: 0,
        createdAt: '2026-04-11T09:10:00.000Z',
        failedReason: undefined,
        result: undefined,
        stackTrace: [],
      },
    ],
  },
  {
    key: 'imports',
    label: 'Imports',
    description: 'Batch ingest and reconciliation tasks.',
    isPaused: false,
    jobs: [
      {
        id: 'imports-3001',
        name: 'run-nightly-import',
        state: 'completed',
        data: { source: 's3://demo/import.csv' },
        attemptsMade: 1,
        attemptsConfigured: 2,
        progress: 100,
        createdAt: '2026-04-12T01:00:00.000Z',
        processedAt: '2026-04-12T01:02:00.000Z',
        finishedAt: '2026-04-12T01:03:00.000Z',
        failedReason: undefined,
        result: { imported: 42 },
        stackTrace: [],
      },
    ],
  },
] as const;

const TEST_ADMIN_STORE = createInMemoryAdminStore();
const TEST_QUEUE_STORE: TestQueueRecord[] = [];

class User {}
class Category {}
class Product {}
class Order {}

type TestQueueJob = QueueJobDetails & {
  state: QueueJobState;
};

type TestQueueRecord = {
  key: string;
  label: string;
  description?: string;
  isPaused: boolean;
  jobs: TestQueueJob[];
};

class TestQueueAdapter implements QueueAdapter {
  constructor(private readonly queues: TestQueueRecord[]) {}

  async listQueues(): Promise<QueueSummary[]> {
    return this.queues.map((queue) => this.serializeQueue(queue));
  }

  async getQueue(queueKey: string): Promise<QueueDetails> {
    return this.serializeQueue(this.requireQueue(queueKey));
  }

  async listJobs(
    queueKey: string,
    filter: QueueJobState,
    query: { page: number; pageSize: number; payloadFilters?: Array<{ path: string; value: string }> },
  ): Promise<JobListResult> {
    const queue = this.requireQueue(queueKey);
    const items = queue.jobs.filter((job) =>
      job.state === filter
      && (query.payloadFilters ?? []).every((payloadFilter) => {
        const candidate = getValueAtPath(job.data, payloadFilter.path);
        return candidate != null && String(candidate) === payloadFilter.value;
      }),
    );
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize).map((job) => ({ ...job })),
      total: items.length,
      page,
      pageSize,
    };
  }

  async getJob(queueKey: string, jobId: string): Promise<QueueJobDetails | null> {
    return this.requireQueue(queueKey).jobs.find((job) => job.id === jobId) ?? null;
  }

  async pauseQueue(queueKey: string): Promise<void> {
    this.requireQueue(queueKey).isPaused = true;
  }

  async resumeQueue(queueKey: string): Promise<void> {
    this.requireQueue(queueKey).isPaused = false;
  }

  async cleanQueue(queueKey: string, input: { limit: number; state: QueueJobState }): Promise<{ count: number }> {
    const queue = this.requireQueue(queueKey);
    const toRemove = queue.jobs.filter((job) => job.state === input.state).slice(0, input.limit);
    queue.jobs = queue.jobs.filter((job) => !toRemove.includes(job));
    return { count: toRemove.length };
  }

  async retryFailedJobs(queueKey: string, input: { count?: number }): Promise<{ count: number }> {
    const queue = this.requireQueue(queueKey);
    const retried = queue.jobs.filter((job) => job.state === 'failed').slice(0, input.count ?? 100);
    for (const job of retried) {
      job.state = 'waiting';
      job.failedReason = undefined;
      job.stackTrace = [];
      job.attemptsMade += 1;
    }

    return { count: retried.length };
  }

  async emptyQueue(queueKey: string): Promise<void> {
    this.requireQueue(queueKey).jobs = [];
  }

  async retryJob(queueKey: string, jobId: string): Promise<void> {
    const job = this.requireJob(queueKey, jobId);
    job.state = 'waiting';
    job.failedReason = undefined;
    job.stackTrace = [];
    job.attemptsMade += 1;
  }

  async removeJob(queueKey: string, jobId: string): Promise<void> {
    const queue = this.requireQueue(queueKey);
    queue.jobs = queue.jobs.filter((job) => job.id !== jobId);
  }

  async promoteJob(queueKey: string, jobId: string): Promise<void> {
    const job = this.requireJob(queueKey, jobId);
    job.state = 'waiting';
  }

  private requireQueue(queueKey: string): TestQueueRecord {
    const queue = this.queues.find((candidate) => candidate.key === queueKey);
    if (!queue) {
      throw new Error(`Unknown queue "${queueKey}"`);
    }

    return queue;
  }

  private requireJob(queueKey: string, jobId: string): TestQueueJob {
    const job = this.requireQueue(queueKey).jobs.find((candidate) => candidate.id === jobId);
    if (!job) {
      throw new Error(`Unknown job "${jobId}"`);
    }

    return job;
  }

  private serializeQueue(queue: TestQueueRecord): QueueSummary {
    return {
      key: queue.key,
      label: queue.label,
      description: queue.description,
      isPaused: queue.isPaused,
      counts: {
        waiting: queue.jobs.filter((job) => job.state === 'waiting').length,
        active: queue.jobs.filter((job) => job.state === 'active').length,
        delayed: queue.jobs.filter((job) => job.state === 'delayed').length,
        failed: queue.jobs.filter((job) => job.state === 'failed').length,
        completed: queue.jobs.filter((job) => job.state === 'completed').length,
      },
    };
  }
}

function getValueAtPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
}

class TestUserAdmin {}
Injectable()(TestUserAdmin);
AdminResource({
  model: User,
  resourceName: 'users',
  ...userAdminOptions,
  password: {
    hash: hashPassword,
    helpText:
      'Raw passwords are not stored, so there is no way to see this user’s password. You can change the password using the dedicated form.',
  },
  transformCreate: async (payload) => {
    const password = String(payload.password ?? '');
    const passwordConfirm = String(payload.passwordConfirm ?? '');

    if (!password.trim()) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [{ field: 'password', constraints: { isDefined: 'Password is required' } }],
      });
    }

    if (password !== passwordConfirm) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [{ field: 'passwordConfirm', constraints: { matches: 'Passwords do not match' } }],
      });
    }

    const next = { ...payload };
    delete next.password;
    delete next.passwordConfirm;

    return {
      ...next,
      passwordHash: hashPassword(password),
    };
  },
})(TestUserAdmin);

class TestCategoryAdmin {}
Injectable()(TestCategoryAdmin);
AdminResource({
  model: Category,
  resourceName: 'categories',
  ...categoryAdminOptions,
})(TestCategoryAdmin);

class TestProductAdmin {}
Injectable()(TestProductAdmin);
AdminResource({
  model: Product,
  resourceName: 'products',
  ...productAdminOptions,
})(TestProductAdmin);

class TestOrderAdmin {}
Injectable()(TestOrderAdmin);
AdminResource({
  model: Order,
  resourceName: 'orders',
  ...orderAdminOptions,
})(TestOrderAdmin);

class TestController {
  reset() {
    resetStore();
    return { success: true };
  }
}
Post('reset')(TestController.prototype, 'reset', Object.getOwnPropertyDescriptor(TestController.prototype, 'reset')!);
Controller('__test')(TestController);

class AdminE2EServerModule {}
Module({
  imports: [
    AdminModule.forRoot({
      path: '/admin',
      adapter: {
        useFactory: () => new InMemoryAdminAdapter(TEST_ADMIN_STORE),
      },
      extensions: [
        embedPageExtension({
          id: 'test-grafana-page',
          page: {
            slug: 'grafana-overview',
            label: 'Grafana overview',
            category: 'Monitoring',
            title: 'Grafana Overview',
            description: 'Embedded observability dashboard rendered inside the admin shell.',
            url: dashboardPreviewUrl,
            height: 720,
          },
        }),
        dashboardLinkWidgetExtension({
          id: 'test-grafana-widget',
          title: 'Grafana overview',
          description: 'Open the embedded monitoring dashboard from the admin home screen.',
          pageSlug: 'grafana-overview',
        }),
        dashboardLinkWidgetExtension({
          id: 'test-queues-widget',
          title: 'Queues',
          description: 'Inspect queue health, backlog, and recent jobs across configured queues.',
          ctaLabel: 'Open queue overview',
          pageSlug: 'queues-overview',
        }),
        bullmqQueueExtension({
          adapter: new TestQueueAdapter(TEST_QUEUE_STORE),
          queues: [
            {
              key: 'email',
              label: 'Email',
              description: 'Transactional email delivery queue.',
              payloadSchema: emailQueuePayloadSchema,
              filters: ['userId', 'orderId', 'template'],
              list: ['userId', 'template'],
            },
            {
              key: 'webhooks',
              label: 'Webhooks',
              description: 'Outbound webhook fanout for partner systems.',
              payloadSchema: webhookQueuePayloadSchema,
              filters: ['orderId', 'target'],
              list: ['target'],
            },
            {
              key: 'imports',
              label: 'Imports',
              description: 'Batch ingest and reconciliation tasks.',
              payloadSchema: importQueuePayloadSchema,
              filters: ['source'],
              list: ['source'],
            },
          ],
          recordPanels: [
            {
              resource: 'orders',
              title: 'Related queue jobs',
              links: [
                { queueKey: 'email', filterKey: 'orderId', recordField: 'id', label: 'Email jobs' },
                { queueKey: 'webhooks', filterKey: 'orderId', recordField: 'id', label: 'Webhook jobs' },
              ],
            },
          ],
        }),
      ],
      display: {
        locale: 'en-US',
      },
      auditLog: {
        enabled: true,
      },
      auth: {
        authenticate: async ({ email, password }) => {
          const user = TEST_ADMIN_STORE.users.find((candidate) => String(candidate.email) === email);
          if (!user || user.active !== true) {
            return null;
          }

          if (!verifyPassword(password, String(user.passwordHash))) {
            return null;
          }

          return {
            id: String(user.id),
            permissions: permissionsForDemoRole(String(user.role)),
            email: String(user.email),
            isSuperuser: String(user.role) === 'admin',
          };
        },
      },
    }),
  ],
  controllers: [TestController],
  providers: [TestUserAdmin, TestCategoryAdmin, TestProductAdmin, TestOrderAdmin],
})(AdminE2EServerModule);

async function bootstrap(): Promise<void> {
  resetStore();
  const app = await NestFactory.create(AdminE2EServerModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  app.get(AdminUiService).onApplicationBootstrap();

  const port = Number(process.env['ADMIN_E2E_PORT'] ?? 3101);
  await app.listen(port, '127.0.0.1');
  process.stdout.write(`ADMIN_E2E_READY ${port}\n`);
}

function resetStore() {
  TEST_ADMIN_STORE.users = SEEDED_USERS.map((user) => ({ ...user }));
  TEST_ADMIN_STORE.categories = SEEDED_CATEGORIES.map((category) => ({ ...category }));
  TEST_ADMIN_STORE.orders = SEEDED_ORDERS.map((order) => ({ ...order }));
  TEST_ADMIN_STORE.products = SEEDED_PRODUCTS.map((product) => ({ ...product }));
  TEST_ADMIN_STORE['order-details'] = [];
  TEST_QUEUE_STORE.splice(
    0,
    TEST_QUEUE_STORE.length,
    ...SEEDED_QUEUES.map((queue) => ({
      ...queue,
      jobs: queue.jobs.map((job) => ({ ...job, stackTrace: [...job.stackTrace] })),
    })),
  );
}

await bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
