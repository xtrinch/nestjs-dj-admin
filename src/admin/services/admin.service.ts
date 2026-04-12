import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ADMIN_ADAPTER } from '../admin.constants.js';
import { AdminRegistry } from '../admin.registry.js';
import type {
  AdminAdapter,
  AdminAdapterResource,
  AdminDeleteSummary,
  AdminListQuery,
  AdminRequestUser,
  AdminResourceSchema,
} from '../types/admin.types.js';
import { AdminPermissionService } from './admin-permission.service.js';

@Injectable()
export class AdminService implements OnModuleInit {
  private adapter!: AdminAdapter;

  constructor(
    private readonly registry: AdminRegistry,
    private readonly permissionService: AdminPermissionService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    const adapter = this.moduleRef.get<AdminAdapter>(ADMIN_ADAPTER, {
      strict: false,
    });

    if (!adapter) {
      throw new Error('Admin adapter provider was not found');
    }

    this.adapter = adapter;
    this.registry.initialize();
  }

  getResources(): AdminResourceSchema[] {
    return this.registry.getAll();
  }

  getResourceSchema(resourceName: string, user: AdminRequestUser): AdminResourceSchema {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);
    return resource.schema;
  }

  async list(resourceName: string, query: AdminListQuery, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);
    const resolvedSort = query.sort && resource.schema.sortable.includes(query.sort)
      ? query.sort
      : resource.schema.defaultSort?.field;

    return this.adapter.findMany(this.toAdapterResource(resource), {
      ...query,
      sort: resolvedSort,
      order:
        resolvedSort === query.sort
          ? query.order
          : resource.schema.defaultSort?.order ?? query.order,
    });
  }

  async detail(resourceName: string, id: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);
    const entity = await this.adapter.findOne(this.toAdapterResource(resource), id);

    if (!entity) {
      throw new NotFoundException(`${resource.schema.label} "${id}" not found`);
    }

    return entity;
  }

  async create(resourceName: string, payload: Record<string, unknown>, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const data = await this.validateDto(resource.options.createDto, payload);
    return this.adapter.create(this.toAdapterResource(resource), data);
  }

  async update(
    resourceName: string,
    id: string,
    payload: Record<string, unknown>,
    user: AdminRequestUser,
  ) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const data = await this.validateDto(resource.options.updateDto, payload);
    return this.adapter.update(this.toAdapterResource(resource), id, data);
  }

  async remove(resourceName: string, id: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    await this.adapter.delete(this.toAdapterResource(resource), id);
    return { success: true };
  }

  async getDeleteSummary(resourceName: string, ids: string[], user: AdminRequestUser): Promise<AdminDeleteSummary> {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);

    const items = await Promise.all(
      ids.map(async (id) => {
        const entity = await this.adapter.findOne(this.toAdapterResource(resource), id);

        if (!entity) {
          throw new NotFoundException(`${resource.schema.label} "${id}" not found`);
        }

        return {
          id: String((entity as Record<string, unknown>).id ?? id),
          label: this.resolveEntityLabel(resource.schema, entity as Record<string, unknown>, id),
        };
      }),
    );

    return {
      resourceName,
      label: resource.schema.label,
      count: items.length,
      items,
    };
  }

  async bulkRemove(resourceName: string, ids: string[], user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);

    await Promise.all(
      ids.map((id) => this.adapter.delete(this.toAdapterResource(resource), id)),
    );

    return {
      success: true,
      count: ids.length,
    };
  }

  async runAction(resourceName: string, id: string, actionSlug: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const entity = await this.detail(resourceName, id, user);
    const action = (resource.options.actions ?? []).find(
      (item) => (item.slug ?? item.name.trim().toLowerCase().replace(/\s+/g, '-')) === actionSlug,
    );

    if (!action) {
      throw new NotFoundException(`Unknown action "${actionSlug}" for ${resourceName}`);
    }

    const adapterResource = this.toAdapterResource(resource);
    const result = await action.handler(entity, {
      adapter: this.adapter,
      resourceName,
      resource: adapterResource,
      user,
    });

    return {
      success: true,
      entity: result ?? (await this.detail(resourceName, id, user)),
    };
  }

  async getFilterOptions(resourceName: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);
    const filters = resource.schema.filters;

    const options = await Promise.all(
      filters.map(async (field) => ({
        field,
        values: (await this.adapter.distinct?.(this.toAdapterResource(resource), field)) ?? [],
      })),
    );

    return options;
  }

  private async validateDto(
    dtoClass: Function | undefined,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!dtoClass) {
      return payload;
    }

    const dtoInstance = plainToInstance(dtoClass as never, payload, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dtoInstance as object);

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errors.map((error) => ({
          field: error.property,
          constraints: error.constraints,
        })),
      });
    }

    return dtoInstance as Record<string, unknown>;
  }

  private toAdapterResource(resource: {
    schema: AdminResourceSchema;
    options: { model: AdminAdapterResource['model'] };
  }): AdminAdapterResource {
    return {
      resourceName: resource.schema.resourceName,
      label: resource.schema.label,
      model: resource.options.model,
      search: resource.schema.search,
      filters: resource.schema.filters,
      fields: resource.schema.fields,
    };
  }

  private resolveEntityLabel(
    schema: AdminResourceSchema,
    entity: Record<string, unknown>,
    fallback: string,
  ): string {
    const candidates = [
      ...(schema.objectLabel ? [schema.objectLabel] : []),
      'email',
      'name',
      'title',
      'number',
      'sku',
      'slug',
      ...schema.listDisplayLinks.filter((field) => field !== 'id'),
      ...schema.list.filter((field) => field !== 'id'),
      'id',
    ];

    for (const field of candidates) {
      const value = entity[field];

      if (typeof value === 'string' && value.trim()) {
        return value;
      }

      if (typeof value === 'number') {
        return String(value);
      }
    }

    return fallback;
  }
}
