import { useEffect, useState } from 'react';
import { BooleanIcon } from '../components/BooleanIcon.js';
import { formatAdminValue } from '../formatters.js';
import {
  getResourceMeta,
  listResource,
  lookupResource,
  runResourceAction,
} from '../services/resources.service.js';
import { showToast } from '../services/toast.service.js';
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
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [relationLabels, setRelationLabels] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    void load();
  }, [resourceName, search, JSON.stringify(filters), page, sort, order]);

  useEffect(() => {
    setPage(1);
  }, [resourceName, search, JSON.stringify(filters), sort, order]);

  useEffect(() => {
    setSort(null);
    setOrder('asc');
    setFilters({});
  }, [resourceName]);

  async function load() {
    try {
      const metaJson = await getResourceMeta(resourceName);
      const activeSort = sort ?? metaJson.resource.defaultSort?.field;
      const activeOrder = sort
        ? order
        : metaJson.resource.defaultSort?.order ?? order;
      setMeta(metaJson);
      onTitleChange?.(null);
      const listJson = await listResource(resourceName, {
        page,
        pageSize: PAGE_SIZE,
        search,
        sort: activeSort,
        order: activeOrder,
        filters,
      });
      setItems(listJson.items);
      setRelationLabels(await loadRelationLabels(metaJson, listJson.items));
      setSelectedIds([]);
      setSelectedAction('');
      setTotal(listJson.total);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  async function runAction(id: string, actionSlug: string) {
    try {
      await runResourceAction(resourceName, id, actionSlug);
      await load();
    } catch (reason) {
      showToast({ message: (reason as Error).message, variant: 'error' });
    }
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
  const fieldLabels = Object.fromEntries(meta.resource.fields.map((field) => [field.name, field.label]));
  const activeSort = sort ?? meta.resource.defaultSort?.field ?? null;
  const activeOrder = sort
    ? order
    : meta.resource.defaultSort?.order ?? order;

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
        {meta.filterOptions.map((filterOption) => (
          <select
            key={filterOption.field}
            className="input"
            value={filters[filterOption.field] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                [filterOption.field]: event.target.value,
              }))
            }
          >
            <option value="">All {filterOption.field}</option>
            {filterOption.values.map((value) => (
              <option key={String(value)} value={String(value)}>
                {String(value)}
              </option>
            ))}
          </select>
        ))}
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
            {meta.resource.list.map((field) => {
              const isSortable = meta.resource.sortable.includes(field);

              return (
                <th key={field}>
                  {isSortable ? (
                    <button
                      className="table__sort"
                      type="button"
                      onClick={() => {
                        if (activeSort === field) {
                          setSort(field);
                          setOrder(activeOrder === 'asc' ? 'desc' : 'asc');
                          return;
                        }

                        setSort(field);
                        setOrder('asc');
                      }}
                    >
                      <span>{fieldLabels[field] ?? field}</span>
                      <span
                        className={`table__sort-indicator${activeSort === field ? ' table__sort-indicator--active' : ''}`}
                      >
                        {activeSort === field ? (activeOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    fieldLabels[field] ?? field
                  )}
                </th>
              );
            })}
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
                const relationField = meta.resource.fields.find((candidate) => candidate.name === field);
                const value =
                  typeof item[field] === 'boolean' ? (
                    <BooleanIcon value={item[field] as boolean} />
                  ) : relationField?.relation ? (
                    resolveRelationLabel(relationLabels[field], item[field])
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
                {meta.resource.actions.length > 0 ? (
                  <div className="table__actions-list">
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
                  </div>
                ) : null}
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

async function loadRelationLabels(
  meta: ResourceMetaResponse,
  items: Array<Record<string, unknown>>,
): Promise<Record<string, Record<string, string>>> {
  const relationFields = meta.resource.fields.filter(
    (field) => field.relation && meta.resource.list.includes(field.name),
  );

  if (relationFields.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    relationFields.map(async (field) => {
      const ids = [...new Set(
        items
          .map((item) => item[field.name])
          .filter((value) => value !== null && value !== undefined && value !== '')
          .map((value) => String(value)),
      )];

      if (ids.length === 0) {
        return [field.name, {}] as const;
      }

      const data = await lookupResource(field.relation!.option.resource, { ids, pageSize: ids.length });

      const labels = Object.fromEntries(data.items.map((item) => [item.value, item.label]));

      return [field.name, labels] as const;
    }),
  );

  return Object.fromEntries(entries);
}

function resolveRelationLabel(
  labels: Record<string, string> | undefined,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return '';
  }

  const key = String(value);
  return labels?.[key] ?? key;
}
