import { Queue, QueueEvents, Worker, type Job } from 'bullmq';
import { BullMqQueueAdapter } from '#src/extensions/bullmq-queue/index.js';

const redisConnection = {
  host: process.env['REDIS_HOST'] ?? '127.0.0.1',
  port: Number(process.env['REDIS_PORT'] ?? 6379),
  maxRetriesPerRequest: null,
} as const;

const queuePrefix = process.env['DEMO_QUEUE_PREFIX'] ?? process.env['DB_NAME'] ?? 'typeorm-demo';

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
  labels: {
    email: {
      label: queueDefinitions.email.label,
      description: queueDefinitions.email.description,
    },
    webhooks: {
      label: queueDefinitions.webhooks.label,
      description: queueDefinitions.webhooks.description,
    },
    imports: {
      label: queueDefinitions.imports.label,
      description: queueDefinitions.imports.description,
    },
  },
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
  const completedJob = await queues.email.add(
    'send-password-reset',
    { userId: 1, template: 'password-reset' },
    { removeOnComplete: false, removeOnFail: false },
  );
  await completedJob.waitUntilFinished(queueEvents.email);

  const failedJob = await queues.email.add(
    'send-order-receipt',
    { orderId: 301, template: 'receipt', shouldFail: true },
    { removeOnComplete: false, removeOnFail: false, attempts: 3 },
  );
  await waitForTerminalState(failedJob.id!, queueEvents.email);
}

async function seedImportsQueue(): Promise<void> {
  const completedJob = await queues.imports.add(
    'run-nightly-import',
    { source: 'northwind/nightly.csv' },
    { removeOnComplete: false, removeOnFail: false },
  );
  await completedJob.waitUntilFinished(queueEvents.imports);
}

async function seedWebhookQueue(): Promise<void> {
  await queues.webhooks.pause();
  await queues.webhooks.add(
    'emit-order-created',
    { orderId: 302, target: 'erp' },
    { removeOnComplete: false, removeOnFail: false, delay: 24 * 60 * 60 * 1000 },
  );
  await queues.webhooks.add(
    'emit-customer-sync',
    { customerId: 2, target: 'crm' },
    { removeOnComplete: false, removeOnFail: false },
  );
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
  return {
    importedRows: 42,
    skippedRows: job.name === 'run-nightly-import' ? 3 : 0,
  };
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
