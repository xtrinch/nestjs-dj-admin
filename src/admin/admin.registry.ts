import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { ADMIN_RESOURCE_METADATA } from './admin.constants.js';
import type { AdminFieldSchema, AdminResourceOptions, AdminResourceSchema } from './types/admin.types.js';
import { actionSlug, buildResourceName } from './utils/resource-name.util.js';

interface RegisteredResource {
  target: Function;
  options: AdminResourceOptions;
  schema: AdminResourceSchema;
}

@Injectable()
export class AdminRegistry {
  private readonly resources = new Map<string, RegisteredResource>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  initialize(): void {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const metatype = wrapper.metatype;
      if (!metatype) {
        continue;
      }

      const options = Reflect.getMetadata(ADMIN_RESOURCE_METADATA, metatype) as
        | AdminResourceOptions
        | undefined;
      if (!options) {
        continue;
      }

      const resourceName = options.resourceName ?? buildResourceName(options.model.name);
      const createFields = this.buildFieldsForMode(options, 'create').filter((field) => !field.readOnly);
      const updateFields = this.buildFieldsForMode(options, 'update');
      const displayFields =
        options.schema.buildDisplayFields?.({
          readonlyFields: options.readonly ?? [],
          model: options.model,
        }) ?? mergeFields(createFields, updateFields);
      const listDisplayLinks =
        options.listDisplayLinks === null
          ? []
          : options.listDisplayLinks && options.listDisplayLinks.length > 0
            ? options.listDisplayLinks
            : options.list.length > 0
              ? [options.list[0]]
              : [];
      const schema: AdminResourceSchema = {
        resourceName,
        label: options.model.name,
        category: options.category ?? 'General',
        objectLabel: options.objectLabel,
        list: options.list,
        defaultSort: options.defaultSort,
        sortable: options.sortable ?? (options.defaultSort ? [options.defaultSort.field] : []),
        listDisplayLinks,
        search: (options.search ?? []).map((entry) =>
          typeof entry === 'string' ? entry : (entry.label ?? entry.path)
        ),
        filters: options.filters ?? [],
        readonly: options.readonly ?? [],
        permissions: options.permissions,
        actions: (options.actions ?? []).map((action) => ({
          name: action.name,
          slug: action.slug ?? actionSlug(action.name),
        })),
        bulkActions: (options.bulkActions ?? []).map((action) => ({
          name: action.name,
          slug: action.slug ?? actionSlug(action.name),
        })),
        softDelete: options.softDelete
          ? {
              enabled: true,
              fieldName: options.softDelete.fieldName ?? 'deletedAt',
              filterField: '__softDeleteState',
            }
          : undefined,
        fields: mergeFields(displayFields, mergeFields(createFields, updateFields)),
        createFields,
        updateFields,
        password: options.password
          ? {
              enabled: true,
              helpText:
                options.password.helpText ??
                'Raw passwords are not stored, so there is no way to see this user’s password.',
            }
          : undefined,
      };

      this.resources.set(resourceName, {
        target: metatype,
        options,
        schema,
      });

      this.metadataScanner.getAllMethodNames(metatype.prototype);
    }
  }

  getAll(): AdminResourceSchema[] {
    return [...this.resources.values()].map((resource) => resource.schema);
  }

  get(resourceName: string): RegisteredResource {
    const resource = this.resources.get(resourceName);
    if (!resource) {
      throw new Error(`Unknown admin resource "${resourceName}"`);
    }

    return resource;
  }

  private buildFieldsForMode(
    options: AdminResourceOptions,
    mode: 'create' | 'update',
  ): AdminFieldSchema[] {
    return mode === 'create'
      ? options.schema.buildCreateFields({
          readonlyFields: options.readonly ?? [],
          model: options.model,
        })
      : options.schema.buildUpdateFields({
          readonlyFields: options.readonly ?? [],
          model: options.model,
        });
  }
}

function mergeFields(primary: AdminFieldSchema[], secondary: AdminFieldSchema[]): AdminFieldSchema[] {
  const merged = new Map(primary.map((field) => [field.name, field]));

  for (const field of secondary) {
    const existing = merged.get(field.name);
    if (!existing) {
      merged.set(field.name, field);
      continue;
    }

    merged.set(field.name, {
      ...existing,
      ...field,
      modes: (() => {
        const modes = [...new Set([...(existing.modes ?? []), ...(field.modes ?? [])])];
        return modes.length > 0 ? modes : undefined;
      })(),
    });
  }

  return [...merged.values()];
}
