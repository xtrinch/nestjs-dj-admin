import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminEntity,
  AdminFieldSchema,
  AdminListQuery,
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

    for (const [field, value] of Object.entries(query.filters ?? {})) {
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
            searchQuery.orWhere(`${alias}.${field} ${operator} :search`, {
              search: `%${query.search}%`,
            });
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
    await repository.delete({ id: this.coerceId(repository, id) } as never);
  }

  async distinct<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, field: string) {
    const repository = this.getRepository(resource);
    const alias = 'entity';
    const rows = await repository
      .createQueryBuilder(alias)
      .select(`${alias}.${field}`, field)
      .distinct(true)
      .getRawMany<Record<string, string | number>>();
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

  private getRelationNames(resource: AdminAdapterResource): string[] {
    return resource.fields
      .filter((field) => field.relation?.kind === 'many-to-many')
      .map((field) => field.name);
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
