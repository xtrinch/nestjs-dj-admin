import type { Provider, Type } from '@nestjs/common';
import type { Request } from 'express';

export type PermissionRole = string;

export interface AdminRequestUser {
  id: string;
  role: string;
  email?: string;
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

export interface AdminLookupItem {
  value: string;
  label: string;
}

export interface AdminLookupResult {
  items: AdminLookupItem[];
  total: number;
}

export type AdminAuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'soft-delete'
  | 'password-change'
  | 'action'
  | 'bulk-action';

export interface AdminAuditActor {
  id: string;
  role: string;
  email?: string;
}

export interface AdminAuditEvent {
  action: AdminAuditAction;
  actor: AdminAuditActor;
  summary: string;
  resourceName?: string;
  resourceLabel?: string;
  objectId?: string;
  objectLabel?: string;
  actionLabel?: string;
  count?: number;
}

export interface AdminAuditEntry extends AdminAuditEvent {
  id: string;
  timestamp: string;
}

export interface AdminAuditResult {
  items: AdminAuditEntry[];
  total: number;
}

export interface AdminAuditStore {
  append(entry: AdminAuditEntry, maxEntries: number): Promise<void> | void;
  list(query: { page: number; pageSize: number }): Promise<AdminAuditResult> | AdminAuditResult;
}

export interface AdminDeleteSummaryItem {
  id: string;
  label: string;
}

export interface AdminDeleteRelatedSummary {
  field: string;
  label: string;
  count: number;
  items: AdminDeleteSummaryItem[];
}

export interface AdminDeleteImpactGroup {
  resourceName: string;
  label: string;
  count: number;
  items: AdminDeleteSummaryItem[];
  via?: string;
}

export interface AdminDeleteSummary {
  resourceName: string;
  label: string;
  count: number;
  mode?: 'delete' | 'soft-delete';
  items: AdminDeleteSummaryItem[];
  related: AdminDeleteRelatedSummary[];
  impact: {
    delete: AdminDeleteImpactGroup[];
    disconnect: AdminDeleteImpactGroup[];
    blocked: AdminDeleteImpactGroup[];
  };
}

export type AdminEntity = object;

export type AdminEntityClass<TModel extends AdminEntity = AdminEntity> = Type<TModel>;

export interface AdminAdapterResource<TModel extends AdminEntity = AdminEntity> {
  resourceName: string;
  label: string;
  model?: AdminEntityClass<TModel>;
  search: AdminSearchField[];
  filters: string[];
  fields: AdminFieldSchema[];
  softDelete?: AdminSoftDeleteSchema;
}

export type AdminSearchOption =
  | string
  | {
      path: string;
      label?: string;
    };

export type AdminSearchField =
  | {
      kind: 'field';
      path: string;
      label: string;
    }
  | {
      kind: 'relation';
      path: string;
      label: string;
      relationField: string;
      relationResource: string;
      targetField: string;
      valueField: string;
      relationKind: 'many-to-one' | 'many-to-many';
    };

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
  input?: 'text' | 'email' | 'tel' | 'url' | 'password' | 'number' | 'checkbox' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'multiselect';
  modes?: AdminFieldMode[];
  relation?: {
    kind: 'many-to-one' | 'many-to-many';
    option: AdminFieldRelationOption;
  };
}

export type AdminFieldMode = 'create' | 'update';

export interface AdminPasswordOptions {
  hash: (password: string) => string | Promise<string>;
  fieldName?: string;
  confirmFieldName?: string;
  targetFieldName?: string;
  helpText?: string;
}

export interface AdminWriteTransformContext<TModel extends AdminEntity = AdminEntity> {
  operation: 'create' | 'update';
  resourceName: string;
  resource: AdminAdapterResource<TModel>;
  user: AdminRequestUser;
  id?: string;
}

export type AdminWriteTransform<TModel extends AdminEntity = AdminEntity> = (
  payload: Record<string, unknown>,
  context: AdminWriteTransformContext<TModel>,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

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

export interface AdminBulkActionContext<TModel extends AdminEntity = AdminEntity> {
  adapter: AdminAdapter;
  resourceName: string;
  resource: AdminAdapterResource<TModel>;
  user: AdminRequestUser;
  ids: string[];
}

export interface AdminBulkAction<TModel extends AdminEntity = AdminEntity> {
  name: string;
  slug?: string;
  handler: (
    ids: string[],
    context: AdminBulkActionContext<TModel>,
  ) => Promise<void>;
}

export interface AdminPermissions {
  read?: PermissionRole[];
  write?: PermissionRole[];
}

export interface AdminSoftDeleteOptions {
  fieldName?: string;
}

export interface AdminResourceOptions<TModel extends AdminEntity = AdminEntity> {
  model: AdminEntityClass<TModel>;
  resourceName?: string;
  category?: string;
  objectLabel?: string;
  list: string[];
  defaultSort?: AdminSortConfig;
  sortable?: string[];
  listDisplayLinks?: string[] | null;
  search?: AdminSearchOption[];
  filters?: string[];
  readonly?: string[];
  permissions?: AdminPermissions;
  actions?: AdminAction<TModel>[];
  bulkActions?: AdminBulkAction<TModel>[];
  softDelete?: AdminSoftDeleteOptions;
  password?: AdminPasswordOptions;
  createDto?: Type<unknown>;
  updateDto?: Type<unknown>;
  transformCreate?: AdminWriteTransform<TModel>;
  transformUpdate?: AdminWriteTransform<TModel>;
}

export interface AdminModuleOptions {
  path: string;
  adapter?: Type<AdminAdapter> | Provider<AdminAdapter>;
  auth?: AdminAuthOptions;
  display?: AdminDisplayOptions;
  auditLog?: AdminAuditOptions;
}

export interface AdminAuthCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AdminSessionRecord {
  user: AdminRequestUser;
  expiresAt?: number;
}

export interface AdminSessionStore {
  get(sessionId: string): Promise<AdminSessionRecord | null> | AdminSessionRecord | null;
  set(sessionId: string, record: AdminSessionRecord): Promise<void> | void;
  delete(sessionId: string): Promise<void> | void;
}

export interface AdminAuthCookieOptions {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean | 'auto';
  path?: string;
  domain?: string;
}

export interface AdminAuthOptions {
  cookieName?: string;
  rememberMeMaxAgeMs?: number;
  sessionTtlMs?: number;
  sessionStore?: AdminSessionStore;
  cookie?: AdminAuthCookieOptions;
  authenticate: (
    credentials: AdminAuthCredentials,
    request: Request,
  ) => Promise<AdminRequestUser | null>;
}

export interface AdminAuditOptions {
  enabled?: boolean;
  maxEntries?: number;
  filePath?: string;
  store?: AdminAuditStore;
}

export interface AdminFieldSchema {
  name: string;
  label: string;
  input: 'text' | 'email' | 'tel' | 'url' | 'password' | 'number' | 'checkbox' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  modes?: AdminFieldMode[];
  helpText?: string;
  enumValues?: string[];
  relation?: AdminDtoFieldConfig['relation'];
}

export interface AdminPasswordSchema {
  enabled: boolean;
  helpText?: string;
}

export interface AdminSoftDeleteSchema {
  enabled: boolean;
  fieldName: string;
  filterField: '__softDeleteState';
}

export interface AdminResourceSchema {
  resourceName: string;
  label: string;
  category: string;
  objectLabel?: string;
  list: string[];
  defaultSort?: AdminSortConfig;
  sortable: string[];
  listDisplayLinks: string[];
  search: string[];
  filters: string[];
  readonly: string[];
  actions: Array<{ name: string; slug: string }>;
  bulkActions: Array<{ name: string; slug: string }>;
  permissions?: AdminPermissions;
  softDelete?: AdminSoftDeleteSchema;
  fields: AdminFieldSchema[];
  createFields: AdminFieldSchema[];
  updateFields: AdminFieldSchema[];
  password?: AdminPasswordSchema;
}

export interface AdminSortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface AdminDisplayOptions {
  locale?: string;
  dateFormat?: Intl.DateTimeFormatOptions;
  dateTimeFormat?: Intl.DateTimeFormatOptions;
}

export interface AdminDisplaySchema {
  locale: string;
  dateFormat: Intl.DateTimeFormatOptions;
  dateTimeFormat: Intl.DateTimeFormatOptions;
}
