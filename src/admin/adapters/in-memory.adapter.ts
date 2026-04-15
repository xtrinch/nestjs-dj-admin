import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  AdminAdapter,
  AdminEntity,
  AdminAdapterResource,
  AdminListQuery,
  AdminListResult,
  AdminSearchField,
} from '../types/admin.types.js';

type Store = Record<string, Array<Record<string, unknown>>>;

export const IN_MEMORY_ADMIN_STORE: Store = {
  users: [
    {
      id: '1',
      email: 'ada@example.com',
      phone: '+1 206 555 0101',
      profileUrl: 'https://example.com/users/ada',
      role: 'admin',
      passwordHash: 'afa966a0e009d93ec6b84a85e18b6f05:6cad40e0c9109b42799f300763f58dfe4ed1bcbabe93ff5e4d3198e40e022617eb975b08d2edc6df14c2de5239d6eb965f7881d7c377687b69b0f2c77d152a9a',
      active: true,
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-10T09:30:00.000Z',
    },
    {
      id: '2',
      email: 'grace@example.com',
      phone: '+1 206 555 0102',
      profileUrl: 'https://example.com/users/grace',
      role: 'editor',
      passwordHash: '023f35ca7d651fe4461ee1fc8832b017:1ceaeaa0045c7ecde39c002c4286bc4cd418b21afbebdd2a23eaa8cc8d4dff631a2bd3c05f6192f469f57785d1ce3b0322d140dde9efea26a27c0d6c2d7d4f4b',
      active: true,
      createdAt: '2026-04-05T10:30:00.000Z',
      updatedAt: '2026-04-11T11:05:00.000Z',
    },
    {
      id: '3',
      email: 'linus@example.com',
      phone: '+1 206 555 0103',
      profileUrl: 'https://example.com/users/linus',
      role: 'viewer',
      passwordHash: 'a6edd95f7ed30a5269c01d85ba56e2ae:52bc63660f38c953162ea6ea202f333db103258172f4ba1c79bccf9e0ee2b7a7dad5a41c32974aa6640af620acda9444da4b3886fbc091ed2486faa60be8ae62',
      active: false,
      createdAt: '2026-04-07T12:15:00.000Z',
      updatedAt: '2026-04-09T16:40:00.000Z',
    },
  ],
  orders: [
    {
      id: '101',
      number: 'ORD-1001',
      orderDate: '2026-04-01',
      deliveryTime: '09:00',
      fulfillmentAt: '2026-04-01T09:30',
      userId: '1',
      status: 'pending',
      total: 129.99,
      internalNote: 'Call before delivery.',
      createdAt: '2026-04-02T09:20:00.000Z',
      updatedAt: '2026-04-10T14:10:00.000Z',
    },
    {
      id: '102',
      number: 'ORD-1002',
      orderDate: '2026-04-02',
      deliveryTime: '14:30',
      fulfillmentAt: '2026-04-02T14:15',
      userId: '2',
      status: 'paid',
      total: 349.5,
      internalNote: 'Gift order. Do not include invoice in the parcel.',
      createdAt: '2026-04-06T14:45:00.000Z',
      updatedAt: '2026-04-11T08:55:00.000Z',
    },
    {
      id: '103',
      number: 'ORD-1003',
      orderDate: '2026-04-03',
      deliveryTime: null,
      fulfillmentAt: null,
      userId: '3',
      status: 'cancelled',
      total: 79,
      internalNote: '',
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
      deletedAt: null,
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
      deletedAt: null,
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
      deletedAt: null,
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
      deletedAt: '2026-04-12T10:15:00.000Z',
      categories: ['405'],
      createdAt: '2026-04-03T08:30:00.000Z',
      updatedAt: '2026-04-12T10:15:00.000Z',
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

@Injectable()
export class InMemoryAdminAdapter implements AdminAdapter, OnModuleInit {
  private readonly store: Store = IN_MEMORY_ADMIN_STORE;

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
    const filtered = rows.filter((row) =>
      matchesSearch(resource, row, query.search) &&
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
    return [...new Set(
      rows
        .filter((row) => !resource.softDelete || row[resource.softDelete.fieldName] == null)
        .map((row) => row[field] as string | number)
        .filter(Boolean),
    )];
  }
}

function matchesSearch(
  resource: AdminAdapterResource,
  row: Record<string, unknown>,
  search?: string,
): boolean {
  if (!search) {
    return true;
  }

  const needle = search.toLowerCase();
  return resource.search.some((field) => getSearchCandidates(row, field).some((candidate) => candidate.includes(needle)));
}

function getSearchCandidates(row: Record<string, unknown>, field: AdminSearchField): string[] {
  if (field.kind === 'field') {
    return [String(row[field.path] ?? '').toLowerCase()].filter(Boolean);
  }

  const relationValue = row[field.relationField];
  if (field.relationKind === 'many-to-many') {
    const relationIds = Array.isArray(relationValue) ? relationValue.map(String) : [];
    if (relationIds.length === 0) {
      return [];
    }

    return (IN_MEMORY_ADMIN_STORE[field.relationResource] ?? [])
      .filter((candidate) => relationIds.includes(String(candidate[field.valueField] ?? '')))
      .map((candidate) => String(candidate[field.targetField] ?? '').toLowerCase())
      .filter(Boolean);
  }

  if (relationValue == null) {
    return [];
  }

  const related = (IN_MEMORY_ADMIN_STORE[field.relationResource] ?? []).find(
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
