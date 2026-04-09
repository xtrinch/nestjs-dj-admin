import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminListQuery,
  AdminListResult,
} from '../types/admin.types.js';

type Store = Record<string, Array<Record<string, unknown>>>;

@Injectable()
export class InMemoryAdminAdapter implements AdminAdapter, OnModuleInit {
  private readonly store: Store = {
    users: [
      {
        id: '1',
        email: 'ada@example.com',
        role: 'admin',
        active: true,
        createdAt: '2026-04-01T08:00:00.000Z',
      },
      {
        id: '2',
        email: 'grace@example.com',
        role: 'editor',
        active: true,
        createdAt: '2026-04-05T10:30:00.000Z',
      },
      {
        id: '3',
        email: 'linus@example.com',
        role: 'viewer',
        active: false,
        createdAt: '2026-04-07T12:15:00.000Z',
      },
    ],
    orders: [
      {
        id: '101',
        number: 'ORD-1001',
        userEmail: 'ada@example.com',
        status: 'pending',
        total: 129.99,
        createdAt: '2026-04-02T09:20:00.000Z',
      },
      {
        id: '102',
        number: 'ORD-1002',
        userEmail: 'grace@example.com',
        status: 'paid',
        total: 349.5,
        createdAt: '2026-04-06T14:45:00.000Z',
      },
      {
        id: '103',
        number: 'ORD-1003',
        userEmail: 'linus@example.com',
        status: 'cancelled',
        total: 79,
        createdAt: '2026-04-08T11:05:00.000Z',
      },
    ],
  };

  onModuleInit(): void {
    if (!this.store.users.length) {
      this.store.users = [];
    }

    if (!this.store.orders.length) {
      this.store.orders = [];
    }
  }

  async findMany(resource: AdminAdapterResource, query: AdminListQuery): Promise<AdminListResult> {
    const resourceName = resource.resourceName;
    const rows = [...(this.store[resourceName] ?? [])];
    const filtered = rows.filter((row) => matchesSearch(row, query.search) && matchesFilters(row, query.filters));
    const sorted = sortRows(filtered, query.sort, query.order ?? 'asc');
    const start = (query.page - 1) * query.pageSize;
    const items = sorted.slice(start, start + query.pageSize);

    return {
      items,
      total: filtered.length,
    };
  }

  async findOne(resource: AdminAdapterResource, id: string) {
    const resourceName = resource.resourceName;
    return (this.store[resourceName] ?? []).find((row) => String(row.id) === id) ?? null;
  }

  async create(resource: AdminAdapterResource, data: Record<string, unknown>) {
    const resourceName = resource.resourceName;
    const record = {
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.store[resourceName] = this.store[resourceName] ?? [];
    this.store[resourceName].unshift(record);
    return record;
  }

  async update(resource: AdminAdapterResource, id: string, data: Record<string, unknown>) {
    const resourceName = resource.resourceName;
    const rows = this.store[resourceName] ?? [];
    const index = rows.findIndex((row) => String(row.id) === id);

    if (index < 0) {
      throw new Error(`Record "${id}" not found`);
    }

    rows[index] = { ...rows[index], ...data };
    return rows[index];
  }

  async delete(resource: AdminAdapterResource, id: string) {
    const resourceName = resource.resourceName;
    const rows = this.store[resourceName] ?? [];
    this.store[resourceName] = rows.filter((row) => String(row.id) !== id);
  }

  async distinct(resource: AdminAdapterResource, field: string) {
    const resourceName = resource.resourceName;
    const rows = this.store[resourceName] ?? [];
    return [...new Set(rows.map((row) => row[field] as string | number).filter(Boolean))];
  }
}

function matchesSearch(row: Record<string, unknown>, search?: string): boolean {
  if (!search) {
    return true;
  }

  const candidate = Object.values(row).join(' ').toLowerCase();
  return candidate.includes(search.toLowerCase());
}

function matchesFilters(
  row: Record<string, unknown>,
  filters?: Record<string, string | string[]>,
): boolean {
  if (!filters) {
    return true;
  }

  return Object.entries(filters).every(([field, value]) => {
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
