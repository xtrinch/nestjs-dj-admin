import {
  BadRequestException,
  ConflictException,
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
  AdminAuditAction,
  AdminDeleteImpactGroup,
  AdminPasswordOptions,
  AdminDeleteSummary,
  AdminDeleteSummaryItem,
  AdminLookupResult,
  AdminListQuery,
  AdminRequestUser,
  AdminResourceSchema,
  AdminWriteTransform,
} from '../types/admin.types.js';
import { AdminAuditService } from './admin-audit.service.js';
import { AdminPermissionService } from './admin-permission.service.js';

@Injectable()
export class AdminService implements OnModuleInit {
  private adapter!: AdminAdapter;

  constructor(
    private readonly registry: AdminRegistry,
    private readonly permissionService: AdminPermissionService,
    private readonly moduleRef: ModuleRef,
    private readonly auditService: AdminAuditService,
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
    const normalizedFilters = this.normalizeSoftDeleteFilters(resource.schema, query.filters);
    const resolvedSort = query.sort && resource.schema.sortable.includes(query.sort)
      ? query.sort
      : resource.schema.defaultSort?.field;

    const result = await this.adapter.findMany(this.toAdapterResource(resource), {
      ...query,
      filters: normalizedFilters,
      sort: resolvedSort,
      order:
        resolvedSort === query.sort
          ? query.order
          : resource.schema.defaultSort?.order ?? query.order,
    });

    return {
      ...result,
      items: result.items.map((item) => this.serializeEntity(resource.schema, item as Record<string, unknown>)),
    };
  }

  async detail(resourceName: string, id: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);
    const entity = await this.adapter.findOne(this.toAdapterResource(resource), id);

    if (!entity) {
      throw new NotFoundException(`${resource.schema.label} "${id}" not found`);
    }

    return this.serializeEntity(resource.schema, entity as Record<string, unknown>);
  }

  async create(resourceName: string, payload: Record<string, unknown>, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const data = await this.prepareMutationPayload(
      resource.options.createDto,
      resource.options.transformCreate,
      payload,
      {
        operation: 'create',
        resourceName,
        resource: this.toAdapterResource(resource),
        user,
      },
    );
    const created = await this.executeMutation(
      resource.schema,
      () => this.adapter.create(this.toAdapterResource(resource), data),
    );
    await this.recordEntityAudit(resource.schema, created as Record<string, unknown>, 'create', user);
    return this.serializeEntity(resource.schema, created as Record<string, unknown>);
  }

  async update(
    resourceName: string,
    id: string,
    payload: Record<string, unknown>,
    user: AdminRequestUser,
  ) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const data = await this.prepareMutationPayload(
      resource.options.updateDto,
      resource.options.transformUpdate,
      payload,
      {
        operation: 'update',
        resourceName,
        resource: this.toAdapterResource(resource),
        user,
        id,
      },
    );
    const updated = await this.executeMutation(
      resource.schema,
      () => this.adapter.update(this.toAdapterResource(resource), id, data),
    );
    await this.recordEntityAudit(resource.schema, updated as Record<string, unknown>, 'update', user, id);
    return this.serializeEntity(resource.schema, updated as Record<string, unknown>);
  }

  async changePassword(
    resourceName: string,
    id: string,
    payload: Record<string, unknown>,
    user: AdminRequestUser,
  ) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);

    if (!resource.options.password) {
      throw new NotFoundException(`Password change is not configured for ${resourceName}`);
    }

    await this.detail(resourceName, id, user);
    const data = await this.applyPasswordTransform({}, resource.options.password, payload, true);
    const updated = await this.executeMutation(
      resource.schema,
      () => this.adapter.update(this.toAdapterResource(resource), id, data),
    );
    await this.recordEntityAudit(resource.schema, updated as Record<string, unknown>, 'password-change', user, id);
    return this.serializeEntity(resource.schema, updated as Record<string, unknown>);
  }

  async remove(resourceName: string, id: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const entity = await this.adapter.findOne(this.toAdapterResource(resource), id);
    if (!entity) {
      throw new NotFoundException(`${resource.schema.label} "${id}" not found`);
    }
    await this.adapter.delete(this.toAdapterResource(resource), id);
    await this.recordEntityAudit(
      resource.schema,
      entity as Record<string, unknown>,
      resource.schema.softDelete?.enabled ? 'soft-delete' : 'delete',
      user,
      id,
    );
    return { success: true };
  }

  async getDeleteSummary(resourceName: string, ids: string[], user: AdminRequestUser): Promise<AdminDeleteSummary> {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);

    const records = await Promise.all(
      ids.map(async (id) => {
        const entity = await this.adapter.findOne(this.toAdapterResource(resource), id);

        if (!entity) {
          throw new NotFoundException(`${resource.schema.label} "${id}" not found`);
        }

        return {
          entity: entity as Record<string, unknown>,
          id: String((entity as Record<string, unknown>).id ?? id),
          label: this.resolveEntityLabel(resource.schema, entity as Record<string, unknown>, id),
        };
      }),
    );

    const items = records.map(({ id, label }) => ({ id, label }));
    if (resource.schema.softDelete?.enabled) {
      return {
        resourceName,
        label: resource.schema.label,
        count: items.length,
        mode: 'soft-delete',
        items,
        related: [],
        impact: {
          delete: [],
          disconnect: [],
          blocked: [],
        },
      };
    }
    const related = await this.buildDeleteRelatedSummary(resource.schema, records.map((record) => record.entity));
    const impact = await this.buildDeleteImpact(resource.schema.resourceName, resource.schema.label, items);

    return {
      resourceName,
      label: resource.schema.label,
      count: items.length,
      mode: 'delete',
      items,
      related,
      impact,
    };
  }

  async bulkRemove(resourceName: string, ids: string[], user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const entities = await Promise.all(
      ids.map((id) => this.adapter.findOne(this.toAdapterResource(resource), id)),
    );

    await Promise.all(
      ids.map((id) => this.adapter.delete(this.toAdapterResource(resource), id)),
    );

    const labels = entities
      .map((entity, index) => {
        if (!entity) {
          return ids[index];
        }

        return this.resolveEntityLabel(resource.schema, entity as Record<string, unknown>, ids[index]);
      })
      .join(', ');

    await this.auditService.record({
      action: resource.schema.softDelete?.enabled ? 'soft-delete' : 'delete',
      actor: user,
      summary:
        ids.length === 1
          ? `${resource.schema.softDelete?.enabled ? 'Archived' : 'Deleted'} ${labels}`
          : `${resource.schema.softDelete?.enabled ? 'Archived' : 'Deleted'} ${ids.length} ${resource.schema.label} items`,
      resourceName,
      resourceLabel: resource.schema.label,
      objectLabel: ids.length === 1 ? labels : undefined,
      count: ids.length,
    });

    return {
      success: true,
      count: ids.length,
    };
  }

  async runBulkAction(resourceName: string, ids: string[], actionSlug: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanWrite(user, resource.schema);
    const action = (resource.options.bulkActions ?? []).find(
      (item) => (item.slug ?? item.name.trim().toLowerCase().replace(/\s+/g, '-')) === actionSlug,
    );

    if (!action) {
      throw new NotFoundException(`Unknown bulk action "${actionSlug}" for ${resourceName}`);
    }

    const adapterResource = this.toAdapterResource(resource);
    await action.handler(ids, {
      adapter: this.adapter,
      resourceName,
      resource: adapterResource,
      user,
      ids,
    });
    await this.auditService.record({
      action: 'bulk-action',
      actor: user,
      summary:
        ids.length === 1
          ? `Ran ${action.name} on 1 ${resource.schema.label}`
          : `Ran ${action.name} on ${ids.length} ${resource.schema.label} items`,
      resourceName,
      resourceLabel: resource.schema.label,
      actionLabel: action.name,
      count: ids.length,
    });

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
    const resultEntity =
      result && typeof result === 'object'
        ? (result as Record<string, unknown>)
        : (entity as Record<string, unknown>);
    await this.auditService.record({
      action: 'action',
      actor: user,
      summary: `Ran ${action.name} on ${this.resolveEntityLabel(resource.schema, resultEntity, id)}`,
      resourceName,
      resourceLabel: resource.schema.label,
      objectId: String(resultEntity.id ?? id),
      objectLabel: this.resolveEntityLabel(resource.schema, resultEntity, id),
      actionLabel: action.name,
    });

    return {
      success: true,
      entity:
        result && typeof result === 'object'
          ? this.serializeEntity(resource.schema, result as Record<string, unknown>)
          : await this.detail(resourceName, id, user),
    };
  }

  async getFilterOptions(resourceName: string, user: AdminRequestUser) {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);
    const filters = resource.schema.filters;

    const options = await Promise.all(
      filters.map(async (field) => {
        const fieldSchema = resource.schema.fields.find((candidate) => candidate.name === field);

        return {
          field,
          values: fieldSchema?.relation
            ? []
            : (await this.adapter.distinct?.(this.toAdapterResource(resource), field)) ?? [],
        };
      }),
    );

    if (resource.schema.softDelete?.enabled) {
      options.push({
        field: resource.schema.softDelete.filterField,
        values: ['active', 'deleted', 'all'],
      });
    }

    return options;
  }

  async lookup(
    resourceName: string,
    query: {
      q?: string;
      ids?: string[];
      page: number;
      pageSize: number;
    },
    user: AdminRequestUser,
  ): Promise<AdminLookupResult> {
    const resource = this.registry.get(resourceName);
    this.permissionService.assertCanRead(user, resource.schema);

    if (query.ids && query.ids.length > 0 && !query.q) {
      const entities = await Promise.all(
        query.ids.map((id) => this.adapter.findOne(this.toAdapterResource(resource), id)),
      );
      const items = entities
        .map((entity, index) => {
          if (!entity) {
            return null;
          }

          return {
            value: String((entity as Record<string, unknown>).id ?? query.ids?.[index] ?? ''),
            label: this.resolveEntityLabel(
              resource.schema,
              entity as Record<string, unknown>,
              query.ids?.[index] ?? '',
            ),
          };
        })
        .filter((item): item is { value: string; label: string } => item !== null);

      return {
        items,
        total: items.length,
      };
    }

    const result = await this.adapter.findMany(
      this.toAdapterResource(resource, this.resolveLookupSearchFields(resource.schema)),
      {
        page: query.page,
        pageSize: query.pageSize,
        search: query.q,
        filters: this.normalizeSoftDeleteFilters(resource.schema, undefined),
        order: 'asc',
      },
    );

    return {
      total: result.total,
      items: result.items.map((entity) => {
        const record = entity as Record<string, unknown>;
        return {
          value: String(record.id ?? ''),
          label: this.resolveEntityLabel(resource.schema, record, String(record.id ?? '')),
        };
      }),
    };
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

  private async prepareMutationPayload(
    dtoClass: Function | undefined,
    transform: AdminWriteTransform | undefined,
    payload: Record<string, unknown>,
    context: {
      operation: 'create' | 'update';
      resourceName: string;
      resource: AdminAdapterResource;
      user: AdminRequestUser;
      id?: string;
    },
  ): Promise<Record<string, unknown>> {
    const data = await this.validateDto(dtoClass, payload);
    if (!transform) {
      return data;
    }

    return transform(data, context);
  }

  private async executeMutation<T>(
    schema: AdminResourceSchema,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeWriteException(schema, error);
    }
  }

  private async applyPasswordTransform(
    data: Record<string, unknown>,
    passwordOptions: AdminPasswordOptions | undefined,
    rawPayload: Record<string, unknown>,
    requirePassword: boolean,
  ): Promise<Record<string, unknown>> {
    if (!passwordOptions) {
      return data;
    }

    const fieldName = passwordOptions.fieldName ?? 'password';
    const confirmFieldName = passwordOptions.confirmFieldName ?? 'passwordConfirm';
    const targetFieldName = passwordOptions.targetFieldName ?? 'passwordHash';
    const password = asString(rawPayload[fieldName]);
    const confirmation = asString(rawPayload[confirmFieldName]);
    const next = { ...data };

    delete next[fieldName];
    delete next[confirmFieldName];

    if (!password?.trim()) {
      if (requirePassword) {
        throw validationException(fieldName, 'Password is required');
      }

      return next;
    }

    if (password !== confirmation) {
      throw validationException(confirmFieldName, 'Passwords do not match');
    }

    next[targetFieldName] = await passwordOptions.hash(password);
    return next;
  }

  private toAdapterResource(resource: {
    schema: AdminResourceSchema;
    options: { model: AdminAdapterResource['model'] };
  }, searchFields?: string[]): AdminAdapterResource {
    return {
      resourceName: resource.schema.resourceName,
      label: resource.schema.label,
      model: resource.options.model,
      search: searchFields ?? resource.schema.search,
      filters: resource.schema.filters,
      fields: resource.schema.fields,
      softDelete: resource.schema.softDelete,
    };
  }

  private normalizeSoftDeleteFilters(
    schema: AdminResourceSchema,
    filters: AdminListQuery['filters'],
  ): AdminListQuery['filters'] {
    if (!schema.softDelete?.enabled) {
      return filters;
    }

    const next = { ...(filters ?? {}) };
    if (!next[schema.softDelete.filterField]) {
      next[schema.softDelete.filterField] = 'active';
    }

    return next;
  }

  private serializeEntity(
    schema: AdminResourceSchema,
    entity: Record<string, unknown>,
  ): Record<string, unknown> {
    const allowedFields = new Set<string>([
      'id',
      ...schema.fields.map((field) => field.name),
      ...schema.list,
      ...(schema.objectLabel ? [schema.objectLabel] : []),
    ]);

    return Object.fromEntries(
      Object.entries(entity).filter(([key]) => allowedFields.has(key)),
    );
  }

  private resolveLookupSearchFields(schema: AdminResourceSchema): string[] {
    const searchableFieldNames = new Set(
      schema.fields
        .filter((field) => ['text', 'email', 'select'].includes(field.input))
        .map((field) => field.name),
    );

    const candidates = [
      ...(schema.objectLabel ? [schema.objectLabel] : []),
      ...schema.search,
      ...schema.listDisplayLinks,
    ];

    const resolved = [...new Set(
      candidates.filter((field) => field && field !== 'id' && searchableFieldNames.has(field)),
    )];

    if (resolved.length > 0) {
      return resolved;
    }

    return schema.fields
      .filter((field) => field.name !== 'id' && ['text', 'email', 'select'].includes(field.input))
      .map((field) => field.name);
  }

  private async buildDeleteRelatedSummary(
    schema: AdminResourceSchema,
    entities: Array<Record<string, unknown>>,
  ) {
    const relationFields = schema.fields.filter((field) => field.relation?.kind === 'many-to-many');
    const related: AdminDeleteSummary['related'] = [];

    for (const field of relationFields) {
      const collectedIds = new Set<string>();

      for (const entity of entities) {
        const rawValue = entity[field.name];
        if (!Array.isArray(rawValue)) {
          continue;
        }

        for (const item of rawValue) {
          const relationId = this.resolveRelationValue(field.relation?.option.valueField, item);
          if (relationId) {
            collectedIds.add(relationId);
          }
        }
      }

      if (collectedIds.size === 0) {
        continue;
      }

      const items = await Promise.all(
        [...collectedIds].map(async (id) => this.lookupDeleteSummaryItem(field.relation!.option.resource, id)),
      );

      related.push({
        field: field.name,
        label: field.label,
        count: items.length,
        items: items.filter((item): item is AdminDeleteSummaryItem => item !== null),
      });
    }

    return related;
  }

  private async buildDeleteImpact(
    rootResourceName: string,
    rootLabel: string,
    roots: AdminDeleteSummaryItem[],
  ): Promise<AdminDeleteSummary['impact']> {
    const impact: AdminDeleteSummary['impact'] = {
      delete: [
        {
          resourceName: rootResourceName,
          label: rootLabel,
          count: roots.length,
          items: roots,
        },
      ],
      disconnect: [],
      blocked: [],
    };

    const rootIds = roots.map((item) => item.id);
    const groups = new Map<string, AdminDeleteImpactGroup>();

    for (const resource of this.registry.getAll()) {
      for (const field of resource.fields) {
        const relation = field.relation;
        if (!relation || relation.option.resource !== rootResourceName) {
          continue;
        }

        const linkedItems = await this.collectLinkedRecords(resource.resourceName, field.name, rootIds);
        if (linkedItems.length === 0) {
          continue;
        }

        const effect = relation.kind === 'many-to-many' ? 'disconnect' : 'blocked';
        const key = `${effect}:${resource.resourceName}:${field.name}`;
        const existing = groups.get(key);

        if (existing) {
          const merged = mergeSummaryItems(existing.items, linkedItems);
          existing.items = merged;
          existing.count = merged.length;
          continue;
        }

        groups.set(key, {
          resourceName: resource.resourceName,
          label: resource.label,
          count: linkedItems.length,
          items: linkedItems,
          via: field.label,
        });
      }
    }

    for (const [key, group] of groups.entries()) {
      if (key.startsWith('disconnect:')) {
        impact.disconnect.push(group);
      } else if (key.startsWith('blocked:')) {
        impact.blocked.push(group);
      }
    }

    return impact;
  }

  private async collectLinkedRecords(
    resourceName: string,
    fieldName: string,
    ids: string[],
  ): Promise<AdminDeleteSummaryItem[]> {
    const resource = this.registry.get(resourceName);
    const results = await Promise.all(
      ids.map((id) =>
        this.adapter.findMany(this.toAdapterResource(resource), {
          page: 1,
          pageSize: 100,
          filters: {
            [fieldName]: id,
          },
        }),
      ),
    );

    return mergeSummaryItems(
      [],
      results.flatMap((result) =>
        result.items.map((entity) => {
          const record = entity as Record<string, unknown>;

          return {
            id: String(record.id ?? ''),
            label: this.resolveEntityLabel(resource.schema, record, String(record.id ?? '')),
          };
        }),
      ),
    );
  }

  private async lookupDeleteSummaryItem(
    resourceName: string,
    id: string,
  ): Promise<AdminDeleteSummaryItem | null> {
    const resource = this.registry.get(resourceName);
    const entity = await this.adapter.findOne(this.toAdapterResource(resource), id);
    if (!entity) {
      return null;
    }

    return {
      id: String((entity as Record<string, unknown>).id ?? id),
      label: this.resolveEntityLabel(resource.schema, entity as Record<string, unknown>, id),
    };
  }

  private resolveRelationValue(valueField = 'id', rawValue: unknown): string | null {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    if (typeof rawValue === 'object') {
      const candidate = (rawValue as Record<string, unknown>)[valueField];
      if (candidate === null || candidate === undefined || candidate === '') {
        return null;
      }

      return String(candidate);
    }

    return String(rawValue);
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

  private async recordEntityAudit(
    schema: AdminResourceSchema,
    entity: Record<string, unknown>,
    action: Extract<AdminAuditAction, 'create' | 'update' | 'password-change' | 'delete' | 'soft-delete'>,
    user: AdminRequestUser,
    fallbackId?: string,
  ) {
    const objectId = String(entity.id ?? fallbackId ?? '');
    const objectLabel = this.resolveEntityLabel(schema, entity, fallbackId ?? objectId);
    const verb = {
      create: 'Created',
      update: 'Updated',
      'password-change': 'Changed password for',
      delete: 'Deleted',
      'soft-delete': 'Archived',
    }[action];

    await this.auditService.record({
      action,
      actor: user,
      summary: `${verb} ${objectLabel}`,
      resourceName: schema.resourceName,
      resourceLabel: schema.label,
      objectId,
      objectLabel,
    });
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validationException(field: string, message: string): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    errors: [
      {
        field,
        constraints: {
          custom: message,
        },
      },
    ],
  });
}

function normalizeWriteException(
  schema: AdminResourceSchema,
  error: unknown,
): Error {
  if (error instanceof BadRequestException || error instanceof NotFoundException) {
    return error;
  }

  const uniqueViolation = extractUniqueViolationFields(error, schema);
  if (uniqueViolation) {
    if (uniqueViolation.fields.length > 0) {
      return new BadRequestException({
        message: 'Validation failed',
        errors: uniqueViolation.fields.map((field) => ({
          field,
          constraints: {
            unique: `${schema.fields.find((candidate) => candidate.name === field)?.label ?? startCase(field)} must be unique`,
          },
        })),
      });
    }

    return new ConflictException({
      message: `${schema.label} already exists with that value.`,
    });
  }

  return error instanceof Error ? error : new Error('Unknown error');
}

function extractUniqueViolationFields(
  error: unknown,
  schema: AdminResourceSchema,
): { fields: string[] } | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {
    code?: string;
    message?: string;
    detail?: string;
    meta?: { target?: unknown };
  };

  if (candidate.code === 'P2002') {
    const target = candidate.meta?.target;
    const fields = Array.isArray(target)
      ? target.filter((value): value is string => typeof value === 'string')
      : [];

    return { fields: filterKnownFields(fields, schema) };
  }

  const text = `${candidate.detail ?? ''} ${candidate.message ?? ''}`.trim();
  if (!text) {
    return null;
  }

  if (candidate.code === '23505') {
    const match = text.match(/Key \(([^)]+)\)=/i);
    const fields = match?.[1]
      ?.split(',')
      .map((field) => field.trim())
      .filter(Boolean) ?? [];
    return { fields: filterKnownFields(fields, schema) };
  }

  if (candidate.code === 'SQLITE_CONSTRAINT' && /UNIQUE constraint failed:/i.test(text)) {
    const match = text.match(/UNIQUE constraint failed:\s*(.+)$/i);
    const fields = match?.[1]
      ?.split(',')
      .map((value) => value.trim().split('.').at(-1) ?? '')
      .filter(Boolean) ?? [];
    return { fields: filterKnownFields(fields, schema) };
  }

  if (candidate.code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(text)) {
    return { fields: [] };
  }

  return null;
}

function filterKnownFields(fields: string[], schema: AdminResourceSchema): string[] {
  const knownFields = new Set(schema.fields.map((field) => field.name));
  return [...new Set(fields.filter((field) => knownFields.has(field)))];
}

function startCase(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function mergeSummaryItems(
  current: AdminDeleteSummaryItem[],
  incoming: AdminDeleteSummaryItem[],
): AdminDeleteSummaryItem[] {
  const merged = new Map(current.map((item) => [item.id, item]));

  for (const item of incoming) {
    merged.set(item.id, item);
  }

  return [...merged.values()];
}
