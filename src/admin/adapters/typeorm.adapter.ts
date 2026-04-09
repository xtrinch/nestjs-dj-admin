import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import type { AdminAdapter, AdminAdapterResource, AdminListQuery } from '../types/admin.types.js';

@Injectable()
export class TypeOrmAdminAdapter implements AdminAdapter {
  constructor(private readonly dataSource: DataSource) {}

  async findMany(resource: AdminAdapterResource, query: AdminListQuery) {
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

    return { items, total };
  }

  async findOne(resource: AdminAdapterResource, id: string) {
    const repository = this.getRepository(resource);
    return repository.findOne({ where: { id: this.coerceId(repository, id) } as never });
  }

  async create(resource: AdminAdapterResource, data: Record<string, unknown>) {
    const repository = this.getRepository(resource);
    const entity = repository.create(data);
    return repository.save(entity);
  }

  async update(resource: AdminAdapterResource, id: string, data: Record<string, unknown>) {
    const repository = this.getRepository(resource);
    const entityId = this.coerceId(repository, id);
    await repository.update({ id: entityId } as never, data as never);
    return repository.findOneByOrFail({ id: entityId } as never);
  }

  async delete(resource: AdminAdapterResource, id: string) {
    const repository = this.getRepository(resource);
    await repository.delete({ id: this.coerceId(repository, id) } as never);
  }

  async distinct(resource: AdminAdapterResource, field: string) {
    const repository = this.getRepository(resource);
    const alias = 'entity';
    const rows = await repository
      .createQueryBuilder(alias)
      .select(`${alias}.${field}`, field)
      .distinct(true)
      .getRawMany<Record<string, string | number>>();
    return rows.map((row) => row[field]);
  }

  private getRepository(resource: AdminAdapterResource): Repository<ObjectLiteral> {
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
}
