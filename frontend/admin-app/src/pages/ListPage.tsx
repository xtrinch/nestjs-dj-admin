import { useEffect, useState } from 'react';
import { BooleanIcon } from '../components/BooleanIcon.js';
import { formatAdminValue } from '../formatters.js';
import {
  getResourceMeta,
  listResource,
  lookupResource,
  runBulkResourceAction,
  runResourceAction,
} from '../services/resources.service.js';
import { queueToast, showToast } from '../services/toast.service.js';
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
  const [selectedBulkAction, setSelectedBulkAction] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [relationLabels, setRelationLabels] = useState<Record<string, Record<string, string>>>({});
  const [filterValueLabels, setFilterValueLabels] = useState<Record<string, Record<string, string>>>({});

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
      const effectiveFilters = { ...filters };
      if (metaJson.resource.softDelete?.enabled && !effectiveFilters[metaJson.resource.softDelete.filterField]) {
        effectiveFilters[metaJson.resource.softDelete.filterField] = 'active';
        setFilters((current) =>
          current[metaJson.resource.softDelete?.filterField ?? '']
            ? current
            : { ...current, [metaJson.resource.softDelete!.filterField]: 'active' },
        );
      }
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
        filters: effectiveFilters,
      });
      setItems(listJson.items);
      const relationLabelSets = await loadRelationLabels(metaJson, listJson.items);
      setRelationLabels(relationLabelSets);
      setFilterValueLabels(await loadRelationFilterLabels(metaJson));
      setSelectedIds([]);
      setSelectedBulkAction('');
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

  async function runBulkAction() {
    if (selectedIds.length === 0) {
      return;
    }

    if (selectedBulkAction === 'delete_selected') {
      window.location.hash = `#/${resourceName}/delete/${selectedIds.join(',')}`;
      return;
    }

    const action = meta?.resource.bulkActions.find((candidate) => candidate.slug === selectedBulkAction);
    if (!action) {
      return;
    }

    try {
      await runBulkResourceAction(resourceName, action.slug, selectedIds);
      queueToast({
        message:
          selectedIds.length === 1
            ? `${action.name} applied to 1 ${meta?.resource.label.toLowerCase()}.`
            : `${action.name} applied to ${selectedIds.length} ${meta?.resource.label.toLowerCase()}s.`,
      });
      await load();
    } catch (reason) {
      showToast({ message: (reason as Error).message, variant: 'error' });
    }
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
          value={selectedBulkAction}
          onChange={(event) => setSelectedBulkAction(event.target.value)}
        >
          <option value="">Bulk actions</option>
          <option value="delete_selected">
            {meta.resource.softDelete?.enabled ? 'Archive selected' : 'Delete selected'}
          </option>
          {meta.resource.bulkActions.map((action) => (
            <option key={action.slug} value={action.slug}>
              {action.name}
            </option>
          ))}
        </select>
        <button
          className={selectedBulkAction === 'delete_selected' ? 'button button--danger' : 'button'}
          disabled={selectedIds.length === 0 || !selectedBulkAction}
          type="button"
          onClick={() => void runBulkAction()}
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
            {filterOption.field === '__softDeleteState' ? null : (
              <option value="">All {resolveFilterLabel(filterOption.field)}</option>
            )}
            {filterOption.values.map((value) => (
              <option key={String(value)} value={String(value)}>
                {resolveFilterValueLabel(filterOption.field, filterValueLabels[filterOption.field], value)}
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
                    resolveRelationLabel(relationLabels[field], item[field], relationField.relation.option.valueField)
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
                <div className="table__actions-list">
                  <a className="button button--danger" href={`#/${resourceName}/delete/${String(item.id)}`}>
                    {meta.resource.softDelete?.enabled ? 'Archive' : 'Delete'}
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
                </div>
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

function resolveFilterLabel(field: string): string {
  if (field === '__softDeleteState') {
    return 'visibility';
  }

  return field;
}

function resolveFilterValueLabel(
  field: string,
  relationLabels: Record<string, string> | undefined,
  value: string | number,
): string {
  if (field === '__softDeleteState') {
    if (value === 'active') {
      return 'Active';
    }

    if (value === 'deleted') {
      return 'Deleted';
    }

    if (value === 'all') {
      return 'All';
    }
  }

  return resolveRelationLabel(relationLabels, value);
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
        items.flatMap((item) => extractRelationIds(item[field.name], field.relation!.option.valueField)),
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

async function loadRelationFilterLabels(
  meta: ResourceMetaResponse,
): Promise<Record<string, Record<string, string>>> {
  const relationFilterFields = meta.filterOptions
    .map((filterOption) => ({
      filterOption,
      field: meta.resource.fields.find((candidate) => candidate.name === filterOption.field),
    }))
    .filter(
      (entry): entry is {
        filterOption: ResourceMetaResponse['filterOptions'][number];
        field: ResourceMetaResponse['resource']['fields'][number];
      } => Boolean(entry.field?.relation),
    );

  const entries = await Promise.all(
    relationFilterFields.map(async ({ filterOption, field }) => {
      const ids = [...new Set(filterOption.values.map((value) => String(value)).filter(Boolean))];
      if (ids.length === 0) {
        return [filterOption.field, {}] as const;
      }

      const data = await lookupResource(field.relation!.option.resource, {
        ids,
        pageSize: ids.length,
      });

      return [filterOption.field, Object.fromEntries(data.items.map((item) => [item.value, item.label]))] as const;
    }),
  );

  return Object.fromEntries(entries);
}

function resolveRelationLabel(
  labels: Record<string, string> | undefined,
  value: unknown,
  valueField = 'id',
): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    const values = extractRelationIds(value, valueField);
    return values.map((entry) => labels?.[entry] ?? entry).join(', ');
  }

  if (typeof value === 'object') {
    const key = extractRelationIds(value, valueField)[0];
    return key ? (labels?.[key] ?? key) : '';
  }

  const key = String(value);
  return labels?.[key] ?? key;
}

function extractRelationIds(value: unknown, valueField = 'id'): string[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractRelationIds(item, valueField));
  }

  if (typeof value === 'object') {
    const candidate = (value as Record<string, unknown>)[valueField];
    return candidate === null || candidate === undefined || candidate === ''
      ? []
      : [String(candidate)];
  }

  return [String(value)];
}
