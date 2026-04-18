import { useEffect, useState } from 'react';
import { formatAdminValue } from '../../formatters.js';
import { getExtensionData, runExtensionAction } from '../../services/resources.service.js';
import { showToast } from '../../services/toast.service.js';
import type { ScreenPageSchema } from '../../types.js';
import type { AdminExtensionDetailPanelProps, AdminExtensionPageProps } from '../types.js';
import './styles.css';

type QueueJobState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed';
type QueueFilterDefinition = {
  key: string;
  label: string;
  path: string;
};

type QueueSummary = {
  key: string;
  label: string;
  description?: string;
  filters?: QueueFilterDefinition[];
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

type RelatedJobsPanelLink = {
  queueKey: string;
  queueLabel: string;
  queueDescription?: string;
  filterKey: string;
  filterLabel: string;
  recordField: string;
  label: string;
  limit: number;
};

const QUEUE_STATE_ORDER: QueueJobState[] = ['completed', 'failed', 'waiting', 'delayed', 'active'];

type ConfirmationState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'neutral' | 'danger';
  onConfirm: () => Promise<void>;
};

export function BullMqRelatedJobsPanel({
  display,
  panel,
  record,
}: AdminExtensionDetailPanelProps) {
  const [groups, setGroups] = useState<Array<{ link: RelatedJobsPanelLink; value: string; items: QueueJobSummary[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const links = ((panel.config?.['links'] as RelatedJobsPanelLink[] | undefined) ?? [])
    .map((link) => {
      const rawValue = getValueAtPath(record, link.recordField);
      return rawValue == null || String(rawValue).trim() === ''
        ? null
        : {
            link,
            value: String(rawValue).trim(),
          };
    })
    .filter((link): link is { link: RelatedJobsPanelLink; value: string } => link !== null);

  useEffect(() => {
    void load();
  }, [panel.key, JSON.stringify(links)]);

  async function load() {
    if (links.length === 0) {
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const nextGroups = await Promise.all(
        links.map(async ({ link, value }) => {
          const response = await getExtensionData<{ items: QueueJobSummary[] }>(`/queues/${link.queueKey}/related`, {
            filterKey: link.filterKey,
            filterValue: value,
            limit: link.limit,
          });

          return {
            link,
            value,
            items: response.items,
          };
        }),
      );

      setGroups(nextGroups);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (links.length === 0) {
    return null;
  }

  return (
    <section className="panel queue-related-panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">Queues</span>
          <div className="panel__title-row">
            <h3>{panel.title}</h3>
          </div>
        </div>
      </header>
      {loading ? <p>Loading related jobs…</p> : null}
      {error ? <p>Failed to load related jobs: {error}</p> : null}
      {!loading && !error ? (
        <div className="queue-related-panel__groups">
          {groups.map(({ link, value, items }) => (
            <section className="queue-related-group" key={`${link.queueKey}:${link.filterKey}:${value}`}>
              <div className="queue-related-group__header">
                <div>
                  <h4>{link.label}</h4>
                  <p>
                    {link.filterLabel}: <code>{value}</code>
                  </p>
                </div>
                <a className="button" href={`#/queues/${link.queueKey}`}>
                  Open queue
                </a>
              </div>
              {items.length > 0 ? (
                <div className="queue-table-wrap">
                  <table className="queue-table">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>State</th>
                        <th>Created</th>
                        <th>Started</th>
                        <th>Finished</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((job) => (
                        <tr key={job.id}>
                          <td>
                            <a className="table__link" href={`#/queues/${link.queueKey}/jobs/${job.id}`}>
                              {job.name ?? job.id}
                            </a>
                          </td>
                          <td>{job.state}</td>
                          <td>{formatAdminValue(job.createdAt, 'createdAt', display)}</td>
                          <td>{formatAdminValue(job.processedAt, 'processedAt', display)}</td>
                          <td>{formatAdminValue(job.finishedAt, 'finishedAt', display)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No related jobs found.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

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
      completed: accumulator.completed + item.counts.completed,
      failed: accumulator.failed + item.counts.failed,
      waiting: accumulator.waiting + item.counts.waiting,
      delayed: accumulator.delayed + item.counts.delayed,
      active: accumulator.active + item.counts.active,
      paused: accumulator.paused + (item.isPaused ? 1 : 0),
    }),
    { completed: 0, failed: 0, waiting: 0, delayed: 0, active: 0, paused: 0 },
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
        <QueueMetricCard label="Completed jobs" value={totals.completed} />
        <QueueMetricCard label="Failed jobs" value={totals.failed} />
        <QueueMetricCard label="Waiting jobs" value={totals.waiting} />
        <QueueMetricCard label="Delayed jobs" value={totals.delayed} />
        <QueueMetricCard label="Active jobs" value={totals.active} />
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
                <QueueInlineStat label="Completed" value={item.counts.completed} />
                <QueueInlineStat label="Failed" value={item.counts.failed} />
                <QueueInlineStat label="Waiting" value={item.counts.waiting} />
                <QueueInlineStat label="Delayed" value={item.counts.delayed} />
                <QueueInlineStat label="Active" value={item.counts.active} />
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
  const [filter, setFilter] = useState<QueueJobState>('completed');
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canManage = user.isSuperuser === true || user.permissions.includes('queues.write');

  useEffect(() => {
    setPageNumber(1);
  }, [filter, queueKey, JSON.stringify(activeFilters)]);

  useEffect(() => {
    void load();
  }, [filter, pageNumber, queueKey]);

  useEffect(() => {
    onTitleChange?.(queue?.label ?? page.title ?? null);
  }, [onTitleChange, page.title, queue?.label]);

  useEffect(() => {
    if (!queue?.filters) {
      return;
    }

    setFilterInputs(
      Object.fromEntries(
        queue.filters.map((filterDefinition) => [filterDefinition.key, activeFilters[filterDefinition.key] ?? '']),
      ),
    );
  }, [queue?.key, queue?.filters, JSON.stringify(activeFilters)]);

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
          ...Object.fromEntries(
            Object.entries(activeFilters).map(([key, value]) => [`filter_${key}`, value]),
          ),
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

  async function executeQueueAction(action: string, payload?: Record<string, unknown>) {
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

  async function executeJobAction(jobId: string, action: string) {
    try {
      await runExtensionAction(`/queues/${queueKey}/jobs/${jobId}/actions/${action}`);
      showToast({ message: `Job ${jobId} ${action.replace(/-/g, ' ')} complete.` });
      await load();
    } catch (reason) {
      showToast({ message: (reason as Error).message, variant: 'error' });
    }
  }

  function confirmAction(nextConfirmation: ConfirmationState) {
    setConfirmation(nextConfirmation);
  }

  async function handleConfirm() {
    if (!confirmation) {
      return;
    }

    setConfirming(true);
    try {
      await confirmation.onConfirm();
      setConfirmation(null);
    } finally {
      setConfirming(false);
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
          <QueueMetricCard label="Completed" value={queue.counts.completed} />
          <QueueMetricCard label="Failed" value={queue.counts.failed} tone={queue.counts.failed > 0 ? 'warning' : 'neutral'} />
          <QueueMetricCard label="Waiting" value={queue.counts.waiting} />
          <QueueMetricCard label="Delayed" value={queue.counts.delayed} />
          <QueueMetricCard label="Active" value={queue.counts.active} />
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
            <button
              className="button"
              type="button"
              onClick={() =>
                void executeQueueAction(queue?.isPaused ? 'resume' : 'pause')
              }
            >
              {queue?.isPaused ? 'Resume queue' : 'Pause queue'}
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                confirmAction({
                  title: 'Retry failed jobs',
                  message: `Retry up to 100 failed jobs in ${queue?.label ?? queueKey}?`,
                  confirmLabel: 'Retry failed jobs',
                  onConfirm: async () => executeQueueAction('retry-failed', { count: 100 }),
                })
              }
            >
              Retry failed jobs
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                confirmAction({
                  title: 'Clean jobs',
                  message: `Clean up to 100 ${filter} jobs from ${queue?.label ?? queueKey}?`,
                  confirmLabel: 'Clean jobs',
                  onConfirm: async () => executeQueueAction('clean', { graceMs: 0, limit: 100, state: filter }),
                })
              }
            >
              Clean current tab
            </button>
            <button
              className="button button--danger"
              type="button"
              onClick={() =>
                confirmAction({
                  title: 'Empty queue',
                  message: `Empty ${queue?.label ?? queueKey}? This removes queued jobs.`,
                  confirmLabel: 'Empty queue',
                  tone: 'danger',
                  onConfirm: async () => executeQueueAction('empty'),
                })
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
        {queue?.filters && queue.filters.length > 0 ? (
          <div className="queue-filters">
            {queue.filters.map((filterDefinition) => (
              <label className="field queue-filters__field" key={filterDefinition.key}>
                <span className="field__label">{filterDefinition.label}</span>
                <input
                  className="input"
                  type="text"
                  value={filterInputs[filterDefinition.key] ?? ''}
                  onChange={(event) =>
                    setFilterInputs((current) => ({
                      ...current,
                      [filterDefinition.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <div className="queue-filters__actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setPageNumber(1);
                  setActiveFilters(
                    Object.fromEntries(
                      Object.entries(filterInputs).filter(([, value]) => value.trim() !== ''),
                    ),
                  );
                }}
              >
                Apply filters
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  const emptyFilters = Object.fromEntries(
                    (queue.filters ?? []).map((filterDefinition) => [filterDefinition.key, '']),
                  );
                  setFilterInputs(emptyFilters);
                  setActiveFilters({});
                  setPageNumber(1);
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : null}
        <div className="queue-tabs">
          {QUEUE_STATE_ORDER.map((state) => (
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
                <th>Started</th>
                <th>Finished</th>
                <th>Failure</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <a
                        className="table__link"
                        href={`#/queues/${queueKey}/jobs/${job.id}`}
                      >
                        {job.name ?? job.id}
                      </a>
                    </td>
                    <td>{job.state}</td>
                    <td>
                      {job.attemptsMade}
                      {job.attemptsConfigured ? ` / ${job.attemptsConfigured}` : ''}
                    </td>
                    <td>{formatAdminValue(job.createdAt, 'createdAt', display)}</td>
                    <td>{formatAdminValue(job.processedAt, 'processedAt', display)}</td>
                    <td>{formatAdminValue(job.finishedAt, 'finishedAt', display)}</td>
                    <td>{job.failedReason ?? ''}</td>
                    {canManage ? (
                      <td>
                        {job.state === 'failed' ? (
                          <button
                            className="button"
                            type="button"
                            onClick={() =>
                              confirmAction({
                                title: 'Retry job',
                                message: `Retry job ${job.name ?? job.id}?`,
                                confirmLabel: 'Retry job',
                                onConfirm: async () => executeJobAction(job.id, 'retry'),
                              })
                            }
                          >
                            Retry
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canManage ? 8 : 7}>No {filter} jobs found.</td>
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
      <ConfirmationDialog
        confirmation={confirmation}
        confirming={confirming}
        onCancel={() => {
          if (!confirming) {
            setConfirmation(null);
          }
        }}
        onConfirm={() => void handleConfirm()}
      />
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
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canManage = user.isSuperuser === true || user.permissions.includes('queues.write');
  const canRetry = job?.state === 'failed';
  const canPromote = job?.state === 'delayed';
  const canRemove = job?.state !== 'active';

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

  async function executeJobAction(action: string) {
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

  function confirmAction(nextConfirmation: ConfirmationState) {
    setConfirmation(nextConfirmation);
  }

  async function handleConfirm() {
    if (!confirmation) {
      return;
    }

    setConfirming(true);
    try {
      await confirmation.onConfirm();
      setConfirmation(null);
    } finally {
      setConfirming(false);
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
            {canRetry ? (
              <button
                className="button"
                type="button"
                onClick={() =>
                  confirmAction({
                    title: 'Retry job',
                    message: `Retry job ${job?.name ?? jobId}?`,
                    confirmLabel: 'Retry job',
                    onConfirm: async () => executeJobAction('retry'),
                  })
                }
              >
                Retry job
              </button>
            ) : null}
            {canPromote ? (
              <button
                className="button"
                type="button"
                onClick={() =>
                  confirmAction({
                    title: 'Promote job',
                    message: `Promote delayed job ${job?.name ?? jobId}?`,
                    confirmLabel: 'Promote job',
                    onConfirm: async () => executeJobAction('promote'),
                  })
                }
              >
                Promote job
              </button>
            ) : null}
            {canRemove ? (
              <button
                className="button button--danger"
                type="button"
                onClick={() =>
                  confirmAction({
                    title: 'Remove job',
                    message: `Remove job ${jobId} from ${queue?.label ?? queueKey}?`,
                    confirmLabel: 'Remove job',
                    tone: 'danger',
                    onConfirm: async () => executeJobAction('remove'),
                  })
                }
              >
                Remove job
              </button>
            ) : null}
            {!canRetry && !canPromote && !canRemove ? (
              <span className="resource-pill">No actions available for {job?.state ?? 'this job'}</span>
            ) : null}
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
              <QueueDetailItem label="Created at" value={formatAdminValue(job.createdAt, 'createdAt', display)} />
              <QueueDetailItem label="Started processing" value={formatAdminValue(job.processedAt, 'processedAt', display)} />
              <QueueDetailItem label="Finished at" value={formatAdminValue(job.finishedAt, 'finishedAt', display)} />
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
      <ConfirmationDialog
        confirmation={confirmation}
        confirming={confirming}
        onCancel={() => {
          if (!confirming) {
            setConfirmation(null);
          }
        }}
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
}

function ConfirmationDialog({
  confirmation,
  confirming,
  onCancel,
  onConfirm,
}: {
  confirmation: ConfirmationState | null;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirmation) {
    return null;
  }

  return (
    <div className="queue-confirm" role="dialog" aria-modal="true" aria-labelledby="queue-confirm-title">
      <div className="queue-confirm__backdrop" onClick={onCancel} />
      <section className="panel queue-confirm__dialog">
        <header className="panel__header">
          <div>
            <span className="panel__eyebrow">Confirm action</span>
            <div className="panel__title-row">
              <h3 id="queue-confirm-title">{confirmation.title}</h3>
            </div>
          </div>
        </header>
        <p className="queue-confirm__question">{confirmation.message}</p>
        <div className="queue-confirm__actions">
          <button
            className={confirmation.tone === 'danger' ? 'button button--danger' : 'button button--primary'}
            disabled={confirming}
            type="button"
            onClick={onConfirm}
          >
            {confirming ? `${confirmation.confirmLabel}…` : confirmation.confirmLabel}
          </button>
          <button className="button" disabled={confirming} type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </div>
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

function extractQueueKey(path: string): string {
  return path.split('/').filter(Boolean)[1] ?? '';
}
