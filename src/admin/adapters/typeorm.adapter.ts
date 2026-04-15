import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminEntity,
  AdminListQuery,
  AdminSearchField,
} from '../types/admin.types.js';

@Injectable()
export class TypeOrmAdminAdapter implements AdminAdapter {
  constructor(private readonly dataSource: DataSource) {}

  async findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ) {
    const repository = this.getRepository(resource);
    const alias = 'entity';
    const builder = repository.createQueryBuilder(alias);
    const softDeleteFieldName = resource.softDelete?.fieldName;
    const softDeleteFilterField = resource.softDelete?.filterField;

    if (softDeleteFieldName) {
      const softDeleteState = softDeleteFilterField
        ? query.filters?.[softDeleteFilterField]
        : undefined;
      if (softDeleteState === 'deleted') {
        builder.andWhere(`${alias}.${softDeleteFieldName} IS NOT NULL`);
      } else if (softDeleteState !== 'all') {
        builder.andWhere(`${alias}.${softDeleteFieldName} IS NULL`);
      }
    }

    for (const [field, value] of Object.entries(query.filters ?? {})) {
      if (field === softDeleteFilterField) {
        continue;
      }

      if (Array.isArray(value)) {
        builder.andWhere(`${alias}.${field} IN (:...${field})`, { [field]: value });
      } else {
        builder.andWhere(`${alias}.${field} = :${field}`, { [field]: value });
      }
    }

    if (query.search && resource.search.length > 0) {
      const operator = this.dataSource.options.type === 'postgres' ? 'ILIKE' : 'LIKE';
      builder.andWhere(
        new Brackets((searchQuery) => {
          for (const field of resource.search) {
            if (field.kind === 'field') {
              searchQuery.orWhere(`${this.buildSearchExpression(repository, alias, field.path)} ${operator} :search`, {
                search: `%${query.search}%`,
              });
              continue;
            }

            if (field.relationKind === 'many-to-many') {
              const relation = repository.metadata.findRelationWithPropertyPath(field.relationField);
              if (!relation) {
                continue;
              }

              const relationAlias = `${field.relationField}_search`;
              const alreadyJoined = builder.expressionMap.joinAttributes.some(
                (join) => join.alias.name === relationAlias,
              );
              if (!alreadyJoined) {
                builder.leftJoin(`${alias}.${relation.propertyPath}`, relationAlias);
              }

              searchQuery.orWhere(
                `${this.buildRawSearchExpression(relationAlias, field.targetField)} ${operator} :search`,
                { search: `%${query.search}%` },
              );
              continue;
            }

            const relatedRepository = this.getRepositoryByResourceName(field.relationResource);
            const relatedAlias = `${field.relationField}_related_search`;
            const relatedValueColumn = this.getColumnPath(relatedRepository, relatedAlias, field.valueField);
            const relatedTargetColumn = this.buildSearchExpression(
              relatedRepository,
              relatedAlias,
              field.targetField,
            );

            searchQuery.orWhere(
              `${alias}.${field.relationField} IN ${relatedRepository
                .createQueryBuilder(relatedAlias)
                .select(relatedValueColumn)
                .where(`${relatedTargetColumn} ${operator} :search`)
                .getQuery()}`,
              { search: `%${query.search}%` },
            );
          }
        }),
      );
    }

    if (query.sort) {
      builder.orderBy(
        `${alias}.${query.sort}`,
        (query.order ?? 'asc').toUpperCase() as 'ASC' | 'DESC',
      );
    }

    builder.skip((query.page - 1) * query.pageSize).take(query.pageSize);

    const [items, total] = await builder.getManyAndCount();

    return { items: items as TModel[], total };
  }

  async findOne<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const repository = this.getRepository(resource);
    return (await repository.findOne({
      relations: this.getRelationNames(resource),
      where: { id: this.coerceId(repository, id) } as never,
    })) as TModel | null;
  }

  async create<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
  ) {
    const repository = this.getRepository(resource);
    const entity = repository.create(this.normalizeMutationData(resource, data, repository) as never);
    return (await repository.save(entity)) as TModel;
  }

  async update<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
    data: Partial<TModel>,
  ) {
    const repository = this.getRepository(resource);
    const entityId = this.coerceId(repository, id);
    const existing = await repository.findOneOrFail({
      relations: this.getRelationNames(resource),
      where: { id: entityId } as never,
    });
    const merged = repository.merge(
      existing,
      this.normalizeMutationData(resource, data, repository) as never,
    );
    return (await repository.save(merged)) as TModel;
  }

  async delete<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string) {
    const repository = this.getRepository(resource);
    if (resource.softDelete) {
      await repository.update(
        { id: this.coerceId(repository, id) } as never,
        { [resource.softDelete.fieldName]: new Date() } as never,
      );
      return;
    }

    const entity = await repository.findOne({
      relations: this.getDeleteRelationNames(repository),
      where: { id: this.coerceId(repository, id) } as never,
    });

    if (!entity) {
      return;
    }

    await repository.remove(entity);
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
    const repository = this.getRepository(resource);
    const alias = 'entity';
    const builder = repository
      .createQueryBuilder(alias)
      .select(`${alias}.${field}`, field)
      .distinct(true);

    if (resource.softDelete) {
      builder.where(`${alias}.${resource.softDelete.fieldName} IS NULL`);
    }

    const rows = await builder.getRawMany<Record<string, string | number>>();
    return rows.map((row) => row[field]);
  }

  private getRepository<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
  ): Repository<ObjectLiteral> {
    const target = resource.model ?? this.resolveTarget(resource);
    return this.dataSource.getRepository(target as never);
  }

  private coerceId(repository: Repository<ObjectLiteral>, value: string): string | number {
    const idColumn = repository.metadata.findColumnWithPropertyName('id');
    return idColumn?.type === Number ? Number(value) : value;
  }

  private resolveTarget(resource: AdminAdapterResource): ObjectLiteral | string {
    const metadata = this.dataSource.entityMetadatas.find(
      (entity) =>
        entity.targetName === resource.label ||
        entity.name === resource.label ||
        entity.tableName === resource.resourceName,
    );

    if (!metadata) {
      throw new Error(
        `TypeORM entity metadata not found for admin resource "${resource.resourceName}"`,
      );
    }

    return (metadata.target as ObjectLiteral | undefined) ?? metadata.name;
  }

  private getRepositoryByResourceName(resourceName: string): Repository<ObjectLiteral> {
    const metadata = this.dataSource.entityMetadatas.find(
      (entity) => entity.tableName === resourceName || entity.tablePath === resourceName,
    );

    if (!metadata) {
      throw new Error(`TypeORM entity metadata not found for related admin resource "${resourceName}"`);
    }

    return this.dataSource.getRepository((metadata.target as never) ?? metadata.name);
  }

  private getRelationNames(resource: AdminAdapterResource): string[] {
    return resource.fields
      .filter((field) => field.relation?.kind === 'many-to-many')
      .map((field) => field.name);
  }

  private getDeleteRelationNames(repository: Repository<ObjectLiteral>): string[] {
    return repository.metadata.relations
      .filter((relation) => relation.isManyToMany)
      .map((relation) => relation.propertyName);
  }

  private buildSearchExpression(
    repository: Repository<ObjectLiteral>,
    alias: string,
    field: string,
  ): string {
    const columnPath = this.getColumnPath(repository, alias, field);

    if (this.dataSource.options.type === 'postgres') {
      return `CAST(${columnPath} AS TEXT)`;
    }

    return columnPath;
  }

  private buildRawSearchExpression(alias: string, field: string): string {
    if (this.dataSource.options.type === 'postgres') {
      return `CAST(${alias}.${field} AS TEXT)`;
    }

    return `${alias}.${field}`;
  }

  private getColumnPath(
    repository: Repository<ObjectLiteral>,
    alias: string,
    field: string,
  ): string {
    const column = repository.metadata.findColumnWithPropertyName(field);
    return column ? `${alias}.${column.propertyPath}` : `${alias}.${field}`;
  }

  private normalizeMutationData<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
    repository: Repository<ObjectLiteral>,
  ): Record<string, unknown> {
    const next = { ...(data as Record<string, unknown>) };

    for (const field of resource.fields) {
      if (field.relation?.kind !== 'many-to-many') {
        continue;
      }

      const rawValue = next[field.name];
      if (!Array.isArray(rawValue)) {
        continue;
      }

      const relation = repository.metadata.findRelationWithPropertyPath(field.name);
      const relatedRepository = relation
        ? this.dataSource.getRepository(relation.inverseEntityMetadata.target as never)
        : null;
      const relatedIdColumn = relatedRepository?.metadata.findColumnWithPropertyName('id');

      next[field.name] = rawValue.map((value) => ({
        id: relatedIdColumn?.type === Number && /^\d+$/.test(String(value))
          ? Number(value)
          : value,
      }));
    }

    return next;
  }
}
