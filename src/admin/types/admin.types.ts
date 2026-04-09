import type { Provider, Type } from '@nestjs/common';

export type PermissionRole = string;

export interface AdminRequestUser {
  id: string;
  role: string;
}

export interface AdminListQuery {
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, string | string[]>;
}

export interface AdminListResult<T = Record<string, unknown>> {
  items: T[];
  total: number;
}

export interface AdminAdapterResource {
  resourceName: string;
  label: string;
  model?: Type<unknown>;
  search: string[];
  filters: string[];
}

export interface AdminAdapter {
  findMany(resource: AdminAdapterResource, query: AdminListQuery): Promise<AdminListResult>;
  findOne(resource: AdminAdapterResource, id: string): Promise<Record<string, unknown> | null>;
  create(resource: AdminAdapterResource, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(
    resource: AdminAdapterResource,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  delete(resource: AdminAdapterResource, id: string): Promise<void>;
  distinct?(resource: AdminAdapterResource, field: string): Promise<Array<string | number>>;
}

export interface AdminFieldRelationOption {
  resource: string;
  labelField: string;
  valueField?: string;
}

export interface AdminDtoFieldConfig {
  label?: string;
  helpText?: string;
  relation?: {
    kind: 'many-to-one' | 'many-to-many';
    option: AdminFieldRelationOption;
  };
}

export interface AdminActionContext {
  adapter: AdminAdapter;
  resourceName: string;
  resource: AdminAdapterResource;
  user: AdminRequestUser;
}

export interface AdminAction {
  name: string;
  slug?: string;
  handler: (
    entity: Record<string, unknown>,
    context: AdminActionContext,
  ) => Promise<Record<string, unknown> | void>;
}

export interface AdminPermissions {
  read?: PermissionRole[];
  write?: PermissionRole[];
}

export interface AdminResourceOptions {
  model: Type<unknown>;
  resourceName?: string;
  category?: string;
  list: string[];
  search?: string[];
  filters?: string[];
  readonly?: string[];
  permissions?: AdminPermissions;
  actions?: AdminAction[];
  createDto?: Type<unknown>;
  updateDto?: Type<unknown>;
}

export interface AdminModuleOptions {
  path: string;
  adapter?: Type<AdminAdapter> | Provider<AdminAdapter>;
}

export interface AdminFieldSchema {
  name: string;
  label: string;
  input: 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  enumValues?: string[];
  relation?: AdminDtoFieldConfig['relation'];
}

export interface AdminResourceSchema {
  resourceName: string;
  label: string;
  category: string;
  list: string[];
  search: string[];
  filters: string[];
  readonly: string[];
  actions: Array<{ name: string; slug: string }>;
  permissions?: AdminPermissions;
  fields: AdminFieldSchema[];
}
