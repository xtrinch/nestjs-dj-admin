import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BullMqQueueAdapter, bullmqQueueExtension, type BullMqJobLike } from '../src/extensions/bullmq-queue/index.js';

class FakeJob implements BullMqJobLike {
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
  ) {}

  async getState(): Promise<string> {
    return this.state;
  }

  async retry(): Promise<void> {
    this.state = 'waiting';
    this.failedReason = undefined;
    this.stacktrace = [];
  }

  async remove(): Promise<void> {
    this.state = 'removed';
  }

  async promote(): Promise<void> {
    this.state = 'waiting';
  }
}

describe('bullmq queue extension', () => {
  it('builds route-based pages, widgets, and nav items', () => {
    const extension = bullmqQueueExtension({
      adapter: new BullMqQueueAdapter({
        queues: {
          email: createFakeQueue('email'),
        },
      }),
      queues: [{ key: 'email', label: 'Email' }],
    });

    assert.ok(extension.pages?.some((page) => page.kind === 'screen' && page.route === '/queues'));
    assert.ok(extension.pages?.some((page) => page.kind === 'screen' && page.route === '/queues/:queueKey/jobs/:jobId'));
    assert.ok(extension.navItems?.some((item) => item.kind === 'page' && item.pageSlug === 'queue-email'));
    assert.ok(extension.widgets?.some((widget) => widget.kind === 'route' && widget.route === '/queues'));
    assert.ok(extension.endpoints?.some((endpoint) => endpoint.path === '/queues/:queueKey/jobs/:jobId'));
  });

  it('maps BullMQ-like queues through the adapter contract', async () => {
    const failedJob = new FakeJob('job-2', 'send-receipt', 'failed', { orderId: 42 }, 1, { attempts: 3 }, Date.now(), 'timeout', ['trace']);
    const adapter = new BullMqQueueAdapter({
      queues: {
        email: createFakeQueue('email', [
          new FakeJob('job-1', 'send-welcome', 'waiting', { userId: 1 }),
          failedJob,
        ]),
      },
      labels: {
        email: { label: 'Email' },
      },
    });

    const overview = await adapter.listQueues();
    assert.equal(overview[0]?.counts.failed, 1);

    const jobs = await adapter.listJobs('email', 'failed', { page: 1, pageSize: 20 });
    assert.equal(jobs.total, 1);
    assert.equal(jobs.items[0]?.id, 'job-2');

    await adapter.retryFailedJobs('email', { count: 10 });
    assert.equal(await failedJob.getState(), 'waiting');
  });
});

function createFakeQueue(name: string, jobs: FakeJob[] = []) {
  return {
    name,
    async getJobCounts() {
      return {
        waiting: jobs.filter((job) => job.state === 'waiting').length,
        active: jobs.filter((job) => job.state === 'active').length,
        delayed: jobs.filter((job) => job.state === 'delayed').length,
        failed: jobs.filter((job) => job.state === 'failed').length,
        completed: jobs.filter((job) => job.state === 'completed').length,
      };
    },
    async isPaused() {
      return false;
    },
    async getJobs(types: Array<'waiting' | 'active' | 'delayed' | 'failed' | 'completed'>, start: number, end: number) {
      return jobs.filter((job) => types.includes(job.state as never)).slice(start, end + 1);
    },
    async getJob(id: string) {
      return jobs.find((job) => job.id === id);
    },
    async pause() {},
    async resume() {},
    async clean(_graceMs: number, limit: number, type: 'waiting' | 'active' | 'delayed' | 'failed' | 'completed') {
      const removed = jobs.filter((job) => job.state === type).slice(0, limit);
      return removed;
    },
    async obliterate() {
      jobs.length = 0;
    },
  };
}
