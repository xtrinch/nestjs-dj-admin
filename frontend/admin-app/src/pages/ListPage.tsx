import { useEffect, useRef, useState } from 'react';
import { BooleanIcon } from '../components/BooleanIcon.js';
import { formatAdminValue } from '../formatters.js';
import {
  getResourceMeta,
  listResource,
  lookupResource,
  runBulkResourceAction,
} from '../services/resources.service.js';
import { showToast } from '../services/toast.service.js';
import type { AdminLookupItem, ResourceField, ResourceMetaResponse } from '../types.js';

const PAGE_SIZE = 20;
const RELATION_FILTER_LOOKUP_PAGE_SIZE = 20;

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
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [selectingAllMatching, setSelectingAllMatching] = useState(false);
  const [selectedBulkAction, setSelectedBulkAction] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [relationLabels, setRelationLabels] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    void load();
  }, [resourceName, search, JSON.stringify(filters), page, sort, order]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
    setAllMatchingSelected(false);
    setSelectedBulkAction('');
  }, [resourceName, search, JSON.stringify(filters), sort, order]);

  useEffect(() => {
    setSort(null);
    setOrder('asc');
    setFilters({});
    setSearchInput('');
    setSearch('');
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
      setTotal(listJson.total);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
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
      showToast({
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

  async function selectAllMatching() {
    if (!meta) {
      return;
    }

    setSelectingAllMatching(true);

    try {
      const effectiveFilters = { ...filters };
      if (meta.resource.softDelete?.enabled && !effectiveFilters[meta.resource.softDelete.filterField]) {
        effectiveFilters[meta.resource.softDelete.filterField] = 'active';
      }

      const response = await listResource(resourceName, {
        page: 1,
        pageSize: total,
        search,
        sort: activeSort ?? undefined,
        order: activeOrder,
        filters: effectiveFilters,
      });

      setSelectedIds(response.items.map((item) => String(item.id)));
      setAllMatchingSelected(true);
    } catch (reason) {
      showToast({ message: (reason as Error).message, variant: 'error' });
    } finally {
      setSelectingAllMatching(false);
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
  const pageSelectionCount = items.filter((item) => selectedIds.includes(String(item.id))).length;
  const shouldOfferSelectAllMatching = !allMatchingSelected && total > items.length && allVisibleSelected;
  const singularItemLabel = meta.resource.label.toLowerCase();
  const pluralItemLabel = `${singularItemLabel}s`;
  const selectionContent = selectedIds.length > 0
    ? allMatchingSelected
      ? (
          <>
            <span>All {total} {pluralItemLabel} are selected.</span>
            <button
              className="selection-banner__link"
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setAllMatchingSelected(false);
              }}
            >
              Clear selection
            </button>
          </>
        )
      : (
          <>
            <span>
              {pageSelectionCount} {pageSelectionCount === 1 ? singularItemLabel : pluralItemLabel} on this page selected.
            </span>
            {shouldOfferSelectAllMatching ? (
              <button
                className="selection-banner__link"
                disabled={selectingAllMatching}
                type="button"
                onClick={() => void selectAllMatching()}
              >
                {selectingAllMatching
                  ? `Selecting all ${total} ${pluralItemLabel}…`
                  : `Select all ${total} ${pluralItemLabel}`}
              </button>
            ) : (
              <button
                className="selection-banner__link"
                type="button"
                onClick={() => {
                  setSelectedIds([]);
                  setAllMatchingSelected(false);
                }}
              >
                Clear selection
              </button>
            )}
          </>
        )
    : null;

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">Resource</span>
          <div className="panel__title-row">
            <h2>{meta.resource.label}</h2>
            {meta.resource.softDelete?.enabled ? (
              <span className="resource-pill">Soft delete</span>
            ) : null}
          </div>
        </div>
        <a className="button button--primary" href={`#/${resourceName}/new`}>
          New {meta.resource.label}
        </a>
      </header>

      <div className="changelist">
        <div className="changelist__main">
          <div className="toolbar toolbar--search">
            <input
              className="input toolbar__search"
              placeholder={`Search ${meta.resource.search.join(', ') || meta.resource.label}`}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="toolbar toolbar--actions">
            <div className="toolbar__bulk-actions">
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
            </div>

            <div className="selection-banner selection-banner--inline">
              {selectionContent}
            </div>
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
                    setAllMatchingSelected(false);
                    setSelectedIds(items.map((item) => String(item.id)));
                    return;
                  }

                  setSelectedIds([]);
                  setAllMatchingSelected(false);
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
                    if (!event.target.checked) {
                      setAllMatchingSelected(false);
                    }
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
        </div>

        {meta.filterOptions.length > 0 ? (
          <aside className="filters-sidebar">
            <div className="filters-sidebar__header">
              <span className="panel__eyebrow">Filter</span>
              <h3>Refine results</h3>
            </div>
            <div className="filters-sidebar__body">
              {meta.filterOptions.map((filterOption) => {
                const field = meta.resource.fields.find((candidate) => candidate.name === filterOption.field);

                return (
                  <label className="filters-sidebar__filter" key={filterOption.field}>
                    <span className="filters-sidebar__label">
                      {resolveFilterLabel(filterOption.field, fieldLabels[filterOption.field])}
                    </span>
                    {field?.relation ? (
                      <RelationFilterControl
                        field={field}
                        value={filters[filterOption.field] ?? ''}
                        onChange={(value) =>
                          setFilters((current) => ({
                            ...current,
                            [filterOption.field]: value,
                          }))
                        }
                      />
                    ) : (
                      <select
                        className="input"
                        value={filters[filterOption.field] ?? ''}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            [filterOption.field]: event.target.value,
                          }))
                        }
                      >
                        <option value="">All</option>
                        {filterOption.values.map((value) => (
                          <option key={String(value)} value={String(value)}>
                            {resolveFilterValueLabel(filterOption.field, value)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function resolveFilterLabel(field: string, label?: string): string {
  if (field === '__softDeleteState') {
    return 'visibility';
  }

  return label ?? field;
}

function resolveFilterValueLabel(
  field: string,
  value: string | number,
): string {
  if (field === '__softDeleteState') {
    return startCase(String(value));
  }

  if (isBooleanFilterValue(value)) {
    return String(value) === 'true' ? 'Yes' : 'No';
  }

  return startCase(String(value));
}

function isBooleanFilterValue(value: string | number): boolean {
  return value === 'true' || value === 'false';
}

function startCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (match) => match.toUpperCase());
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

function RelationFilterControl({
  field,
  value,
  onChange,
}: {
  field: ResourceField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [options, setOptions] = useState<AdminLookupItem[]>([]);
  const [selectedCache, setSelectedCache] = useState<Record<string, AdminLookupItem>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = value
    ? selectedCache[value] ?? options.find((option) => option.value === value) ?? null
    : null;

  useEffect(() => {
    if (!open || !field.relation) {
      return;
    }

    if (!query.trim()) {
      void search('');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void search(query);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, query, field.name, field.relation?.option.resource]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!value || selectedOption || !field.relation) {
      return;
    }

    void hydrateSelected(value);
  }, [value, selectedOption, field.name, field.relation?.option.resource]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  async function search(nextQuery = query) {
    if (!field.relation) {
      return;
    }

    setLoading(true);
    try {
      const response = await lookupResource(field.relation.option.resource, {
        page: 1,
        pageSize: RELATION_FILTER_LOOKUP_PAGE_SIZE,
        q: nextQuery.trim() || undefined,
      });
      setOptions(response.items);
      setLoaded(true);
      setSelectedCache((current) => ({
        ...current,
        ...Object.fromEntries(response.items.map((item) => [item.value, item])),
      }));
    } finally {
      setLoading(false);
    }
  }

  async function hydrateSelected(id: string) {
    if (!field.relation) {
      return;
    }

    const response = await lookupResource(field.relation.option.resource, {
      ids: [id],
      page: 1,
      pageSize: 1,
    });

    setSelectedCache((current) => ({
      ...current,
      ...Object.fromEntries(response.items.map((item) => [item.value, item])),
    }));
  }

  return (
    <div className="relation-picker" ref={rootRef}>
      <button
        className="input relation-picker__trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? 'All'}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="relation-picker__dropdown">
          <input
            autoFocus
            className="input"
            placeholder={`Search ${field.label.toLowerCase()}`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={`relation-picker__results${loading ? ' relation-picker__results--loading' : ''}`}>
            <button
              className="relation-option relation-option--button"
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              All
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                className="relation-option relation-option--button"
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setSelectedCache((current) => ({
                    ...current,
                    [option.value]: option,
                  }));
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
            {!loading && loaded && options.length === 0 ? (
              <div className="relation-picker__empty">No matches found.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
