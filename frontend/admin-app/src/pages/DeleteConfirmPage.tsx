import { useEffect, useState } from 'react';
import {
  bulkDeleteResourceEntities,
  getDeleteSummary,
} from '../services/resources.service.js';
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
    onTitleChange?.('Delete');
    void load();
  }, [resourceName, idsKey]);

  async function load() {
    try {
      setSummary(await getDeleteSummary(resourceName, ids));
      setLoading(false);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await bulkDeleteResourceEntities(resourceName, ids);
      window.location.hash = `#/${resourceName}`;
    } catch (reason) {
      setError((reason as Error).message);
      setDeleting(false);
    }
  }

  if (error) {
    return <section className="panel">Error: {error}</section>;
  }

  if (loading || !summary) {
    return <section className="panel">Loading…</section>;
  }

  const { label, count, items } = summary;
  const pluralLabel = pluralizeLabel(label);
  const title = count === 1 ? `Delete ${label}` : `Delete multiple ${pluralLabel}`;
  const question =
    count === 1
      ? `Are you sure you want to delete the selected ${label}? All of the following objects and their related items will be deleted:`
      : `Are you sure you want to delete the selected ${pluralLabel}? All of the following objects and their related items will be deleted:`;

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">Confirm deletion</span>
          <h2>{title}</h2>
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

      <div className="delete-confirm__actions">
        <button
          className="button button--danger"
          disabled={deleting}
          type="button"
          onClick={() => void confirmDelete()}
        >
          {deleting ? 'Deleting…' : "Yes, I'm sure"}
        </button>
        <a className="button" href={`#/${resourceName}`}>
          No, take me back
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
