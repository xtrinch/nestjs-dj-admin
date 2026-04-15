import { useEffect, useState } from 'react';
import { formatAdminValue } from '../formatters.js';
import { getAuditLog } from '../services/resources.service.js';
import { showToast } from '../services/toast.service.js';
import type { AdminAuditEntry, AdminDisplayConfig } from '../types.js';

const PAGE_SIZE = 50;

export function AuditLogPage({
  display,
  onTitleChange,
}: {
  display: AdminDisplayConfig;
  onTitleChange?: (label: string | null) => void;
}) {
  const [items, setItems] = useState<AdminAuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTitleChange?.(null);
  }, [onTitleChange]);

  useEffect(() => {
    void load();
  }, [page]);

  async function load() {
    try {
      const response = await getAuditLog({ page, pageSize: PAGE_SIZE });
      setItems(response.items);
      setTotal(response.total);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  if (error) {
    return <section>Failed to load audit log: {error}</section>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">System</span>
          <div className="panel__title-row">
            <h2>Audit Log</h2>
          </div>
        </div>
      </header>

      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id}>
              <td>{formatAdminValue(entry.timestamp, 'createdAt', display)}</td>
              <td>{entry.actor.email ?? entry.actor.id}</td>
              <td>{humanizeAuditAction(entry.action)}</td>
              <td>{entry.objectLabel ?? entry.resourceLabel ?? 'Session'}</td>
              <td>{entry.summary}</td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td className="table__empty" colSpan={5}>No audit events recorded yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <footer className="pagination">
        <span className="pagination__summary">
          Page {page} of {totalPages} • {total} entries
        </span>
        <div className="pagination__controls">
          <button
            className="button"
            disabled={page <= 1}
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <button
            className="button"
            disabled={page >= totalPages}
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}

function humanizeAuditAction(action: AdminAuditEntry['action']): string {
  if (action === 'soft-delete') {
    return 'Archive';
  }

  if (action === 'password-change') {
    return 'Password change';
  }

  if (action === 'bulk-action') {
    return 'Bulk action';
  }

  return action.charAt(0).toUpperCase() + action.slice(1);
}
