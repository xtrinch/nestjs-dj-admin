import { useEffect, useState } from 'react';
import { adminFetch, adminUrl, readJson } from '../api.js';
import type { ResourceSchema } from '../types.js';

type MetaResponse = {
  resource: ResourceSchema;
  filterOptions: Array<{ field: string; values: Array<string | number> }>;
};

export function ListPage({
  resourceName,
  onTitleChange,
}: {
  resourceName: string;
  onTitleChange?: (label: string | null) => void;
}) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [resourceName, search, filter]);

  async function load() {
    try {
      const metaResponse = await adminFetch(`/_meta/${resourceName}`);
      const metaJson = await readJson<MetaResponse>(metaResponse);
      setMeta(metaJson);
      onTitleChange?.(null);

      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
      });
      if (search) {
        params.set('search', search);
      }
      if (filter) {
        params.set(`filter.${metaJson.resource.filters[0]}`, filter);
      }

      const listResponse = await adminFetch(`/${resourceName}?${params.toString()}`);
      const listJson = await readJson<{ items: Array<Record<string, unknown>> }>(listResponse);
      setItems(listJson.items);
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function runAction(id: string, actionSlug: string) {
    await adminFetch(`/${resourceName}/${id}/actions/${actionSlug}`, {
      method: 'POST',
    });
    await load();
  }

  async function remove(id: string) {
    await adminFetch(`/${resourceName}/${id}`, {
      method: 'DELETE',
    });
    await load();
  }

  if (error) {
    return <section>Failed to load {resourceName}: {error}</section>;
  }

  if (!meta) {
    return <section>Loading {resourceName}…</section>;
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">Resource</span>
          <h2>{meta.resource.label}</h2>
        </div>
        <a className="button button--primary" href={`#/${resourceName}/new`}>
          New {meta.resource.label}
        </a>
      </header>

      <div className="toolbar">
        <input
          className="input"
          placeholder={`Search ${meta.resource.search.join(', ') || meta.resource.label}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {meta.filterOptions[0] ? (
          <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All {meta.filterOptions[0].field}</option>
            {meta.filterOptions[0].values.map((value) => (
              <option key={String(value)} value={String(value)}>
                {String(value)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <table className="table">
        <thead>
          <tr>
            {meta.resource.list.map((field) => (
              <th key={field}>{field}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={String(item.id)}>
              {meta.resource.list.map((field) => (
                <td key={field}>{String(item[field] ?? '')}</td>
              ))}
              <td className="table__actions">
                <a className="button" href={`#/${resourceName}/edit/${String(item.id)}`}>
                  Edit
                </a>
                {meta.resource.actions.map((action) => (
                  <button
                    key={action.slug}
                    className="button"
                    type="button"
                    onClick={() => void runAction(String(item.id), action.slug)}
                  >
                    {action.name}
                  </button>
                ))}
                <button className="button button--danger" type="button" onClick={() => void remove(String(item.id))}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
