import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AdminAdapter, AdminAdapterResource, AdminListQuery } from '../types/admin.types.js';

@Injectable()
export class PrismaAdminAdapter implements AdminAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(resource: AdminAdapterResource, query: AdminListQuery) {
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

    return { items, total };
  }

  async findOne(resource: AdminAdapterResource, id: string) {
    const delegate = this.getDelegate(resource.resourceName);
    return delegate.findUnique({ where: { id } });
  }

  async create(resource: AdminAdapterResource, data: Record<string, unknown>) {
    return this.getDelegate(resource.resourceName).create({ data });
  }

  async update(resource: AdminAdapterResource, id: string, data: Record<string, unknown>) {
    return this.getDelegate(resource.resourceName).update({ where: { id }, data });
  }

  async delete(resource: AdminAdapterResource, id: string) {
    await this.getDelegate(resource.resourceName).delete({ where: { id } });
  }

  async distinct(resource: AdminAdapterResource, field: string) {
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
