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

export type AdminEntity = object;

export type AdminEntityClass<TModel extends AdminEntity = AdminEntity> = Type<TModel>;

export interface AdminAdapterResource<TModel extends AdminEntity = AdminEntity> {
  resourceName: string;
  label: string;
  model?: AdminEntityClass<TModel>;
  search: string[];
  filters: string[];
}

export interface AdminAdapter {
  findMany<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    query: AdminListQuery,
  ): Promise<AdminListResult<TModel>>;
  findOne<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
  ): Promise<TModel | null>;
  create<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    data: Partial<TModel>,
  ): Promise<TModel>;
  update<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    id: string,
    data: Partial<TModel>,
  ): Promise<TModel>;
  delete<TModel extends AdminEntity>(resource: AdminAdapterResource<TModel>, id: string): Promise<void>;
  distinct?<TModel extends AdminEntity>(
    resource: AdminAdapterResource<TModel>,
    field: string,
  ): Promise<Array<string | number>>;
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

export interface AdminActionContext<TModel extends AdminEntity = AdminEntity> {
  adapter: AdminAdapter;
  resourceName: string;
  resource: AdminAdapterResource<TModel>;
  user: AdminRequestUser;
}

export interface AdminAction<TModel extends AdminEntity = AdminEntity> {
  name: string;
  slug?: string;
  handler: (
    entity: TModel,
    context: AdminActionContext<TModel>,
  ) => Promise<TModel | void>;
}

export interface AdminPermissions {
  read?: PermissionRole[];
  write?: PermissionRole[];
}

export interface AdminResourceOptions<TModel extends AdminEntity = AdminEntity> {
  model: AdminEntityClass<TModel>;
  resourceName?: string;
  category?: string;
  list: string[];
  search?: string[];
  filters?: string[];
  readonly?: string[];
  permissions?: AdminPermissions;
  actions?: AdminAction<TModel>[];
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
