import type {
  AdminExtensionActionAuditEvent,
  AdminExtensionEndpointDefinition,
  AdminExtensionPostEndpointDefinition,
  DjAdminExtension,
} from '../../extension-api/types.js';

export type QueueJobState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed';

export interface QueueSummary {
  key: string;
  label: string;
  description?: string;
  counts: Record<QueueJobState, number>;
  isPaused: boolean;
}

export type QueueDetails = QueueSummary;

export interface QueueJobSummary {
  id: string;
  name?: string;
  state: QueueJobState | string;
  data: unknown;
  progress?: unknown;
  attemptsMade: number;
  attemptsConfigured?: number;
  createdAt?: string;
  processedAt?: string;
  finishedAt?: string;
  failedReason?: string;
}

export interface QueueJobDetails extends QueueJobSummary {
  result?: unknown;
  stackTrace?: string[];
}

export interface QueueListQuery {
  page: number;
  pageSize: number;
}

export interface CleanQueueInput {
  graceMs: number;
  limit: number;
  state: QueueJobState;
}

export interface CleanQueueResult {
  count: number;
}

export interface RetryFailedJobsInput {
  count?: number;
}

export interface RetryJobsResult {
  count: number;
}

export interface JobListResult {
  items: QueueJobSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueueAdapter {
  listQueues(): Promise<QueueSummary[]>;
  getQueue(queueKey: string): Promise<QueueDetails>;
  listJobs(queueKey: string, filter: QueueJobState, query: QueueListQuery): Promise<JobListResult>;
  getJob(queueKey: string, jobId: string): Promise<QueueJobDetails | null>;
  pauseQueue(queueKey: string): Promise<void>;
  resumeQueue(queueKey: string): Promise<void>;
  cleanQueue(queueKey: string, input: CleanQueueInput): Promise<CleanQueueResult>;
  retryFailedJobs(queueKey: string, input: RetryFailedJobsInput): Promise<RetryJobsResult>;
  emptyQueue(queueKey: string): Promise<void>;
  retryJob(queueKey: string, jobId: string): Promise<void>;
  removeJob(queueKey: string, jobId: string): Promise<void>;
  promoteJob(queueKey: string, jobId: string): Promise<void>;
}

export interface BullMqJobLike {
  id?: string | number;
  name?: string;
  data?: unknown;
  progress?: unknown;
  attemptsMade?: number;
  opts?: {
    attempts?: number;
  };
  timestamp?: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
  getState(): Promise<string>;
  retry(): Promise<void>;
  remove(): Promise<void>;
  promote(): Promise<void>;
}

export interface BullMqQueueLike {
  name: string;
  getJobCounts(...types: QueueJobState[]): Promise<Record<string, number>>;
  isPaused(): Promise<boolean>;
  getJobs(types: QueueJobState[], start: number, end: number, asc?: boolean): Promise<BullMqJobLike[]>;
  getJob(id: string): Promise<BullMqJobLike | undefined | null>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  clean(graceMs: number, limit: number, type: QueueJobState): Promise<unknown[]>;
  obliterate(options?: { force?: boolean }): Promise<void>;
}

export interface BullMqQueueAdapterOptions {
  queues: Record<string, BullMqQueueLike>;
  labels?: Record<string, { label?: string; description?: string }>;
}

export class BullMqQueueAdapter implements QueueAdapter {
  constructor(private readonly options: BullMqQueueAdapterOptions) {}

  async listQueues(): Promise<QueueSummary[]> {
    const items = await Promise.all(
      Object.keys(this.options.queues).map(async (queueKey) => this.getQueue(queueKey)),
    );
    return items.sort((left, right) => left.label.localeCompare(right.label));
  }

  async getQueue(queueKey: string): Promise<QueueDetails> {
    const queue = this.requireQueue(queueKey);
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    const labels = this.options.labels?.[queueKey];

    return {
      key: queueKey,
      label: labels?.label ?? queue.name,
      description: labels?.description,
      counts: {
        waiting: counts['waiting'] ?? 0,
        active: counts['active'] ?? 0,
        delayed: counts['delayed'] ?? 0,
        failed: counts['failed'] ?? 0,
        completed: counts['completed'] ?? 0,
      },
      isPaused: await queue.isPaused(),
    };
  }

  async listJobs(queueKey: string, filter: QueueJobState, query: QueueListQuery): Promise<JobListResult> {
    const queue = this.requireQueue(queueKey);
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const [jobs, queueDetails] = await Promise.all([
      queue.getJobs([filter], start, end, true),
      this.getQueue(queueKey),
    ]);

    return {
      items: await Promise.all(jobs.map((job) => serializeJob(job))),
      total: queueDetails.counts[filter] ?? 0,
      page,
      pageSize,
    };
  }

  async getJob(queueKey: string, jobId: string): Promise<QueueJobDetails | null> {
    const queue = this.requireQueue(queueKey);
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return serializeJob(job);
  }

  async pauseQueue(queueKey: string): Promise<void> {
    await this.requireQueue(queueKey).pause();
  }

  async resumeQueue(queueKey: string): Promise<void> {
    await this.requireQueue(queueKey).resume();
  }

  async cleanQueue(queueKey: string, input: CleanQueueInput): Promise<CleanQueueResult> {
    const removed = await this.requireQueue(queueKey).clean(
      Math.max(0, input.graceMs),
      Math.max(1, input.limit),
      input.state,
    );
    return { count: removed.length };
  }

  async retryFailedJobs(queueKey: string, input: RetryFailedJobsInput): Promise<RetryJobsResult> {
    const queue = this.requireQueue(queueKey);
    const maxCount = Math.max(1, input.count ?? 100);
    const jobs = await queue.getJobs(['failed'], 0, maxCount - 1, true);
    for (const job of jobs) {
      await job.retry();
    }

    return { count: jobs.length };
  }

  async emptyQueue(queueKey: string): Promise<void> {
    await this.requireQueue(queueKey).obliterate({ force: true });
  }

  async retryJob(queueKey: string, jobId: string): Promise<void> {
    const job = await this.requireJob(queueKey, jobId);
    await job.retry();
  }

  async removeJob(queueKey: string, jobId: string): Promise<void> {
    const job = await this.requireJob(queueKey, jobId);
    await job.remove();
  }

  async promoteJob(queueKey: string, jobId: string): Promise<void> {
    const job = await this.requireJob(queueKey, jobId);
    await job.promote();
  }

  private requireQueue(queueKey: string): BullMqQueueLike {
    const queue = this.options.queues[queueKey];
    if (!queue) {
      throw new Error(`Unknown BullMQ queue "${queueKey}"`);
    }

    return queue;
  }

  private async requireJob(queueKey: string, jobId: string): Promise<BullMqJobLike> {
    const job = await this.requireQueue(queueKey).getJob(jobId);
    if (!job) {
      throw new Error(`Unknown BullMQ job "${jobId}" in queue "${queueKey}"`);
    }

    return job;
  }
}

export interface BullMqQueueDefinition {
  key: string;
  label: string;
  description?: string;
  order?: number;
}

export interface BullMqQueueExtensionOptions {
  id?: string;
  adapter: QueueAdapter;
  queues: BullMqQueueDefinition[];
}

export function bullmqQueueExtension(options: BullMqQueueExtensionOptions): DjAdminExtension {
  const readPermissions = ['queues.read'];
  const actionPermissions = ['queues.write'];
  const sortedQueues = [...options.queues].sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.label.localeCompare(right.label));
  const endpoints = createEndpoints(options.adapter, actionPermissions, readPermissions);

  return {
    id: options.id ?? 'bullmq-queues',
    pages: [
      {
        slug: 'queues-overview',
        kind: 'screen',
        route: '/queues',
        screen: 'bullmq-queue-overview',
        label: 'Overview',
        category: 'Queues',
        permissions: { read: readPermissions },
      },
      ...sortedQueues.map((queue) => ({
        slug: `queue-${queue.key}`,
        kind: 'screen' as const,
        route: `/queues/${queue.key}`,
        screen: 'bullmq-queue-detail',
        label: queue.label,
        category: 'Queues',
        title: queue.label,
        description: queue.description,
        permissions: { read: readPermissions },
      })),
      {
        slug: 'queue-job-detail',
        kind: 'screen',
        route: '/queues/:queueKey/jobs/:jobId',
        screen: 'bullmq-queue-job-detail',
        label: 'Job details',
        category: 'Queues',
        permissions: { read: readPermissions },
      },
    ],
    navItems: [
      {
        key: 'queues:overview',
        kind: 'page',
        pageSlug: 'queues-overview',
        label: 'Overview',
        category: 'Queues',
        order: -100,
        permissions: { read: readPermissions },
      },
      ...sortedQueues.map((queue) => ({
        key: `queues:${queue.key}`,
        kind: 'page' as const,
        pageSlug: `queue-${queue.key}`,
        label: queue.label,
        category: 'Queues',
        order: queue.order ?? 0,
        permissions: { read: readPermissions },
      })),
    ],
    widgets: [
      {
        key: 'queues:failed-jobs',
        kind: 'route',
        route: '/queues',
        title: 'Failed jobs',
        description: 'Review queues with recent failures.',
        ctaLabel: 'Inspect queues',
        slot: 'dashboard-main',
        order: 10,
        permissions: { read: readPermissions },
      },
      {
        key: 'queues:waiting-jobs',
        kind: 'route',
        route: '/queues',
        title: 'Waiting jobs',
        description: 'See backlog size across configured queues.',
        ctaLabel: 'Open queues',
        slot: 'dashboard-main',
        order: 11,
        permissions: { read: readPermissions },
      },
      {
        key: 'queues:paused-alert',
        kind: 'route',
        route: '/queues',
        title: 'Paused queues',
        description: 'Check queues that are currently paused.',
        ctaLabel: 'Review status',
        slot: 'dashboard-side',
        order: 12,
        permissions: { read: readPermissions },
      },
      {
        key: 'queues:unhealthy-shortcuts',
        kind: 'route',
        route: '/queues',
        title: 'Unhealthy queues',
        description: 'Jump to queues with failed or delayed work.',
        ctaLabel: 'Open unhealthy queues',
        slot: 'dashboard-side',
        order: 13,
        permissions: { read: readPermissions },
      },
    ],
    endpoints,
  };
}

function createEndpoints(
  adapter: QueueAdapter,
  actionPermissions: string[],
  readPermissions: string[],
): AdminExtensionEndpointDefinition[] {
  return [
    {
      key: 'queues:list',
      method: 'GET',
      path: '/queues',
      permissions: { read: readPermissions },
      handler: async () => ({
        items: await adapter.listQueues(),
      }),
    },
    {
      key: 'queues:detail',
      method: 'GET',
      path: '/queues/:queueKey',
      permissions: { read: readPermissions },
      handler: async ({ params }) => ({
        queue: await adapter.getQueue(params['queueKey'] ?? ''),
      }),
    },
    {
      key: 'queues:jobs',
      method: 'GET',
      path: '/queues/:queueKey/jobs',
      permissions: { read: readPermissions },
      handler: async ({ params, query }) => {
        const state = normalizeState(query['state']);
        const page = Number(firstQueryValue(query['page']) ?? 1);
        const pageSize = Number(firstQueryValue(query['pageSize']) ?? 20);
        return adapter.listJobs(params['queueKey'] ?? '', state, {
          page,
          pageSize,
        });
      },
    },
    {
      key: 'queues:job-detail',
      method: 'GET',
      path: '/queues/:queueKey/jobs/:jobId',
      permissions: { read: readPermissions },
      handler: async ({ params }) => ({
        job: await adapter.getJob(params['queueKey'] ?? '', params['jobId'] ?? ''),
      }),
    },
    queueActionEndpoint('pause', actionPermissions, async (adapterContext) => {
      await adapter.pauseQueue(adapterContext.params['queueKey'] ?? '');
      return { success: true };
    }),
    queueActionEndpoint('resume', actionPermissions, async (adapterContext) => {
      await adapter.resumeQueue(adapterContext.params['queueKey'] ?? '');
      return { success: true };
    }),
    queueActionEndpoint('empty', actionPermissions, async (adapterContext) => {
      await adapter.emptyQueue(adapterContext.params['queueKey'] ?? '');
      return { success: true };
    }),
    queueActionEndpoint('clean', actionPermissions, async (adapterContext) => {
      const payload = adapterContext.body as Partial<CleanQueueInput>;
      const result = await adapter.cleanQueue(adapterContext.params['queueKey'] ?? '', {
        graceMs: Number(payload.graceMs ?? 0),
        limit: Number(payload.limit ?? 100),
        state: normalizeState(payload.state),
      });
      return {
        success: true,
        count: result.count,
      };
    }),
    queueActionEndpoint('retry-failed', actionPermissions, async (adapterContext) => {
      const payload = adapterContext.body as Partial<RetryFailedJobsInput>;
      const result = await adapter.retryFailedJobs(adapterContext.params['queueKey'] ?? '', {
        count: payload.count == null ? undefined : Number(payload.count),
      });
      return {
        success: true,
        count: result.count,
      };
    }),
    jobActionEndpoint('retry', actionPermissions, async (adapterContext) => {
      await adapter.retryJob(adapterContext.params['queueKey'] ?? '', adapterContext.params['jobId'] ?? '');
      return { success: true };
    }),
    jobActionEndpoint('remove', actionPermissions, async (adapterContext) => {
      await adapter.removeJob(adapterContext.params['queueKey'] ?? '', adapterContext.params['jobId'] ?? '');
      return { success: true };
    }),
    jobActionEndpoint('promote', actionPermissions, async (adapterContext) => {
      await adapter.promoteJob(adapterContext.params['queueKey'] ?? '', adapterContext.params['jobId'] ?? '');
      return { success: true };
    }),
  ];
}

function queueActionEndpoint(
  action: string,
  permissions: string[],
  handler: AdminExtensionPostEndpointDefinition['handler'],
): AdminExtensionPostEndpointDefinition {
  return {
    key: `queues:${action}`,
    method: 'POST',
    path: `/queues/:queueKey/actions/${action}`,
    permissions: { execute: permissions },
    handler,
    audit: ({ params }, result) => createAuditEvent(`queue ${params['queueKey'] ?? ''}`, action, result),
  };
}

function jobActionEndpoint(
  action: string,
  permissions: string[],
  handler: AdminExtensionPostEndpointDefinition['handler'],
): AdminExtensionPostEndpointDefinition {
  return {
    key: `queues:job:${action}`,
    method: 'POST',
    path: `/queues/:queueKey/jobs/:jobId/actions/${action}`,
    permissions: { execute: permissions },
    handler,
    audit: ({ params }, result) =>
      createAuditEvent(
        `job ${params['jobId'] ?? ''} in queue ${params['queueKey'] ?? ''}`,
        action,
        result,
      ),
  };
}

async function serializeJob(job: BullMqJobLike): Promise<QueueJobDetails> {
  const state = await job.getState();

  return {
    id: String(job.id ?? ''),
    name: job.name,
    state,
    data: job.data,
    progress: job.progress,
    attemptsMade: job.attemptsMade ?? 0,
    attemptsConfigured: job.opts?.attempts,
    createdAt: asIso(job.timestamp),
    processedAt: asIso(job.processedOn),
    finishedAt: asIso(job.finishedOn),
    failedReason: job.failedReason,
    result: job.returnvalue,
    stackTrace: job.stacktrace,
  };
}

function asIso(value: number | undefined): string | undefined {
  return typeof value === 'number' ? new Date(value).toISOString() : undefined;
}

function normalizeState(value: unknown): QueueJobState {
  switch (value) {
    case 'active':
    case 'delayed':
    case 'failed':
    case 'completed':
      return value;
    default:
      return 'waiting';
  }
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function createAuditEvent(
  subject: string,
  action: string,
  result: unknown,
): AdminExtensionActionAuditEvent {
  const count = typeof result === 'object' && result !== null && 'count' in result && typeof result.count === 'number'
    ? result.count
    : undefined;

  return {
    summary: count == null ? `Ran ${action} on ${subject}` : `Ran ${action} on ${subject} (${count})`,
    objectLabel: subject,
    actionLabel: action,
    count,
  };
}
