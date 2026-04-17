import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  AdminAdapter,
  AdminEntity,
  AdminAdapterResource,
  AdminListQuery,
  AdminListResult,
  AdminSearchField,
} from '../types/admin.types.js';

export type InMemoryAdminStore = Record<string, Array<Record<string, unknown>>>;

const DEFAULT_COLLECTIONS = ['users', 'orders', 'products', 'categories', 'order-details'] as const;

export function createInMemoryAdminStore(seed?: InMemoryAdminStore): InMemoryAdminStore {
  const store: InMemoryAdminStore = {};

  for (const [resourceName, rows] of Object.entries(seed ?? {})) {
    store[resourceName] = rows.map((row) => ({ ...row }));
  }

  ensureDefaultCollections(store);
  return store;
}

@Injectable()
export class InMemoryAdminAdapter implements AdminAdapter, OnModuleInit {
  constructor(private readonly store: InMemoryAdminStore = createInMemoryAdminStore()) {}

  onModuleInit(): void {
    ensureDefaultCollections(this.store);
  }

  async findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ): Promise<AdminListResult<TModel>> {
    const resourceName = resource.resourceName;
    const rows = [...(this.store[resourceName] ?? [])];
    const filtered = rows.filter((row) =>
      matchesSearch(resource, row, query.search, this.store) &&
      matchesFilters(row, query.filters, resource.softDelete?.fieldName),
    );
    const sorted = sortRows(filtered, query.sort, query.order ?? 'asc');
    const start = (query.page - 1) * query.pageSize;
    const items = sorted.slice(start, start + query.pageSize);

    return {
      items: items as TModel[],
      total: filtered.length,
    };
  }

  async findOne<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const resourceName = resource.resourceName;
    return (((this.store[resourceName] ?? []).find((row) => String(row.id) === id) as TModel) ??
      null) as TModel | null;
  }

  async create<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, data: Partial<TModel>) {
    const resourceName = resource.resourceName;
    const record = {
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    this.store[resourceName] = this.store[resourceName] ?? [];
    this.store[resourceName].unshift(record);
    return record as TModel;
  }

  async update<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
    data: Partial<TModel>,
  ) {
    const resourceName = resource.resourceName;
    const rows = this.store[resourceName] ?? [];
    const index = rows.findIndex((row) => String(row.id) === id);

    if (index < 0) {
      throw new Error(`Record "${id}" not found`);
    }

    rows[index] = { ...rows[index], ...data, updatedAt: new Date().toISOString() };
    return rows[index] as TModel;
  }

  async delete<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const resourceName = resource.resourceName;
    const rows = this.store[resourceName] ?? [];
    if (resource.softDelete) {
      const index = rows.findIndex((row) => String(row.id) === id);
      if (index >= 0) {
        rows[index] = {
          ...rows[index],
          [resource.softDelete.fieldName]: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return;
    }

    this.store[resourceName] = rows.filter((row) => String(row.id) !== id);
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
    const resourceName = resource.resourceName;
    const rows = this.store[resourceName] ?? [];
    return [
      ...new Set(
        rows
          .filter((row) => !resource.softDelete || row[resource.softDelete.fieldName] == null)
          .map((row) => row[field] as string | number)
          .filter(Boolean),
      ),
    ];
  }
}

function ensureDefaultCollections(store: InMemoryAdminStore): void {
  for (const collectionName of DEFAULT_COLLECTIONS) {
    store[collectionName] = store[collectionName] ?? [];
  }
}

function matchesSearch(
  resource: AdminAdapterResource,
  row: Record<string, unknown>,
  search: string | undefined,
  store: InMemoryAdminStore,
): boolean {
  if (!search) {
    return true;
  }

  const needle = search.toLowerCase();
  return resource.search.some((field) =>
    getSearchCandidates(row, field, store).some((candidate) => candidate.includes(needle)),
  );
}

function getSearchCandidates(
  row: Record<string, unknown>,
  field: AdminSearchField,
  store: InMemoryAdminStore,
): string[] {
  if (field.kind === 'field') {
    return [String(row[field.path] ?? '').toLowerCase()].filter(Boolean);
  }

  const relationValue = row[field.relationField];
  if (field.relationKind === 'many-to-many') {
    const relationIds = Array.isArray(relationValue) ? relationValue.map(String) : [];
    if (relationIds.length === 0) {
      return [];
    }

    return (store[field.relationResource] ?? [])
      .filter((candidate) => relationIds.includes(String(candidate[field.valueField] ?? '')))
      .map((candidate) => String(candidate[field.targetField] ?? '').toLowerCase())
      .filter(Boolean);
  }

  if (relationValue == null) {
    return [];
  }

  const related = (store[field.relationResource] ?? []).find(
    (candidate) => String(candidate[field.valueField] ?? '') === String(relationValue),
  );

  if (!related) {
    return [];
  }

  return [String(related[field.targetField] ?? '').toLowerCase()].filter(Boolean);
}

function matchesFilters(
  row: Record<string, unknown>,
  filters?: Record<string, string | string[]>,
  softDeleteFieldName?: string,
): boolean {
  if (softDeleteFieldName) {
    const softDeleteState = filters?.['__softDeleteState'];
    if (softDeleteState === 'deleted') {
      if (row[softDeleteFieldName] == null) {
        return false;
      }
    } else if (softDeleteState !== 'all' && row[softDeleteFieldName] != null) {
      return false;
    }
  }

  if (!filters) {
    return true;
  }

  return Object.entries(filters).every(([field, value]) => {
    if (softDeleteFieldName && field === '__softDeleteState') {
      if (value === 'all') {
        return true;
      }

      if (value === 'deleted') {
        return row[softDeleteFieldName] != null;
      }

      return row[softDeleteFieldName] == null;
    }

    if (Array.isArray(value)) {
      return value.includes(String(row[field] ?? ''));
    }

    return String(row[field] ?? '') === value;
  });
}

function sortRows(
  rows: Array<Record<string, unknown>>,
  sort: string | undefined,
  order: 'asc' | 'desc',
) {
  if (!sort) {
    return rows;
  }

  return rows.sort((left, right) => {
    const leftValue = left[sort];
    const rightValue = right[sort];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === undefined) {
      return 1;
    }

    if (rightValue === undefined) {
      return -1;
    }

    const comparison = String(leftValue).localeCompare(String(rightValue));
    return order === 'asc' ? comparison : comparison * -1;
  });
}
