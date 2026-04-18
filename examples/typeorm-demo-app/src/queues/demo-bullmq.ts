import { Queue, QueueEvents, Worker, type Job } from 'bullmq';
import { BullMqQueueAdapter } from '#src/extensions/bullmq-queue/index.js';

const redisConnection = {
  host: process.env['REDIS_HOST'] ?? '127.0.0.1',
  port: Number(process.env['REDIS_PORT'] ?? 6379),
  maxRetriesPerRequest: null,
} as const;

const queuePrefix = process.env['DEMO_QUEUE_PREFIX'] ?? process.env['DB_NAME'] ?? 'typeorm-demo';
const activeImportJobDurationMs = resolveActiveImportJobDurationMs();

const queueDefinitions = {
  email: {
    name: `${queuePrefix}-email`,
    label: 'Email',
    description: 'Transactional messages waiting for SMTP delivery.',
  },
  webhooks: {
    name: `${queuePrefix}-webhooks`,
    label: 'Webhooks',
    description: 'Outbound partner webhook fanout and retries.',
  },
  imports: {
    name: `${queuePrefix}-imports`,
    label: 'Imports',
    description: 'Nightly ingest and reconciliation jobs.',
  },
} as const;

const queues = {
  email: createQueue(queueDefinitions.email.name),
  webhooks: createQueue(queueDefinitions.webhooks.name),
  imports: createQueue(queueDefinitions.imports.name),
};

const queueEvents = {
  email: new QueueEvents(queueDefinitions.email.name, { connection: redisConnection }),
  webhooks: new QueueEvents(queueDefinitions.webhooks.name, { connection: redisConnection }),
  imports: new QueueEvents(queueDefinitions.imports.name, { connection: redisConnection }),
};

let workers: Worker[] = [];
let workersStarted = false;

export const demoBullMqQueueAdapter = new BullMqQueueAdapter({
  queues,
});

export async function resetDemoBullMqQueues(): Promise<void> {
  await ensureWorkersStarted();

  for (const queue of Object.values(queues)) {
    await queue.resume();
    await queue.obliterate({ force: true });
  }

  await seedEmailQueue();
  await seedImportsQueue();
  await seedWebhookQueue();
}

export async function closeDemoBullMqInfrastructure(): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
  workersStarted = false;
  await Promise.all(Object.values(queueEvents).map((events) => events.close()));
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}

async function ensureWorkersStarted(): Promise<void> {
  if (workersStarted) {
    return;
  }

  workers = [
    new Worker(
      queueDefinitions.email.name,
      async (job) => processEmailJob(job),
      {
        connection: redisConnection,
      },
    ),
    new Worker(
      queueDefinitions.imports.name,
      async (job) => processImportJob(job),
      {
        connection: redisConnection,
      },
    ),
  ];

  await Promise.all(workers.map((worker) => worker.waitUntilReady()));
  await Promise.all(Object.values(queueEvents).map((events) => events.waitUntilReady()));
  workersStarted = true;
}

async function seedEmailQueue(): Promise<void> {
  for (const payload of [
    { name: 'send-order-confirmation', data: { orderId: 1, orderNumber: 'ORD-1001', template: 'order-confirmation' } },
    { name: 'send-order-confirmation', data: { orderId: 22, orderNumber: 'ORD-1022', template: 'order-confirmation' } },
    { name: 'send-password-reset', data: { userId: 1, template: 'password-reset' } },
    { name: 'send-welcome-email', data: { userId: 2, template: 'welcome' } },
    { name: 'send-security-alert', data: { userId: 3, template: 'security-alert' } },
    { name: 'send-billing-reminder', data: { userId: 4, template: 'billing-reminder' } },
  ]) {
    const job = await queues.email.add(
      payload.name,
      payload.data,
      { removeOnComplete: false, removeOnFail: false },
    );
    await job.waitUntilFinished(queueEvents.email);
  }

  for (const payload of [
    { name: 'send-order-receipt', data: { orderId: 1, orderNumber: 'ORD-1001', template: 'receipt', shouldFail: true }, attempts: 3 },
    { name: 'send-invoice-reminder', data: { orderId: 22, orderNumber: 'ORD-1022', template: 'invoice-reminder', shouldFail: true }, attempts: 2 },
    { name: 'send-digest-email', data: { userId: 3, template: 'weekly-digest', shouldFail: true }, attempts: 2 },
    { name: 'send-invoice-email', data: { invoiceId: 88, template: 'invoice', shouldFail: true }, attempts: 2 },
  ]) {
    const job = await queues.email.add(
      payload.name,
      payload.data,
      { removeOnComplete: false, removeOnFail: false, attempts: payload.attempts },
    );
    await waitForTerminalState(job.id!, queueEvents.email);
  }

  for (const payload of [
    { name: 'send-marketing-digest', data: { segment: 'vip', template: 'marketing-digest' } },
    { name: 'send-contract-renewal', data: { contractId: 14, template: 'renewal' } },
  ]) {
    await queues.email.add(
      payload.name,
      payload.data,
      { removeOnComplete: false, removeOnFail: false, delay: 3 * 60 * 60 * 1000 },
    );
  }
}

async function seedImportsQueue(): Promise<void> {
  for (const source of [
    'northwind/nightly.csv',
    'northwind/reconciliation.csv',
    'northwind/catalog.csv',
    'northwind/customer-sync.csv',
  ]) {
    const job = await queues.imports.add(
      `import-${source.split('/').pop()?.replace('.csv', '') ?? 'dataset'}`,
      { source },
      { removeOnComplete: false, removeOnFail: false },
    );
    await job.waitUntilFinished(queueEvents.imports);
  }

  for (const source of [
    'northwind/backfill.csv',
    'northwind/pricing-refresh.csv',
    'northwind/supplier-sync.csv',
  ]) {
    await queues.imports.add(
      `import-${source.split('/').pop()?.replace('.csv', '') ?? 'delayed'}`,
      { source },
      { removeOnComplete: false, removeOnFail: false, delay: 6 * 60 * 60 * 1000 },
    );
  }

  await queues.imports.add(
    'run-live-import',
    { source: 'northwind/live-sync.csv', durationMs: activeImportJobDurationMs },
    { removeOnComplete: false, removeOnFail: false },
  );
}

async function seedWebhookQueue(): Promise<void> {
  await queues.webhooks.pause();
  for (const payload of [
    { name: 'emit-order-queued', data: { orderId: 1, orderNumber: 'ORD-1001', target: 'erp' } },
    { name: 'emit-order-queued', data: { orderId: 22, orderNumber: 'ORD-1022', target: 'erp' } },
    { name: 'emit-customer-sync', data: { customerId: 2, target: 'crm' } },
    { name: 'emit-inventory-sync', data: { sku: 'NW-010', target: 'warehouse' } },
    { name: 'emit-order-updated', data: { orderId: 305, target: 'erp' } },
    { name: 'emit-return-created', data: { returnId: 41, target: 'returns-service' } },
  ]) {
    await queues.webhooks.add(
      payload.name,
      payload.data,
      { removeOnComplete: false, removeOnFail: false },
    );
  }

  for (const payload of [
    { name: 'emit-order-retry', data: { orderId: 1, orderNumber: 'ORD-1001', target: 'billing' } },
    { name: 'emit-order-retry', data: { orderId: 22, orderNumber: 'ORD-1022', target: 'billing' } },
    { name: 'emit-order-created', data: { orderId: 302, target: 'erp' } },
    { name: 'emit-delayed-billing-sync', data: { orderId: 303, target: 'billing' } },
    { name: 'emit-delayed-warehouse-sync', data: { sku: 'NW-007', target: 'warehouse' } },
  ]) {
    await queues.webhooks.add(
      payload.name,
      payload.data,
      { removeOnComplete: false, removeOnFail: false, delay: 2 * 60 * 60 * 1000 },
    );
  }
}

function createQueue(name: string) {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}

async function processEmailJob(job: Job): Promise<unknown> {
  const data = job.data as Record<string, unknown>;
  if (data['shouldFail'] === true) {
    throw new Error('SMTP timeout');
  }

  return {
    delivered: true,
    template: job.name,
  };
}

async function processImportJob(job: Job): Promise<unknown> {
  const data = job.data as Record<string, unknown>;
  const durationMs = Number(data['durationMs'] ?? 0);
  if (durationMs > 0) {
    await sleep(durationMs);
  }

  return {
    importedRows: 42,
    skippedRows: job.name === 'run-nightly-import' ? 3 : 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveActiveImportJobDurationMs(): number {
  const configuredDuration = process.env['DEMO_ACTIVE_JOB_DURATION_MS'];
  if (configuredDuration) {
    return Number(configuredDuration);
  }

  if (process.env['ADMIN_E2E_ENABLE_RESET'] === 'true') {
    return 1_000;
  }

  return 60_000;
}

async function waitForTerminalState(jobId: string, events: QueueEvents): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for BullMQ job "${jobId}"`));
    }, 10_000);

    const cleanup = () => {
      clearTimeout(timeout);
      events.off('completed', onCompleted);
      events.off('failed', onFailed);
    };

    const onCompleted = ({ jobId: completedJobId }: { jobId: string }) => {
      if (completedJobId === jobId) {
        cleanup();
        resolve();
      }
    };

    const onFailed = ({ jobId: failedJobId }: { jobId: string }) => {
      if (failedJobId === jobId) {
        cleanup();
        resolve();
      }
    };

    events.on('completed', onCompleted);
    events.on('failed', onFailed);
  });
}
