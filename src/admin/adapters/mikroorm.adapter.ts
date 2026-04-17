import { Collection, EntityManager, QueryOrder, wrap, type EntityMetadata } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminEntity,
  AdminListQuery,
  AdminSearchField,
} from '../types/admin.types.js';

@Injectable()
export class MikroOrmAdminAdapter implements AdminAdapter {
  constructor(private readonly entityManager: EntityManager) {}

  async findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ) {
    const em = this.forkEntityManager();
    const target = this.resolveTarget(resource, em) as never;
    const where = await this.buildWhereClause(resource, query, em);
    const [items, total] = await em.findAndCount(target, where, {
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      orderBy: query.sort
        ? { [query.sort]: query.order === 'desc' ? QueryOrder.DESC : QueryOrder.ASC }
        : undefined,
      populate: this.getPopulatePaths(resource),
    } as never);

    return {
      items: items.map((item) => this.toPlainEntity(item) as TModel),
      total,
    };
  }

  async findOne<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const em = this.forkEntityManager();
    const target = this.resolveTarget(resource, em) as never;
    const entity = await em.findOne(target, { id: this.coercePrimaryKey(this.getMetadata(resource, em), id) } as never, {
      populate: this.getPopulatePaths(resource),
    } as never);

    return entity ? (this.toPlainEntity(entity) as TModel) : null;
  }

  async create<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
  ) {
    const em = this.forkEntityManager();
    const target = this.resolveTarget(resource, em) as never;
    const { scalarData, manyToManyData } = this.splitMutationData(resource, data);
    const entity = em.create(target, scalarData as never);

    await this.applyManyToManyAssignments(resource, entity, manyToManyData, em);
    em.persist(entity);
    await em.flush();

    return (await this.findOne(
      resource,
      String(wrap(entity, true).getPrimaryKey()),
    )) as TModel;
  }

  async update<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
    data: Partial<TModel>,
  ) {
    const em = this.forkEntityManager();
    const target = this.resolveTarget(resource, em) as never;
    const entity = await em.findOneOrFail(
      target,
      { id: this.coercePrimaryKey(this.getMetadata(resource, em), id) } as never,
      { populate: this.getPopulatePaths(resource) } as never,
    );
    const { scalarData, manyToManyData } = this.splitMutationData(resource, data);

    em.assign(entity, scalarData as never);
    await this.applyManyToManyAssignments(resource, entity, manyToManyData, em);
    await em.flush();

    return (await this.findOne(resource, id)) as TModel;
  }

  async delete<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const em = this.forkEntityManager();
    const target = this.resolveTarget(resource, em) as never;
    const entityId = this.coercePrimaryKey(this.getMetadata(resource, em), id);

    if (resource.softDelete) {
      await em.nativeUpdate(
        target,
        { id: entityId } as never,
        { [resource.softDelete.fieldName]: new Date() } as never,
      );
      return;
    }

    const entity = await em.findOne(target, { id: entityId } as never, {
      populate: this.getPopulatePaths(resource),
    } as never);

    if (!entity) {
      return;
    }

    em.remove(entity);
    await em.flush();
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
    const em = this.forkEntityManager();
    const target = this.resolveTarget(resource, em) as never;
    const rows = await em.find(
      target,
      resource.softDelete
        ? {
            [resource.softDelete.fieldName]: null,
          }
        : {},
      {
        disableIdentityMap: true,
        fields: [field] as never,
      } as never,
    );

    return [...new Set(
      rows
        .map((row) => (this.toPlainEntity(row) as Record<string, string | number>)[field])
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number'),
    )];
  }

  private forkEntityManager(): EntityManager {
    const em = this.entityManager as EntityManager & {
      fork?: (options?: { clear?: boolean }) => EntityManager;
    };

    return typeof em.fork === 'function' ? em.fork({ clear: true }) : em;
  }

  private async buildWhereClause(
    resource: AdminAdapterResource,
    query: AdminListQuery,
    em: EntityManager,
  ): Promise<Record<string, unknown>> {
    const clauses: Array<Record<string, unknown>> = [];
    const softDeleteFieldName = resource.softDelete?.fieldName;
    const softDeleteFilterField = resource.softDelete?.filterField;
    const softDeleteState = softDeleteFilterField ? query.filters?.[softDeleteFilterField] : undefined;

    if (softDeleteFieldName) {
      if (softDeleteState === 'deleted') {
        clauses.push({
          [softDeleteFieldName]: {
            $ne: null,
          },
        });
      } else if (softDeleteState !== 'all') {
        clauses.push({
          [softDeleteFieldName]: null,
        });
      }
    }

    for (const [field, value] of Object.entries(query.filters ?? {})) {
      if (field === softDeleteFilterField) {
        continue;
      }

      const relationField = resource.fields.find((candidate) => candidate.name === field);
      if (relationField?.relation?.kind === 'many-to-many') {
        const valueField = relationField.relation.option.valueField ?? 'id';
        clauses.push(
          Array.isArray(value)
            ? {
                [field]: {
                  [valueField]: {
                    $in: value,
                  },
                },
              }
            : {
                [field]: {
                  [valueField]: value,
                },
              },
        );
        continue;
      }

      clauses.push(
        Array.isArray(value)
          ? {
              [field]: {
                $in: value,
              },
            }
          : {
              [field]: value,
            },
      );
    }

    if (query.search && resource.search.length > 0) {
      clauses.push({
        $or: await Promise.all(
          resource.search.map((field) => this.buildSearchClause(field, query.search!, em)),
        ),
      });
    }

    if (clauses.length === 0) {
      return {};
    }

    if (clauses.length === 1) {
      return clauses[0]!;
    }

    return { $and: clauses };
  }

  private async buildSearchClause(
    field: AdminSearchField,
    search: string,
    em: EntityManager,
  ): Promise<Record<string, unknown>> {
    const operator = em.getDriver().constructor.name.toLowerCase().includes('postgres') ? '$ilike' : '$like';
    const pattern = `%${search}%`;

    if (field.kind === 'field') {
      return {
        [field.path]: {
          [operator]: pattern,
        },
      };
    }

    if (field.relationKind === 'many-to-many') {
      return {
        [field.relationField]: {
          [field.targetField]: {
            [operator]: pattern,
          },
        },
      };
    }

    const relatedMeta = this.getMetadataByResourceName(field.relationResource, em);
    const relatedRows = await em.find(
      relatedMeta.className as never,
      {
        [field.targetField]: {
          [operator]: pattern,
        },
      } as never,
      {
        disableIdentityMap: true,
        fields: [field.valueField] as never,
      } as never,
    );
    const ids = relatedRows
      .map((row) => (this.toPlainEntity(row) as Record<string, unknown>)[field.valueField])
      .filter((value): value is string | number => value !== null && value !== undefined);

    return {
      [field.relationField]: {
        $in: ids,
      },
    };
  }

  private splitMutationData<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
  ): {
    scalarData: Record<string, unknown>;
    manyToManyData: Map<string, unknown[]>;
  } {
    const scalarData = Object.fromEntries(
      Object.entries(data as Record<string, unknown>).filter(([, value]) => value !== undefined),
    );
    const manyToManyData = new Map<string, unknown[]>();

    for (const field of resource.fields) {
      if (field.relation?.kind !== 'many-to-many') {
        continue;
      }

      const rawValue = scalarData[field.name];
      if (!Array.isArray(rawValue)) {
        continue;
      }

      manyToManyData.set(field.name, rawValue);
      delete scalarData[field.name];
    }

    return { scalarData, manyToManyData };
  }

  private async applyManyToManyAssignments(
    resource: AdminAdapterResource,
    entity: object,
    manyToManyData: Map<string, unknown[]>,
    em: EntityManager,
  ): Promise<void> {
    if (manyToManyData.size === 0) {
      return;
    }

    const meta = this.getMetadata(resource, em);

    for (const [fieldName, values] of manyToManyData) {
      const property = meta.properties[fieldName];
      if (!property?.targetMeta) {
        continue;
      }

      const references = values.map((value) =>
        em.getReference(
          property.targetMeta!.className as never,
          this.coercePrimaryKey(property.targetMeta!, String(value)),
        ),
      );
      const collection = (entity as Record<string, unknown>)[fieldName];

      if (Collection.isCollection(collection)) {
        collection.set(references);
      }
    }
  }

  private toPlainEntity(entity: object): Record<string, unknown> {
    return wrap(entity).toObject() as Record<string, unknown>;
  }

  private getPopulatePaths(resource: AdminAdapterResource): string[] {
    return resource.fields
      .filter((field) => field.relation?.kind === 'many-to-many')
      .map((field) => field.name);
  }

  private resolveTarget(resource: AdminAdapterResource, em: EntityManager): string | object {
    return resource.model ?? this.getMetadata(resource, em).className;
  }

  private getMetadata(resource: AdminAdapterResource, em: EntityManager): EntityMetadata {
    if (resource.model) {
      return em.getMetadata().get(resource.model);
    }

    const metadata = this.getMetadataByResourceName(resource.resourceName, em);
    if (!metadata) {
      throw new Error(`MikroORM entity metadata not found for admin resource "${resource.resourceName}"`);
    }

    return metadata;
  }

  private getMetadataByResourceName(resourceName: string, em: EntityManager): EntityMetadata {
    for (const metadata of em.getMetadata()) {
      if (
        metadata.tableName === resourceName ||
        metadata.collection === resourceName ||
        metadata.className === resourceName ||
        metadata.className.toLowerCase() === resourceName ||
        this.toPlural(metadata.className.toLowerCase()) === resourceName
      ) {
        return metadata;
      }
    }

    throw new Error(`MikroORM entity metadata not found for related admin resource "${resourceName}"`);
  }

  private coercePrimaryKey(metadata: EntityMetadata, value: string): string | number {
    const primary = metadata.getPrimaryProp();
    return primary.runtimeType === 'number' && /^\d+$/.test(value) ? Number(value) : value;
  }

  private toPlural(value: string): string {
    return value.endsWith('s') ? value : `${value}s`;
  }
}
