import type {
  AdminExtensionActionAuditEvent,
  AdminResourceDetailPanelDefinition,
  AdminExtensionEndpointDefinition,
  AdminExtensionPostEndpointDefinition,
  DjAdminExtension,
} from '../../extension-api/types.js';

export type QueueJobState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed';

export interface QueueSummary {
  key: string;
  label: string;
  description?: string;
  filters?: QueueFilterDefinition[];
  list?: QueueListFieldDefinition[];
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

export interface QueueFilterDefinition {
  key: string;
  label: string;
  path: string;
}

export interface QueueListFieldDefinition {
  key: string;
  label: string;
  path: string;
}

export interface QueuePayloadFilter {
  path: string;
  value: string;
}

export interface QueueListQuery {
  page: number;
  pageSize: number;
  payloadFilters?: QueuePayloadFilter[];
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

    return {
      key: queueKey,
      label: queue.name,
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
    const queueDetails = await this.getQueue(queueKey);
    const payloadFilters = query.payloadFilters ?? [];

    if (payloadFilters.length === 0) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      const jobs = await queue.getJobs([filter], start, end, true);

      return {
        items: await Promise.all(jobs.map((job) => serializeJob(job))),
        total: queueDetails.counts[filter] ?? 0,
        page,
        pageSize,
      };
    }

    const totalJobs = queueDetails.counts[filter] ?? 0;
    const jobs = totalJobs > 0 ? await queue.getJobs([filter], 0, totalJobs - 1, true) : [];
    const serializedJobs = await Promise.all(jobs.map((job) => serializeJob(job)));
    const filteredJobs = serializedJobs.filter((job) => matchesPayloadFilters(job.data, payloadFilters));
    const start = (page - 1) * pageSize;

    return {
      items: filteredJobs.slice(start, start + pageSize),
      total: filteredJobs.length,
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
  filters?: QueueFilterDefinition[];
  list?: QueueListFieldDefinition[];
}

export interface BullMqQueueRecordLink {
  queueKey: string;
  filterKey: string;
  recordField?: string;
  label?: string;
  limit?: number;
}

export interface BullMqQueueRecordPanelDefinition {
  resource: string;
  title?: string;
  links: BullMqQueueRecordLink[];
}

export interface BullMqQueueExtensionOptions {
  id?: string;
  adapter: QueueAdapter;
  queues: BullMqQueueDefinition[];
  recordPanels?: BullMqQueueRecordPanelDefinition[];
}

export function bullmqQueueExtension(options: BullMqQueueExtensionOptions): DjAdminExtension {
  const readPermissions = ['queues.read'];
  const actionPermissions = ['queues.write'];
  const indexedQueues = options.queues.map((queue, index) => ({ queue, index }));
  const queueDefinitions = new Map(options.queues.map((queue) => [queue.key, queue] as const));
  const endpoints = createEndpoints(options.adapter, actionPermissions, readPermissions, queueDefinitions);
  const detailPanels = createDetailPanels(readPermissions, options.recordPanels ?? [], queueDefinitions);

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
      ...indexedQueues.map(({ queue }) => ({
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
      ...indexedQueues.map(({ queue, index }) => ({
        key: `queues:${queue.key}`,
        kind: 'page' as const,
        pageSlug: `queue-${queue.key}`,
        label: queue.label,
        category: 'Queues',
        order: index + 1,
        permissions: { read: readPermissions },
      })),
    ],
    detailPanels,
    endpoints,
  };
}

function createDetailPanels(
  readPermissions: string[],
  recordPanels: BullMqQueueRecordPanelDefinition[],
  queueDefinitions: ReadonlyMap<string, BullMqQueueDefinition>,
): AdminResourceDetailPanelDefinition[] {
  const detailPanels: Array<AdminResourceDetailPanelDefinition | null> = recordPanels
    .map((recordPanel): AdminResourceDetailPanelDefinition | null => {
      const links = recordPanel.links
        .map((link) => {
          const queueDefinition = queueDefinitions.get(link.queueKey);
          const filterDefinition = queueDefinition?.filters?.find((filter) => filter.key === link.filterKey);
          if (!queueDefinition || !filterDefinition) {
            return null;
          }

          return {
            queueKey: link.queueKey,
            queueLabel: queueDefinition.label,
            queueDescription: queueDefinition.description,
            filterKey: filterDefinition.key,
            filterLabel: filterDefinition.label,
            recordField: link.recordField ?? 'id',
            label: link.label ?? queueDefinition.label,
            limit: Math.max(1, link.limit ?? 5),
          };
        })
        .filter((link): link is NonNullable<typeof link> => link !== null);

      if (links.length === 0) {
        return null;
      }

      return {
        key: `queues:related:${recordPanel.resource}`,
        resource: recordPanel.resource,
        title: recordPanel.title ?? 'Related queue jobs',
        screen: 'bullmq-related-jobs',
        permissions: { read: readPermissions },
        config: { links },
      };
    });

  return detailPanels.filter((detailPanel): detailPanel is AdminResourceDetailPanelDefinition => detailPanel !== null);
}

function createEndpoints(
  adapter: QueueAdapter,
  actionPermissions: string[],
  readPermissions: string[],
  queueDefinitions: ReadonlyMap<string, BullMqQueueDefinition>,
): AdminExtensionEndpointDefinition[] {
  return [
    {
      key: 'queues:list',
      method: 'GET',
      path: '/queues',
      permissions: { read: readPermissions },
      handler: async () => ({
        items: (await adapter.listQueues()).map((queue) => withQueueDefinition(queue, queueDefinitions)),
      }),
    },
    {
      key: 'queues:detail',
      method: 'GET',
      path: '/queues/:queueKey',
      permissions: { read: readPermissions },
      handler: async ({ params }) => ({
        queue: withQueueDefinition(
          await adapter.getQueue(params['queueKey'] ?? ''),
          queueDefinitions,
        ),
      }),
    },
    {
      key: 'queues:jobs',
      method: 'GET',
      path: '/queues/:queueKey/jobs',
      permissions: { read: readPermissions },
      handler: async ({ params, query }) => {
        const queueDefinition = queueDefinitions.get(params['queueKey'] ?? '');
        const state = normalizeState(query['state']);
        const page = Number(firstQueryValue(query['page']) ?? 1);
        const pageSize = Number(firstQueryValue(query['pageSize']) ?? 20);
        return adapter.listJobs(params['queueKey'] ?? '', state, {
          page,
          pageSize,
          payloadFilters: (queueDefinition?.filters ?? [])
            .map((filterDefinition) => {
              const value = firstQueryValue(query[`filter_${filterDefinition.key}`]);
              return value && value.trim()
                ? { path: filterDefinition.path, value: value.trim() }
                : null;
            })
            .filter((value): value is QueuePayloadFilter => value !== null),
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
    {
      key: 'queues:related',
      method: 'GET',
      path: '/queues/:queueKey/related',
      permissions: { read: readPermissions },
      handler: async ({ params, query }) => {
        const queueKey = params['queueKey'] ?? '';
        const queueDefinition = queueDefinitions.get(queueKey);
        const filterKey = firstQueryValue(query['filterKey']) ?? '';
        const filterValue = firstQueryValue(query['filterValue'])?.trim() ?? '';
        const limit = Math.max(1, Number(firstQueryValue(query['limit']) ?? 5));
        const filterDefinition = queueDefinition?.filters?.find((filter) => filter.key === filterKey);

        if (!filterDefinition || !filterValue) {
          return { items: [] };
        }

        const items = await listRelatedJobs(adapter, queueKey, filterDefinition.path, filterValue, limit);
        return { items };
      },
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

async function listRelatedJobs(
  adapter: QueueAdapter,
  queueKey: string,
  path: string,
  value: string,
  limit: number,
): Promise<QueueJobSummary[]> {
  const jobs: QueueJobSummary[] = [];

  for (const state of ['completed', 'failed', 'waiting', 'delayed', 'active'] satisfies QueueJobState[]) {
    if (jobs.length >= limit) {
      break;
    }

    const result = await adapter.listJobs(queueKey, state, {
      page: 1,
      pageSize: limit,
      payloadFilters: [{ path, value }],
    });

    for (const job of result.items) {
      if (jobs.length >= limit) {
        break;
      }

      jobs.push(job);
    }
  }

  return jobs;
}

function withQueueDefinition<TQueue extends QueueSummary | QueueDetails>(
  queue: TQueue,
  queueDefinitions: ReadonlyMap<string, BullMqQueueDefinition>,
): TQueue {
  const definition = queueDefinitions.get(queue.key);
  if (!definition) {
    return queue;
  }

  return {
    ...queue,
    label: definition.label,
    description: definition.description,
    filters: definition.filters,
    list: definition.list,
  };
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

function matchesPayloadFilters(data: unknown, payloadFilters: QueuePayloadFilter[]): boolean {
  return payloadFilters.every((filter) => {
    const candidate = getValueAtPath(data, filter.path);
    return candidate != null && String(candidate) === filter.value;
  });
}

function getValueAtPath(value: unknown, path: string): unknown {
  if (!path) {
    return undefined;
  }

  return path.split('.').reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
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
