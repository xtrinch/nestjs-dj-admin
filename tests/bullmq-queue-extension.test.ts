import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BullMqQueueAdapter,
  bullmqQueueExtension,
  type BullMqJobLike,
  type QueueJobState,
} from '../src/extensions/bullmq-queue/index.js';

class FakeJob implements BullMqJobLike {
  public processedOn?: number;
  public finishedOn?: number;
  public removed = false;
  public retried = false;
  public promoted = false;

  constructor(
    public id: string,
    public name: string,
    public state: string,
    public data: unknown,
    public attemptsMade = 0,
    public opts = { attempts: 3 },
    public timestamp = Date.now(),
    public failedReason?: string,
    public stacktrace: string[] = [],
    public returnvalue?: unknown,
    progress?: unknown,
  ) {
    this.progress = progress;
  }

  public progress?: unknown;

  async getState(): Promise<string> {
    return this.state;
  }

  async retry(): Promise<void> {
    this.retried = true;
    this.state = 'waiting';
    this.failedReason = undefined;
    this.stacktrace = [];
  }

  async remove(): Promise<void> {
    this.removed = true;
    this.state = 'removed';
  }

  async promote(): Promise<void> {
    this.promoted = true;
    this.state = 'waiting';
  }
}

class FakeQueue {
  public paused = false;
  public cleanedCalls: Array<{ graceMs: number; limit: number; type: QueueJobState }> = [];
  public obliterated = false;

  constructor(
    public readonly name: string,
    public readonly jobs: FakeJob[] = [],
  ) {}

  async getJobCounts(...types: QueueJobState[]): Promise<Record<string, number>> {
    return Object.fromEntries(types.map((type) => [type, this.jobs.filter((job) => job.state === type).length]));
  }

  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  async getJobs(types: QueueJobState[], start: number, end: number): Promise<FakeJob[]> {
    return this.jobs.filter((job) => types.includes(job.state as QueueJobState)).slice(start, end + 1);
  }

  async getJob(id: string): Promise<FakeJob | undefined> {
    return this.jobs.find((job) => job.id === id);
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
  }

  async clean(graceMs: number, limit: number, type: QueueJobState): Promise<FakeJob[]> {
    this.cleanedCalls.push({ graceMs, limit, type });
    return this.jobs.filter((job) => job.state === type).slice(0, limit);
  }

  async obliterate(): Promise<void> {
    this.obliterated = true;
    this.jobs.length = 0;
  }
}

describe('bullmq queue extension', () => {
  it('builds route-based pages, widgets, and nav items', () => {
    const extension = bullmqQueueExtension({
      adapter: new BullMqQueueAdapter({
        queues: {
          email: new FakeQueue('email'),
        },
      }),
      queues: [{
        key: 'email',
        label: 'Email',
        filters: [{ key: 'orderId', label: 'Order', path: 'orderId' }],
        list: [{ key: 'userId', label: 'User', path: 'userId' }],
      }],
      recordPanels: [
        {
          resource: 'orders',
          links: [
            { queueKey: 'email', filterKey: 'orderId', recordField: 'id' },
          ],
        },
      ],
    });

    assert.ok(extension.pages?.some((page) => page.kind === 'screen' && page.route === '/queues'));
    assert.ok(extension.pages?.some((page) => page.kind === 'screen' && page.route === '/queues/:queueKey/jobs/:jobId'));
    assert.ok(extension.navItems?.some((item) => item.kind === 'page' && item.pageSlug === 'queue-email'));
    assert.equal(extension.widgets?.length ?? 0, 0);
    assert.ok(extension.detailPanels?.some((panel) => panel.resource === 'orders' && panel.screen === 'bullmq-related-jobs'));
    assert.ok(extension.endpoints?.some((endpoint) => endpoint.path === '/queues/:queueKey/jobs/:jobId'));
  });

  it('uses queue definitions as the source of admin labels and descriptions', async () => {
    const extension = bullmqQueueExtension({
      adapter: new BullMqQueueAdapter({
        queues: {
          email: new FakeQueue('runtime-email'),
        },
      }),
      queues: [{
        key: 'email',
        label: 'Email',
        description: 'Transactional messages.',
        filters: [{ key: 'userId', label: 'User', path: 'userId' }],
        list: [{ key: 'template', label: 'Template', path: 'template' }],
      }],
    });

    const listEndpoint = extension.endpoints?.find((endpoint) => endpoint.key === 'queues:list');
    const detailEndpoint = extension.endpoints?.find((endpoint) => endpoint.key === 'queues:detail');

    assert.ok(listEndpoint && detailEndpoint);
    if (!listEndpoint || !detailEndpoint) {
      return;
    }

    const listResult = await listEndpoint.handler({ params: {}, query: {}, body: undefined, request: {} as never });
    const detailResult = await detailEndpoint.handler({
      params: { queueKey: 'email' },
      query: {},
      body: undefined,
      request: {} as never,
    });

    assert.equal(listResult.items[0]?.label, 'Email');
    assert.equal(listResult.items[0]?.description, 'Transactional messages.');
    assert.deepEqual(listResult.items[0]?.filters, [{ key: 'userId', label: 'User', path: 'userId' }]);
    assert.deepEqual(listResult.items[0]?.list, [{ key: 'template', label: 'Template', path: 'template' }]);
    assert.equal(detailResult.queue.label, 'Email');
    assert.equal(detailResult.queue.description, 'Transactional messages.');
    assert.deepEqual(detailResult.queue.filters, [{ key: 'userId', label: 'User', path: 'userId' }]);
    assert.deepEqual(detailResult.queue.list, [{ key: 'template', label: 'Template', path: 'template' }]);
  });

  it('passes configured queue filters into the jobs endpoint query', async () => {
    const extension = bullmqQueueExtension({
      adapter: new BullMqQueueAdapter({
        queues: {
          email: new FakeQueue('runtime-email', [
            new FakeJob('job-1', 'send-reset', 'completed', { userId: 1, template: 'password-reset' }),
            new FakeJob('job-2', 'send-welcome', 'completed', { userId: 2, template: 'welcome' }),
          ]),
        },
      }),
      queues: [
        {
          key: 'email',
          label: 'Email',
          filters: [
            { key: 'userId', label: 'User', path: 'userId' },
          ],
        },
      ],
    });

    const jobsEndpoint = extension.endpoints?.find((endpoint) => endpoint.key === 'queues:jobs');
    assert.ok(jobsEndpoint);
    if (!jobsEndpoint) {
      return;
    }

    const result = await jobsEndpoint.handler({
      params: { queueKey: 'email' },
      query: { state: 'completed', page: '1', pageSize: '20', filter_userId: '2' },
      body: undefined,
      request: {} as never,
    });

    assert.equal(result.total, 1);
    assert.equal(result.items[0]?.id, 'job-2');
  });

  it('returns related jobs for configured queue record links', async () => {
    const extension = bullmqQueueExtension({
      adapter: new BullMqQueueAdapter({
        queues: {
          email: new FakeQueue('runtime-email', [
            new FakeJob('job-1', 'send-reset', 'completed', { orderId: 301 }),
            new FakeJob('job-2', 'send-receipt', 'failed', { orderId: 301 }),
            new FakeJob('job-3', 'send-welcome', 'completed', { orderId: 302 }),
          ]),
        },
      }),
      queues: [
        {
          key: 'email',
          label: 'Email',
          filters: [
            { key: 'orderId', label: 'Order', path: 'orderId' },
          ],
        },
      ],
      recordPanels: [
        {
          resource: 'orders',
          links: [
            { queueKey: 'email', filterKey: 'orderId', recordField: 'id', label: 'Email jobs', limit: 5 },
          ],
        },
      ],
    });

    const relatedEndpoint = extension.endpoints?.find((endpoint) => endpoint.key === 'queues:related');
    assert.ok(relatedEndpoint);
    if (!relatedEndpoint) {
      return;
    }

    const result = await relatedEndpoint.handler({
      params: { queueKey: 'email' },
      query: { filterKey: 'orderId', filterValue: '301', limit: '5' },
      body: undefined,
      request: {} as never,
    });

    assert.deepEqual(result.items.map((item: { id: string }) => item.id), ['job-1', 'job-2']);
  });
});

describe('BullMqQueueAdapter', () => {
  it('lists queues with label, description, counts, and paused state', async () => {
    const failedJob = new FakeJob('job-2', 'send-receipt', 'failed', { orderId: 42 }, 1, { attempts: 3 }, 1_710_000_000_000, 'timeout', ['trace']);
    const completedJob = new FakeJob('job-1', 'send-welcome', 'completed', { userId: 1 }, 0, { attempts: 1 }, 1_710_000_100_000, undefined, [], { delivered: true }, 100);
    completedJob.processedOn = 1_710_000_110_000;
    completedJob.finishedOn = 1_710_000_120_000;

    const adapter = new BullMqQueueAdapter({
      queues: {
        email: new FakeQueue('email', [completedJob, failedJob]),
      },
    });

    const overview = await adapter.listQueues();
    assert.equal(overview.length, 1);
    assert.deepEqual(overview[0], {
      key: 'email',
      label: 'email',
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 1,
        completed: 1,
      },
      isPaused: false,
    });
  });

  it('lists paginated jobs and serializes job fields', async () => {
    const waitingJob = new FakeJob('job-1', 'send-welcome', 'waiting', { userId: 1 }, 0, { attempts: 1 }, 1_710_000_000_000);
    const completedJob = new FakeJob('job-2', 'send-reset', 'completed', { userId: 2 }, 1, { attempts: 2 }, 1_710_000_050_000, undefined, [], { ok: true }, 75);
    completedJob.processedOn = 1_710_000_060_000;
    completedJob.finishedOn = 1_710_000_070_000;

    const adapter = new BullMqQueueAdapter({
      queues: {
        email: new FakeQueue('email', [waitingJob, completedJob]),
      },
    });

    const page = await adapter.listJobs('email', 'completed', { page: 1, pageSize: 1 });
    assert.equal(page.total, 1);
    assert.equal(page.page, 1);
    assert.equal(page.pageSize, 1);
    assert.deepEqual(page.items[0], {
      id: 'job-2',
      name: 'send-reset',
      state: 'completed',
      data: { userId: 2 },
      progress: 75,
      attemptsMade: 1,
      attemptsConfigured: 2,
      createdAt: new Date(1_710_000_050_000).toISOString(),
      processedAt: new Date(1_710_000_060_000).toISOString(),
      finishedAt: new Date(1_710_000_070_000).toISOString(),
      failedReason: undefined,
      result: { ok: true },
      stackTrace: [],
    });
  });

  it('filters jobs by configured payload paths', async () => {
    const adapter = new BullMqQueueAdapter({
      queues: {
        email: new FakeQueue('email', [
          new FakeJob('job-1', 'send-reset', 'completed', { userId: 1, template: 'password-reset' }),
          new FakeJob('job-2', 'send-welcome', 'completed', { userId: 2, template: 'welcome' }),
          new FakeJob('job-3', 'send-reminder', 'completed', { user: { id: 1 }, template: 'reminder' }),
        ]),
      },
    });

    const page = await adapter.listJobs('email', 'completed', {
      page: 1,
      pageSize: 20,
      payloadFilters: [{ path: 'userId', value: '2' }],
    });
    const nestedPage = await adapter.listJobs('email', 'completed', {
      page: 1,
      pageSize: 20,
      payloadFilters: [{ path: 'user.id', value: '1' }],
    });

    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.id, 'job-2');
    assert.equal(nestedPage.total, 1);
    assert.equal(nestedPage.items[0]?.id, 'job-3');
  });

  it('returns queue detail and job detail records', async () => {
    const delayedJob = new FakeJob('job-3', 'send-follow-up', 'delayed', { userId: 3 }, 0, { attempts: 2 }, 1_710_000_200_000);
    const adapter = new BullMqQueueAdapter({
      queues: {
        email: new FakeQueue('email', [delayedJob]),
      },
    });

    const queue = await adapter.getQueue('email');
    const job = await adapter.getJob('email', 'job-3');

    assert.equal(queue.key, 'email');
    assert.equal(job?.id, 'job-3');
    assert.equal(job?.state, 'delayed');
  });

  it('supports queue-level mutations', async () => {
    const queue = new FakeQueue('email', [
      new FakeJob('job-1', 'send-welcome', 'failed', { userId: 1 }),
      new FakeJob('job-2', 'send-reminder', 'failed', { userId: 2 }),
      new FakeJob('job-3', 'send-reset', 'waiting', { userId: 3 }),
    ]);
    const adapter = new BullMqQueueAdapter({
      queues: {
        email: queue,
      },
    });

    await adapter.pauseQueue('email');
    assert.equal(queue.paused, true);

    await adapter.resumeQueue('email');
    assert.equal(queue.paused, false);

    const cleaned = await adapter.cleanQueue('email', { graceMs: -10, limit: 0, state: 'failed' });
    assert.equal(cleaned.count, 1);
    assert.deepEqual(queue.cleanedCalls[0], { graceMs: 0, limit: 1, type: 'failed' });

    const retried = await adapter.retryFailedJobs('email', { count: 1 });
    assert.equal(retried.count, 1);
    assert.equal(await queue.jobs[0]?.getState(), 'waiting');

    await adapter.emptyQueue('email');
    assert.equal(queue.obliterated, true);
    assert.equal(queue.jobs.length, 0);
  });

  it('supports job-level mutations', async () => {
    const failedJob = new FakeJob('job-1', 'send-receipt', 'failed', { orderId: 42 }, 1, { attempts: 3 }, Date.now(), 'timeout', ['trace']);
    const delayedJob = new FakeJob('job-2', 'send-later', 'delayed', { orderId: 43 });
    const removableJob = new FakeJob('job-3', 'remove-me', 'waiting', { orderId: 44 });
    const adapter = new BullMqQueueAdapter({
      queues: {
        email: new FakeQueue('email', [failedJob, delayedJob, removableJob]),
      },
    });

    await adapter.retryJob('email', 'job-1');
    assert.equal(failedJob.retried, true);
    assert.equal(await failedJob.getState(), 'waiting');

    await adapter.promoteJob('email', 'job-2');
    assert.equal(delayedJob.promoted, true);
    assert.equal(await delayedJob.getState(), 'waiting');

    await adapter.removeJob('email', 'job-3');
    assert.equal(removableJob.removed, true);
    assert.equal(await removableJob.getState(), 'removed');
  });

  it('throws for unknown queues and jobs', async () => {
    const adapter = new BullMqQueueAdapter({
      queues: {
        email: new FakeQueue('email'),
      },
    });

    await assert.rejects(() => adapter.getQueue('missing'), /Unknown BullMQ queue "missing"/);
    await assert.doesNotReject(async () => {
      const job = await adapter.getJob('email', 'missing');
      assert.equal(job, null);
    });
    await assert.rejects(() => adapter.removeJob('email', 'missing'), /Unknown BullMQ job "missing" in queue "email"/);
  });
});
