import { useEffect, useState } from 'react';
import {
  deleteResourceEntity,
  getResourceEntity,
  getResourceMeta,
} from '../services/resources.service.js';
import type { ResourceMetaResponse } from '../types.js';

export function DeleteConfirmPage({
  resourceName,
  ids,
  onTitleChange,
}: {
  resourceName: string;
  ids: string[];
  onTitleChange?: (label: string | null) => void;
}) {
  const [meta, setMeta] = useState<ResourceMetaResponse | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
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
      const metaJson = await getResourceMeta(resourceName);
      setMeta(metaJson);
      const fetched = await Promise.all(ids.map((id) => getResourceEntity(resourceName, id)));
      setItems(fetched);
      setLoading(false);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      for (const id of ids) {
        await deleteResourceEntity(resourceName, id);
      }
      window.location.hash = `#/${resourceName}`;
    } catch (reason) {
      setError((reason as Error).message);
      setDeleting(false);
    }
  }

  if (error) {
    return <section className="panel">Error: {error}</section>;
  }

  if (loading || !meta) {
    return <section className="panel">Loading…</section>;
  }

  const { label, list: listFields } = meta.resource;
  const count = ids.length;

  function getItemLabel(item: Record<string, unknown>): string {
    const primary = listFields[0];
    return primary ? String(item[primary] ?? item.id) : String(item.id);
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">Confirm deletion</span>
          <h2>Delete {count === 1 ? label : `${count} ${label}s`}</h2>
        </div>
      </header>

      <p className="delete-confirm__question">
        Are you sure you want to delete the selected {count === 1 ? label : `${count} ${label}s`}?
        All of the following objects and their related items will be deleted:
      </p>

      <div className="delete-confirm__block">
        <h3 className="delete-confirm__block-title">Summary</h3>
        <ul className="delete-confirm__list">
          <li>{label}: {count}</li>
        </ul>
      </div>

      <div className="delete-confirm__block">
        <h3 className="delete-confirm__block-title">Objects</h3>
        <ul className="delete-confirm__list">
          {items.map((item) => (
            <li key={String(item.id)}>
              {label}: {getItemLabel(item)}
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
