import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminEntity,
  AdminListQuery,
} from '../types/admin.types.js';

@Injectable()
export class PrismaAdminAdapter implements AdminAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ) {
    const delegate = this.getDelegate(resource.resourceName);
    const where = buildPrismaWhere(query);
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'asc' } : undefined;
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      delegate.count({ where }),
    ]);

    return { items: items as TModel[], total };
  }

  async findOne<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const delegate = this.getDelegate(resource.resourceName);
    return (await delegate.findUnique({ where: { id } })) as TModel | null;
  }

  async create<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
  ) {
    return (await this.getDelegate(resource.resourceName).create({ data })) as TModel;
  }

  async update<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
    data: Partial<TModel>,
  ) {
    return (await this.getDelegate(resource.resourceName).update({
      where: { id },
      data,
    })) as TModel;
  }

  async delete<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    await this.getDelegate(resource.resourceName).delete({ where: { id } });
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
    const rows = await this.getDelegate(resource.resourceName).findMany({
      distinct: [field],
      select: { [field]: true },
    });
    return rows.map((row: Record<string, string | number>) => row[field]);
  }

  private getDelegate(resourceName: string) {
    const delegate = (this.prisma as unknown as Record<string, any>)[resourceName];
    if (!delegate) {
      throw new Error(`Prisma model delegate "${resourceName}" not found`);
    }

    return delegate;
  }
}

function buildPrismaWhere(query: AdminListQuery) {
  const clauses: Record<string, unknown>[] = [];

  if (query.search) {
    clauses.push({
      OR: [],
    });
  }

  for (const [field, value] of Object.entries(query.filters ?? {})) {
    clauses.push({ [field]: value });
  }

  if (clauses.length === 0) {
    return undefined;
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return { AND: clauses };
}
