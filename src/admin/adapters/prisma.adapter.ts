import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminEntity,
  AdminListQuery,
  AdminSearchField,
} from '../types/admin.types.js';

@Injectable()
export class PrismaAdminAdapter implements AdminAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ) {
    const delegate = this.getDelegate(resource);
    const where = buildPrismaWhere(resource, query);
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'asc' } : undefined;
    const include = buildPrismaInclude(resource);
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy,
        include,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      delegate.count({ where }),
    ]);

    return { items: items as TModel[], total };
  }

  async findOne<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const delegate = this.getDelegate(resource);
    return (await delegate.findUnique({
      include: buildPrismaInclude(resource),
      where: { id: coerceId(id) },
    })) as TModel | null;
  }

  async create<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
  ) {
    return (await this.getDelegate(resource).create({
      data: normalizePrismaMutationData(resource, data, 'create'),
      include: buildPrismaInclude(resource),
    })) as TModel;
  }

  async update<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
    data: Partial<TModel>,
  ) {
    return (await this.getDelegate(resource).update({
      data: normalizePrismaMutationData(resource, data, 'update'),
      include: buildPrismaInclude(resource),
      where: { id: coerceId(id) },
    })) as TModel;
  }

  async delete<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    if (resource.softDelete) {
      await this.getDelegate(resource).update({
        data: {
          [resource.softDelete.fieldName]: new Date(),
        },
        where: { id: coerceId(id) },
      });
      return;
    }

    await this.getDelegate(resource).delete({
      where: { id: coerceId(id) },
    });
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
    const rows = await this.getDelegate(resource).findMany({
      distinct: [field],
      select: { [field]: true },
      where: resource.softDelete
        ? {
            [resource.softDelete.fieldName]: null,
          }
        : undefined,
    });
    return rows.map((row: Record<string, string | number>) => row[field]);
  }

  private getDelegate<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>) {
    const delegateName = this.resolveDelegateName(resource);
    const delegate = (this.prisma as unknown as Record<string, any>)[delegateName];
    if (!delegate) {
      throw new Error(`Prisma model delegate "${delegateName}" not found`);
    }

    return delegate;
  }

  private resolveDelegateName<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
  ): string {
    if (resource.model?.name) {
      return lowerFirst(resource.model.name);
    }

    return singularize(lowerFirst(resource.resourceName));
  }
}

function buildPrismaWhere(resource: AdminAdapterResource, query: AdminListQuery) {
  const clauses: Record<string, unknown>[] = [];
  const softDeleteFieldName = resource.softDelete?.fieldName;
  const softDeleteFilterField = resource.softDelete?.filterField;
  const softDeleteState = softDeleteFilterField ? query.filters?.[softDeleteFilterField] : undefined;

  if (softDeleteFieldName) {
    if (softDeleteState === 'deleted') {
      clauses.push({
        [softDeleteFieldName]: {
          not: null,
        },
      });
    } else if (softDeleteState !== 'all') {
      clauses.push({
        [softDeleteFieldName]: null,
      });
    }
  }

  if (query.search && resource.search.length > 0) {
    clauses.push({
      OR: resource.search.map((field) => buildPrismaSearchClause(field, query.search!)),
    });
  }

  for (const [field, value] of Object.entries(query.filters ?? {})) {
    if (softDeleteFieldName && field === softDeleteFilterField) {
      continue;
    }

    clauses.push(
      Array.isArray(value)
        ? {
            [field]: {
              in: value,
            },
          }
        : { [field]: value },
    );
  }

  if (clauses.length === 0) {
    return undefined;
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return { AND: clauses };
}

function buildPrismaSearchClause(field: AdminSearchField, search: string): Record<string, unknown> {
  if (field.kind === 'field') {
    return {
      [field.path]: {
        contains: search,
        mode: 'insensitive',
      },
    };
  }

  if (field.relationKind === 'many-to-many') {
    return {
      [field.relationField]: {
        some: {
          [field.targetField]: {
            contains: search,
            mode: 'insensitive',
          },
        },
      },
    };
  }

  return {
    [field.relationField]: {
      in: [],
    },
    __relationSearch: {
      relationResource: field.relationResource,
      targetField: field.targetField,
      valueField: field.valueField,
      search,
    },
  };
}

function coerceId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : `${value[0].toLowerCase()}${value.slice(1)}`;
}

function singularize(value: string): string {
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

function buildPrismaInclude(resource: AdminAdapterResource): Record<string, true> | undefined {
  const relationNames = resource.fields
    .filter((field) => field.relation?.kind === 'many-to-many')
    .map((field) => field.name);

  if (relationNames.length === 0) {
    return undefined;
  }

  return Object.fromEntries(relationNames.map((name) => [name, true]));
}

function normalizePrismaMutationData(
  resource: AdminAdapterResource,
  data: Record<string, unknown>,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const next = { ...data };

  for (const field of resource.fields) {
    if (field.relation?.kind !== 'many-to-many') {
      continue;
    }

    const rawValue = next[field.name];
    if (!Array.isArray(rawValue)) {
      continue;
    }

    const ids = rawValue.map((value) => ({ id: coerceId(String(value)) }));
    next[field.name] =
      mode === 'create'
        ? { connect: ids }
        : {
            set: ids,
          };
  }

  return next;
}
