export interface ResourceField {
  name: string;
  label: string;
  input: 'text' | 'email' | 'tel' | 'url' | 'password' | 'number' | 'checkbox' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  modes?: Array<'create' | 'update'>;
  helpText?: string;
  enumValues?: string[];
  relation?: {
    kind: 'many-to-one' | 'many-to-many';
    option: {
      resource: string;
      labelField: string;
      valueField?: string;
    };
  };
}

export interface AdminUser {
  id: string;
  role: string;
  email?: string;
}

export interface AdminAuthConfig {
  mode: 'session' | 'external';
  loginEnabled: boolean;
  logoutEnabled: boolean;
  loginUrl?: string;
  loginMessage?: string;
}

export interface AdminDisplayConfig {
  locale: string;
  dateFormat: Intl.DateTimeFormatOptions;
  dateTimeFormat: Intl.DateTimeFormatOptions;
}

export interface AdminBrandingConfig {
  siteHeader: string;
  siteTitle: string;
  indexTitle: string;
  accentColor: string;
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

export interface AdminLookupItem {
  value: string;
  label: string;
}

export interface AdminLookupResponse {
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

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  action: AdminAuditAction;
  actor: {
    id: string;
    role: string;
    email?: string;
  };
  summary: string;
  resourceName?: string;
  resourceLabel?: string;
  objectId?: string;
  objectLabel?: string;
  actionLabel?: string;
  count?: number;
}

export interface AdminAuditResponse {
  items: AdminAuditEntry[];
  total: number;
}

export interface ResourceSchema {
  resourceName: string;
  label: string;
  category: string;
  objectLabel?: string;
  list: string[];
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  sortable: string[];
  listDisplayLinks: string[];
  search: string[];
  filters: string[];
  readonly: string[];
  actions: Array<{ name: string; slug: string }>;
  bulkActions: Array<{ name: string; slug: string }>;
  fields: ResourceField[];
  createFields: ResourceField[];
  updateFields: ResourceField[];
  softDelete?: {
    enabled: boolean;
    fieldName: string;
    filterField: '__softDeleteState';
  };
  password?: {
    enabled: boolean;
    helpText?: string;
  };
}

export interface CustomPageSchemaBase {
  slug: string;
  label: string;
  category: string;
}

export interface EmbedPageSchema extends CustomPageSchemaBase {
  kind: 'embed';
  url: string;
  title?: string;
  description?: string;
  height: number;
  allow?: string;
  referrerPolicy?: HTMLIFrameElement['referrerPolicy'];
}

export type CustomPageSchema = EmbedPageSchema;

export interface NavItemSchemaBase {
  key: string;
  label: string;
  category: string;
  order: number;
}

export interface PageNavItemSchema extends NavItemSchemaBase {
  kind: 'page';
  pageSlug: string;
}

export interface HrefNavItemSchema extends NavItemSchemaBase {
  kind: 'href';
  href: string;
}

export type NavItemSchema = PageNavItemSchema | HrefNavItemSchema;

export interface WidgetSchemaBase {
  key: string;
  title: string;
  slot: 'dashboard-main' | 'dashboard-side';
  order: number;
}

export interface PageLinkWidgetSchema extends WidgetSchemaBase {
  kind: 'page-link';
  pageSlug: string;
  description?: string;
  ctaLabel?: string;
}

export interface HrefWidgetSchema extends WidgetSchemaBase {
  kind: 'href';
  href: string;
  description?: string;
  ctaLabel?: string;
}

export type WidgetSchema = PageLinkWidgetSchema | HrefWidgetSchema;

export interface AdminMetaResponse {
  resources: ResourceSchema[];
  pages: CustomPageSchema[];
  navItems: NavItemSchema[];
  widgets: WidgetSchema[];
  display: AdminDisplayConfig;
  branding: AdminBrandingConfig;
  auditLog?: {
    enabled: boolean;
  };
}

export interface ResourceMetaResponse {
  resource: ResourceSchema;
  filterOptions: Array<{ field: string; values: Array<string | number> }>;
  display?: AdminDisplayConfig;
}
