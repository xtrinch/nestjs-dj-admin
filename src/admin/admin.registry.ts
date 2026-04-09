import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { ADMIN_RESOURCE_METADATA } from './admin.constants.js';
import { DtoIntrospectorService } from './services/dto-introspector.service.js';
import type { AdminResourceOptions, AdminResourceSchema } from './types/admin.types.js';
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
    private readonly dtoIntrospector: DtoIntrospectorService,
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
      const schema: AdminResourceSchema = {
        resourceName,
        label: options.model.name,
        category: options.category ?? 'General',
        list: options.list,
        search: options.search ?? [],
        filters: options.filters ?? [],
        readonly: options.readonly ?? [],
        permissions: options.permissions,
        actions: (options.actions ?? []).map((action) => ({
          name: action.name,
          slug: action.slug ?? actionSlug(action.name),
        })),
        fields: this.dtoIntrospector.buildFields(
          options.createDto ?? options.updateDto,
          options.readonly ?? [],
        ),
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
}
