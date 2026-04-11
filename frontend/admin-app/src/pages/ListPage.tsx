import { useEffect, useState } from 'react';
import { BooleanIcon } from '../components/BooleanIcon.js';
import { formatAdminValue } from '../formatters.js';
import {
  getResourceMeta,
  listResource,
  runResourceAction,
} from '../services/resources.service.js';
import type { ResourceMetaResponse } from '../types.js';

const PAGE_SIZE = 20;

export function ListPage({
  resourceName,
  onTitleChange,
}: {
  resourceName: string;
  onTitleChange?: (label: string | null) => void;
}) {
  const [meta, setMeta] = useState<ResourceMetaResponse | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [resourceName, search, filter, page]);

  useEffect(() => {
    setPage(1);
  }, [resourceName, search, filter]);

  async function load() {
    try {
      const metaJson = await getResourceMeta(resourceName);
      setMeta(metaJson);
      onTitleChange?.(null);
      const listJson = await listResource(resourceName, {
        page,
        pageSize: PAGE_SIZE,
        search,
        filterField: metaJson.resource.filters[0],
        filterValue: filter,
      });
      setItems(listJson.items);
      setSelectedIds([]);
      setSelectedAction('');
      setTotal(listJson.total);
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function runAction(id: string, actionSlug: string) {
    await runResourceAction(resourceName, id, actionSlug);
    await load();
  }

  function runBulkAction() {
    if (selectedAction !== 'delete_selected' || selectedIds.length === 0) {
      return;
    }

    window.location.hash = `#/${resourceName}/delete/${selectedIds.join(',')}`;
  }

  if (error) {
    return <section>Failed to load {resourceName}: {error}</section>;
  }

  if (!meta) {
    return <section>Loading {resourceName}…</section>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(String(item.id)));

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
        <select
          className="input toolbar__action-select"
          value={selectedAction}
          onChange={(event) => setSelectedAction(event.target.value)}
        >
          <option value="">Select action</option>
          <option value="delete_selected">Delete selected</option>
        </select>
        <button
          className="button"
          disabled={!selectedAction || selectedIds.length === 0}
          type="button"
          onClick={runBulkAction}
        >
          Go
        </button>
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
            <th>
              <input
                checked={allVisibleSelected}
                className="checkbox"
                type="checkbox"
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedIds(items.map((item) => String(item.id)));
                    return;
                  }

                  setSelectedIds([]);
                }}
              />
            </th>
            {meta.resource.list.map((field) => (
              <th key={field}>{field}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={String(item.id)}>
              <td>
                <input
                  checked={selectedIds.includes(String(item.id))}
                  className="checkbox"
                  type="checkbox"
                  onChange={(event) => {
                    const itemId = String(item.id);
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...current, itemId]
                        : current.filter((candidate) => candidate !== itemId),
                    );
                  }}
                />
              </td>
              {meta.resource.list.map((field) => {
                const value =
                  typeof item[field] === 'boolean' ? (
                    <BooleanIcon value={item[field] as boolean} />
                  ) : (
                    formatAdminValue(item[field], field, meta.display)
                  );

                return (
                  <td key={field}>
                    {meta.resource.listDisplayLinks.includes(field) ? (
                      <a className="table__link" href={`#/${resourceName}/edit/${String(item.id)}`}>
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
              <td className="table__actions">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="pagination">
        <span className="pagination__summary">
          Page {page} of {totalPages} • {total} items
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
