import { useEffect, useState } from 'react';
import { formatAdminValue } from '../../formatters.js';
import { getExtensionData, runExtensionAction } from '../../services/resources.service.js';
import { showToast } from '../../services/toast.service.js';
import type { ScreenPageSchema } from '../../types.js';
import type { AdminExtensionPageProps } from '../types.js';
import './styles.css';

type QueueJobState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed';

type QueueSummary = {
  key: string;
  label: string;
  description?: string;
  counts: Record<QueueJobState, number>;
  isPaused: boolean;
};

type QueueDetails = QueueSummary;

type QueueJobSummary = {
  id: string;
  name?: string;
  state: string;
  data: unknown;
  progress?: unknown;
  attemptsMade: number;
  attemptsConfigured?: number;
  createdAt?: string;
  processedAt?: string;
  finishedAt?: string;
  failedReason?: string;
};

type QueueJobDetails = QueueJobSummary & {
  result?: unknown;
  stackTrace?: string[];
};

export function BullMqQueuePage(props: AdminExtensionPageProps<ScreenPageSchema>) {
  if (props.page.screen === 'bullmq-queue-overview') {
    return <QueueOverviewPage {...props} />;
  }

  if (props.page.screen === 'bullmq-queue-detail') {
    return <QueueDetailPage {...props} queueKey={props.params['queueKey'] ?? extractQueueKey(props.pagePath)} />;
  }

  if (props.page.screen === 'bullmq-queue-job-detail') {
    return (
      <QueueJobDetailPage
        {...props}
        queueKey={props.params['queueKey'] ?? ''}
        jobId={props.params['jobId'] ?? ''}
      />
    );
  }

  return <section className="panel">Unsupported queue page: {props.page.screen}</section>;
}

function QueueOverviewPage({
  page,
  user,
  onTitleChange,
}: AdminExtensionPageProps<ScreenPageSchema>) {
  const [items, setItems] = useState<QueueSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTitleChange?.(null);
  }, [onTitleChange]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const response = await getExtensionData<{ items: QueueSummary[] }>('/queues');
      setItems(response.items);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  const totals = items.reduce(
    (accumulator, item) => ({
      waiting: accumulator.waiting + item.counts.waiting,
      active: accumulator.active + item.counts.active,
      delayed: accumulator.delayed + item.counts.delayed,
      failed: accumulator.failed + item.counts.failed,
      completed: accumulator.completed + item.counts.completed,
      paused: accumulator.paused + (item.isPaused ? 1 : 0),
    }),
    { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0, paused: 0 },
  );

  return (
    <section className="queue-page">
      <section className="panel queue-page__hero">
        <span className="panel__eyebrow">{page.category}</span>
        <div className="panel__title-row">
          <h2>{page.title ?? 'Queues overview'}</h2>
        </div>
        <p className="queue-page__copy">
          Inspect configured queues, current backlog, and operational health across the admin.
        </p>
      </section>

      <div className="queue-summary-grid">
        <QueueMetricCard label="Waiting jobs" value={totals.waiting} />
        <QueueMetricCard label="Active jobs" value={totals.active} />
        <QueueMetricCard label="Delayed jobs" value={totals.delayed} />
        <QueueMetricCard label="Failed jobs" value={totals.failed} />
        <QueueMetricCard label="Completed jobs" value={totals.completed} />
        <QueueMetricCard label="Paused queues" value={totals.paused} tone={totals.paused > 0 ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__eyebrow">Queues</span>
            <div className="panel__title-row">
              <h3>Configured queues</h3>
            </div>
          </div>
          {user.permissions.includes('queues.write') || user.isSuperuser ? (
            <span className="resource-pill">Actions enabled</span>
          ) : null}
        </header>
        {error ? <p>Failed to load queues: {error}</p> : null}
        <div className="queue-list">
          {items.map((item) => (
            <article key={item.key} className="queue-card">
              <div className="queue-card__header">
                <div>
                  <h4>{item.label}</h4>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
                <span className={`queue-state-pill ${item.isPaused ? 'queue-state-pill--warning' : ''}`}>
                  {item.isPaused ? 'Paused' : 'Running'}
                </span>
              </div>
              <div className="queue-card__stats">
                <QueueInlineStat label="Waiting" value={item.counts.waiting} />
                <QueueInlineStat label="Active" value={item.counts.active} />
                <QueueInlineStat label="Delayed" value={item.counts.delayed} />
                <QueueInlineStat label="Failed" value={item.counts.failed} />
                <QueueInlineStat label="Completed" value={item.counts.completed} />
              </div>
              <div className="queue-card__actions">
                <a className="button button--primary" href={`#/queues/${item.key}`}>
                  Open queue
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function QueueDetailPage({
  display,
  page,
  queueKey,
  user,
  onTitleChange,
}: AdminExtensionPageProps<ScreenPageSchema> & { queueKey: string }) {
  const [queue, setQueue] = useState<QueueDetails | null>(null);
  const [jobs, setJobs] = useState<QueueJobSummary[]>([]);
  const [filter, setFilter] = useState<QueueJobState>('waiting');
  const [pageNumber, setPageNumber] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canManage = user.isSuperuser === true || user.permissions.includes('queues.write');

  useEffect(() => {
    setPageNumber(1);
  }, [filter, queueKey]);

  useEffect(() => {
    void load();
  }, [filter, pageNumber, queueKey]);

  useEffect(() => {
    onTitleChange?.(queue?.label ?? page.title ?? null);
  }, [onTitleChange, page.title, queue?.label]);

  async function load() {
    try {
      const [queueResponse, jobsResponse] = await Promise.all([
        getExtensionData<{ queue: QueueDetails }>(`/queues/${queueKey}`),
        getExtensionData<{
          items: QueueJobSummary[];
          total: number;
          page: number;
          pageSize: number;
        }>(`/queues/${queueKey}/jobs`, {
          state: filter,
          page: pageNumber,
          pageSize: 20,
        }),
      ]);
      setQueue(queueResponse.queue);
      setJobs(jobsResponse.items);
      setTotal(jobsResponse.total);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  async function runAction(action: string, payload?: Record<string, unknown>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    try {
      const result = await runExtensionAction<{ success: boolean; count?: number }>(
        `/queues/${queueKey}/actions/${action}`,
        payload,
      );
      showToast({
        message:
          result.count == null
            ? `${queue?.label ?? queueKey} ${action.replace(/-/g, ' ')} complete.`
            : `${queue?.label ?? queueKey} ${action.replace(/-/g, ' ')} complete (${result.count}).`,
      });
      await load();
    } catch (reason) {
      showToast({ message: (reason as Error).message, variant: 'error' });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <section className="queue-page">
      <section className="panel queue-page__hero">
        <span className="panel__eyebrow">Queue</span>
        <div className="panel__title-row">
          <h2>{queue?.label ?? page.title ?? queueKey}</h2>
          {queue ? (
            <span className={`queue-state-pill ${queue.isPaused ? 'queue-state-pill--warning' : ''}`}>
              {queue.isPaused ? 'Paused' : 'Running'}
            </span>
          ) : null}
        </div>
        {queue?.description ? <p className="queue-page__copy">{queue.description}</p> : null}
      </section>

      {queue ? (
        <div className="queue-summary-grid">
          <QueueMetricCard label="Waiting" value={queue.counts.waiting} />
          <QueueMetricCard label="Active" value={queue.counts.active} />
          <QueueMetricCard label="Delayed" value={queue.counts.delayed} />
          <QueueMetricCard label="Failed" value={queue.counts.failed} tone={queue.counts.failed > 0 ? 'warning' : 'neutral'} />
          <QueueMetricCard label="Completed" value={queue.counts.completed} />
        </div>
      ) : null}

      {canManage ? (
        <section className="panel">
          <header className="panel__header">
            <div>
              <span className="panel__eyebrow">Operations</span>
              <div className="panel__title-row">
                <h3>Queue actions</h3>
              </div>
            </div>
          </header>
          <div className="queue-actions">
            <button className="button" type="button" onClick={() => void runAction(queue?.isPaused ? 'resume' : 'pause')}>
              {queue?.isPaused ? 'Resume queue' : 'Pause queue'}
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                void runAction(
                  'retry-failed',
                  { count: 100 },
                  `Retry up to 100 failed jobs in ${queue?.label ?? queueKey}?`,
                )
              }
            >
              Retry failed jobs
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                void runAction(
                  'clean',
                  { graceMs: 0, limit: 100, state: filter },
                  `Clean up to 100 ${filter} jobs from ${queue?.label ?? queueKey}?`,
                )
              }
            >
              Clean current tab
            </button>
            <button
              className="button button--danger"
              type="button"
              onClick={() =>
                void runAction('empty', undefined, `Empty ${queue?.label ?? queueKey}? This removes queued jobs.`)
              }
            >
              Empty queue
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__eyebrow">Jobs</span>
            <div className="panel__title-row">
              <h3>{capitalize(filter)} jobs</h3>
            </div>
          </div>
        </header>
        <div className="queue-tabs">
          {(['waiting', 'active', 'delayed', 'failed', 'completed'] as QueueJobState[]).map((state) => (
            <button
              key={state}
              className={state === filter ? 'button button--primary' : 'button'}
              type="button"
              onClick={() => setFilter(state)}
            >
              {capitalize(state)}
            </button>
          ))}
        </div>
        {error ? <p>Failed to load queue: {error}</p> : null}
        <div className="queue-table-wrap">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>State</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Failure</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <a href={`#/queues/${queueKey}/jobs/${job.id}`}>{job.name ?? job.id}</a>
                    </td>
                    <td>{job.state}</td>
                    <td>
                      {job.attemptsMade}
                      {job.attemptsConfigured ? ` / ${job.attemptsConfigured}` : ''}
                    </td>
                    <td>{formatAdminValue(job.createdAt, 'createdAt', display)}</td>
                    <td>{job.failedReason ?? ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No {filter} jobs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="queue-pagination">
          <button className="button" disabled={pageNumber <= 1} type="button" onClick={() => setPageNumber((current) => current - 1)}>
            Previous
          </button>
          <span>
            Page {pageNumber} of {totalPages}
          </span>
          <button
            className="button"
            disabled={pageNumber >= totalPages}
            type="button"
            onClick={() => setPageNumber((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </section>
  );
}

function QueueJobDetailPage({
  display,
  page,
  queueKey,
  jobId,
  user,
  onTitleChange,
}: AdminExtensionPageProps<ScreenPageSchema> & { queueKey: string; jobId: string }) {
  const [job, setJob] = useState<QueueJobDetails | null>(null);
  const [queue, setQueue] = useState<QueueDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = user.isSuperuser === true || user.permissions.includes('queues.write');

  useEffect(() => {
    void load();
  }, [jobId, queueKey]);

  useEffect(() => {
    onTitleChange?.(job?.id ?? page.title ?? null);
  }, [job?.id, onTitleChange, page.title]);

  async function load() {
    try {
      const [jobResponse, queueResponse] = await Promise.all([
        getExtensionData<{ job: QueueJobDetails | null }>(`/queues/${queueKey}/jobs/${jobId}`),
        getExtensionData<{ queue: QueueDetails }>(`/queues/${queueKey}`),
      ]);
      setJob(jobResponse.job);
      setQueue(queueResponse.queue);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  async function runAction(action: string, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    try {
      await runExtensionAction(`/queues/${queueKey}/jobs/${jobId}/actions/${action}`);
      showToast({ message: `Job ${jobId} ${action.replace(/-/g, ' ')} complete.` });
      if (action === 'remove') {
        window.location.hash = `#/queues/${queueKey}`;
        return;
      }

      await load();
    } catch (reason) {
      showToast({ message: (reason as Error).message, variant: 'error' });
    }
  }

  return (
    <section className="queue-page">
      <section className="panel queue-page__hero">
        <span className="panel__eyebrow">Job detail</span>
        <div className="panel__title-row">
          <h2>{job?.name ?? job?.id ?? page.title ?? jobId}</h2>
        </div>
        <p className="queue-page__copy">
          Queue: <a href={`#/queues/${queueKey}`}>{queue?.label ?? queueKey}</a>
        </p>
      </section>

      {canManage ? (
        <section className="panel">
          <header className="panel__header">
            <div>
              <span className="panel__eyebrow">Operations</span>
              <div className="panel__title-row">
                <h3>Job actions</h3>
              </div>
            </div>
          </header>
          <div className="queue-actions">
            <button className="button" type="button" onClick={() => void runAction('retry')}>
              Retry job
            </button>
            <button className="button" type="button" onClick={() => void runAction('promote')}>
              Promote job
            </button>
            <button
              className="button button--danger"
              type="button"
              onClick={() => void runAction('remove', `Remove job ${jobId} from ${queue?.label ?? queueKey}?`)}
            >
              Remove job
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        {error ? <p>Failed to load job: {error}</p> : null}
        {job ? (
          <div className="queue-job-detail">
            <div className="queue-job-detail__grid">
              <QueueDetailItem label="Job id" value={job.id} />
              <QueueDetailItem label="State" value={job.state} />
              <QueueDetailItem
                label="Attempts"
                value={`${job.attemptsMade}${job.attemptsConfigured ? ` / ${job.attemptsConfigured}` : ''}`}
              />
              <QueueDetailItem label="Created" value={formatAdminValue(job.createdAt, 'createdAt', display)} />
              <QueueDetailItem label="Processed" value={formatAdminValue(job.processedAt, 'processedAt', display)} />
              <QueueDetailItem label="Finished" value={formatAdminValue(job.finishedAt, 'finishedAt', display)} />
            </div>
            <QueueJsonBlock label="Payload" value={job.data} />
            <QueueJsonBlock label="Progress" value={job.progress} />
            <QueueJsonBlock label="Result" value={job.result} />
            {job.failedReason ? <QueueTextBlock label="Failure reason" value={job.failedReason} /> : null}
            {job.stackTrace && job.stackTrace.length > 0 ? (
              <QueueJsonBlock label="Stack trace" value={job.stackTrace} />
            ) : null}
          </div>
        ) : (
          <p>Job not found.</p>
        )}
      </section>
    </section>
  );
}

function QueueMetricCard({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'neutral' | 'warning';
  value: number;
}) {
  return (
    <article className={`panel queue-metric ${tone === 'warning' ? 'queue-metric--warning' : ''}`}>
      <span className="panel__eyebrow">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function QueueInlineStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="queue-inline-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QueueDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="queue-detail-item">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function QueueJsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') {
    return null;
  }

  return (
    <section className="queue-json-block">
      <h4>{label}</h4>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function QueueTextBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="queue-json-block">
      <h4>{label}</h4>
      <pre>{value}</pre>
    </section>
  );
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function extractQueueKey(path: string): string {
  return path.split('/').filter(Boolean)[1] ?? '';
}
