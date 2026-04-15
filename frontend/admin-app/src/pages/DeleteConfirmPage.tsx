import { useEffect, useState } from 'react';
import {
  bulkDeleteResourceEntities,
  getDeleteSummary,
} from '../services/resources.service.js';
import { queueToast, showToast } from '../services/toast.service.js';
import type { AdminDeleteSummary } from '../types.js';

export function DeleteConfirmPage({
  resourceName,
  ids,
  onTitleChange,
}: {
  resourceName: string;
  ids: string[];
  onTitleChange?: (label: string | null) => void;
}) {
  const [summary, setSummary] = useState<AdminDeleteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = ids.join(',');

  useEffect(() => {
    void load();
  }, [resourceName, idsKey]);

  async function load() {
    try {
      const nextSummary = await getDeleteSummary(resourceName, ids);
      setSummary(nextSummary);
      setLoading(false);
      onTitleChange?.(
        nextSummary.count === 1
          ? nextSummary.items[0]?.label ?? nextSummary.label
          : `${nextSummary.count} ${pluralizeLabel(nextSummary.label)}`,
      );
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await bulkDeleteResourceEntities(resourceName, ids);
      queueToast({
        message:
          ids.length === 1
            ? `${summary?.items[0]?.label ?? summary?.label ?? 'Record'} ${summary?.mode === 'soft-delete' ? 'archived' : 'deleted'}.`
            : `${ids.length} ${pluralizeLabel(summary?.label ?? 'record').toLowerCase()} ${summary?.mode === 'soft-delete' ? 'archived' : 'deleted'}.`,
      });
      window.location.hash = `#/${resourceName}`;
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
      setDeleting(false);
    }
  }

  if (error) {
    return <section className="panel">Error: {error}</section>;
  }

  if (loading || !summary) {
    return <section className="panel">Loading…</section>;
  }

  const { label, count, items, impact } = summary;
  const related = summary.related ?? [];
  const pluralLabel = pluralizeLabel(label);
  const isSoftDelete = summary.mode === 'soft-delete';
  const hasBlockingImpact = impact.blocked.length > 0;
  const singleId = ids.length === 1 ? ids[0] : null;
  const title = count === 1
    ? `${isSoftDelete ? 'Archive' : 'Delete'} ${items[0]?.label ?? label}`
    : `${isSoftDelete ? 'Archive' : 'Delete'} ${count} ${pluralLabel}`;
  const question =
    isSoftDelete
      ? count === 1
        ? `The selected ${label.toLowerCase()} will be hidden from default admin views but not permanently removed.`
        : `The selected ${pluralLabel.toLowerCase()} will be hidden from default admin views but not permanently removed.`
      : count === 1
        ? `Review the deletion impact for the selected ${label} before continuing.`
        : `Review the deletion impact for the selected ${pluralLabel.toLowerCase()} before continuing.`;

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">{isSoftDelete ? 'Confirm archive' : 'Confirm deletion'}</span>
          <div className="panel__title-row">
            <h2>{title}</h2>
            {isSoftDelete ? (
              <span className="resource-pill">Soft delete</span>
            ) : null}
          </div>
        </div>
      </header>

      <p className="delete-confirm__question">{question}</p>

      <div className="delete-confirm__block">
        <h3 className="delete-confirm__block-title">Summary</h3>
        <ul className="delete-confirm__list">
          <li>{count === 1 ? label : pluralLabel}: {count}</li>
        </ul>
      </div>

      <div className="delete-confirm__block">
        <h3 className="delete-confirm__block-title">Objects</h3>
        <ul className="delete-confirm__list">
          {items.map((item) => (
            <li key={item.id}>
              {label}: {item.label}
            </li>
          ))}
        </ul>
      </div>

      {!isSoftDelete ? (
        <ImpactBlock
          title="Will delete"
          groups={impact.delete}
        />
      ) : null}

      {!isSoftDelete && impact.disconnect.length > 0 ? (
        <ImpactBlock
          title="Will disconnect"
          groups={impact.disconnect}
        />
      ) : null}

      {!isSoftDelete && impact.blocked.length > 0 ? (
        <ImpactBlock
          title="Would block deletion"
          groups={impact.blocked}
        />
      ) : null}

      {!isSoftDelete && related.length > 0 ? (
        <div className="delete-confirm__block">
          <h3 className="delete-confirm__block-title">Related links</h3>
          <ul className="delete-confirm__list">
            {related.map((group) => (
              <li key={group.field}>
                {group.label}: {group.count}
                {group.items.length > 0 ? ` (${group.items.map((item) => item.label).join(', ')})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="delete-confirm__actions">
        {hasBlockingImpact ? (
          singleId ? (
            <a className="button" href={`#/${resourceName}/edit/${singleId}`}>
              Back to record
            </a>
          ) : (
            <a className="button" href={`#/${resourceName}`}>
              Back to list
            </a>
          )
        ) : (
          <button
            className="button button--danger"
            disabled={deleting}
            type="button"
            onClick={() => void confirmDelete()}
          >
            {deleting
              ? isSoftDelete ? 'Archiving…' : 'Deleting…'
              : count === 1
                ? `${isSoftDelete ? 'Archive' : 'Delete'} ${items[0]?.label ?? label}`
                : `${isSoftDelete ? 'Archive' : 'Delete'} ${count} ${pluralLabel.toLowerCase()}`}
          </button>
        )}
        <a className="button" href={`#/${resourceName}`}>
          Cancel
        </a>
      </div>
    </section>
  );
}

function pluralizeLabel(label: string): string {
  if (label.endsWith('y') && !/[aeiou]y$/i.test(label)) {
    return `${label.slice(0, -1)}ies`;
  }

  if (label.endsWith('s')) {
    return label;
  }

  return `${label}s`;
}

function ImpactBlock({
  title,
  groups,
}: {
  title: string;
  groups: AdminDeleteSummary['impact']['delete'];
}) {
  return (
    <div className="delete-confirm__block">
      <h3 className="delete-confirm__block-title">{title}</h3>
      <ul className="delete-confirm__list">
        {groups.map((group) => (
          <li key={`${group.resourceName}:${group.via ?? 'root'}`}>
            {group.label}: {group.count}
            {group.via ? ` via ${group.via}` : ''}
            {group.items.length > 0 ? ` (${group.items.map((item) => item.label).join(', ')})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
