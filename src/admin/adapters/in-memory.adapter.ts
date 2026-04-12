import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  AdminAdapter,
  AdminEntity,
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
        updatedAt: '2026-04-10T09:30:00.000Z',
      },
      {
        id: '2',
        email: 'grace@example.com',
        role: 'editor',
        active: true,
        createdAt: '2026-04-05T10:30:00.000Z',
        updatedAt: '2026-04-11T11:05:00.000Z',
      },
      {
        id: '3',
        email: 'linus@example.com',
        role: 'viewer',
        active: false,
        createdAt: '2026-04-07T12:15:00.000Z',
        updatedAt: '2026-04-09T16:40:00.000Z',
      },
    ],
    orders: [
      {
        id: '101',
        number: 'ORD-1001',
        userId: '1',
        status: 'pending',
        total: 129.99,
        createdAt: '2026-04-02T09:20:00.000Z',
        updatedAt: '2026-04-10T14:10:00.000Z',
      },
      {
        id: '102',
        number: 'ORD-1002',
        userId: '2',
        status: 'paid',
        total: 349.5,
        createdAt: '2026-04-06T14:45:00.000Z',
        updatedAt: '2026-04-11T08:55:00.000Z',
      },
      {
        id: '103',
        number: 'ORD-1003',
        userId: '3',
        status: 'cancelled',
        total: 79,
        createdAt: '2026-04-08T11:05:00.000Z',
        updatedAt: '2026-04-08T15:25:00.000Z',
      },
    ],
    products: [
      {
        id: '201',
        sku: 'NW-001',
        name: 'Chai',
        unitPrice: 18,
        unitsInStock: 39,
        discontinued: false,
        categories: ['401'],
        createdAt: '2026-04-03T08:00:00.000Z',
        updatedAt: '2026-04-10T08:00:00.000Z',
      },
      {
        id: '202',
        sku: 'NW-002',
        name: 'Chang',
        unitPrice: 19,
        unitsInStock: 17,
        discontinued: false,
        categories: ['401'],
        createdAt: '2026-04-03T08:10:00.000Z',
        updatedAt: '2026-04-09T13:20:00.000Z',
      },
      {
        id: '203',
        sku: 'NW-003',
        name: 'Aniseed Syrup',
        unitPrice: 10,
        unitsInStock: 13,
        discontinued: false,
        categories: ['402'],
        createdAt: '2026-04-03T08:20:00.000Z',
        updatedAt: '2026-04-11T07:45:00.000Z',
      },
      {
        id: '204',
        sku: 'NW-010',
        name: 'Ikura',
        unitPrice: 31,
        unitsInStock: 20,
        discontinued: false,
        categories: ['405'],
        createdAt: '2026-04-03T08:30:00.000Z',
        updatedAt: '2026-04-08T17:10:00.000Z',
      },
    ],
    categories: [
      {
        id: '401',
        name: 'Beverages',
        description: 'Soft drinks, coffees, teas, beers, and ales.',
        createdAt: '2026-04-03T07:40:00.000Z',
        updatedAt: '2026-04-10T07:40:00.000Z',
      },
      {
        id: '402',
        name: 'Condiments',
        description: 'Sweet and savory sauces, relishes, spreads, and seasonings.',
        createdAt: '2026-04-03T07:41:00.000Z',
        updatedAt: '2026-04-10T07:41:00.000Z',
      },
      {
        id: '403',
        name: 'Confections',
        description: 'Desserts, candies, and sweet baked goods.',
        createdAt: '2026-04-03T07:42:00.000Z',
        updatedAt: '2026-04-10T07:42:00.000Z',
      },
      {
        id: '404',
        name: 'Produce',
        description: 'Dried fruit and bean curd.',
        createdAt: '2026-04-03T07:43:00.000Z',
        updatedAt: '2026-04-10T07:43:00.000Z',
      },
      {
        id: '405',
        name: 'Seafood',
        description: 'Seaweed and fish products.',
        createdAt: '2026-04-03T07:44:00.000Z',
        updatedAt: '2026-04-10T07:44:00.000Z',
      },
    ],
    'order-details': [
      {
        id: '301',
        orderId: '101',
        productId: '201',
        unitPrice: 18,
        quantity: 2,
        discount: 0,
        createdAt: '2026-04-04T09:00:00.000Z',
        updatedAt: '2026-04-10T12:00:00.000Z',
      },
      {
        id: '302',
        orderId: '102',
        productId: '202',
        unitPrice: 19,
        quantity: 4,
        discount: 0.05,
        createdAt: '2026-04-06T15:00:00.000Z',
        updatedAt: '2026-04-11T16:20:00.000Z',
      },
      {
        id: '303',
        orderId: '103',
        productId: '204',
        unitPrice: 31,
        quantity: 1,
        discount: 0.1,
        createdAt: '2026-04-08T11:20:00.000Z',
        updatedAt: '2026-04-08T18:15:00.000Z',
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

    if (!this.store.products.length) {
      this.store.products = [];
    }

    if (!this.store.categories.length) {
      this.store.categories = [];
    }

    if (!this.store['order-details'].length) {
      this.store['order-details'] = [];
    }
  }

  async findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ): Promise<AdminListResult<TModel>> {
    const resourceName = resource.resourceName;
    const rows = [...(this.store[resourceName] ?? [])];
    const filtered = rows.filter((row) => matchesSearch(row, query.search) && matchesFilters(row, query.filters));
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
    this.store[resourceName] = rows.filter((row) => String(row.id) !== id);
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
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
