import type { Request } from 'express';
import type { AdminPermissionKey, AdminRequestUser } from '../admin/types/admin.types.js';

export interface AdminExtensionReadPermissions {
  read?: AdminPermissionKey[];
}

export interface AdminExtensionActionPermissions {
  execute?: AdminPermissionKey[];
}

export interface AdminPageDefinitionBase {
  slug: string;
  label: string;
  category?: string;
  route?: string;
  permissions?: AdminExtensionReadPermissions;
}

export interface AdminEmbedPageDefinition extends AdminPageDefinitionBase {
  kind: 'embed';
  url: string;
  title?: string;
  description?: string;
  height?: number;
  allow?: string;
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
}

export interface AdminScreenPageDefinition extends AdminPageDefinitionBase {
  kind: 'screen';
  route: string;
  screen: string;
  title?: string;
  description?: string;
}

export type AdminPageDefinition = AdminEmbedPageDefinition | AdminScreenPageDefinition;

export interface AdminNavItemDefinitionBase {
  key: string;
  label: string;
  category?: string;
  order?: number;
  permissions?: AdminExtensionReadPermissions;
}

export interface AdminPageNavItemDefinition extends AdminNavItemDefinitionBase {
  kind: 'page';
  pageSlug: string;
}

export interface AdminHrefNavItemDefinition extends AdminNavItemDefinitionBase {
  kind: 'href';
  href: string;
}

export type AdminNavItemDefinition = AdminPageNavItemDefinition | AdminHrefNavItemDefinition;

export interface AdminWidgetDefinitionBase {
  key: string;
  title: string;
  slot?: 'dashboard-main' | 'dashboard-side';
  order?: number;
  permissions?: AdminExtensionReadPermissions;
}

export interface AdminPageLinkWidgetDefinition extends AdminWidgetDefinitionBase {
  kind: 'page-link';
  pageSlug: string;
  description?: string;
  ctaLabel?: string;
}

export interface AdminRouteWidgetDefinition extends AdminWidgetDefinitionBase {
  kind: 'route';
  route: string;
  description?: string;
  ctaLabel?: string;
}

export interface AdminHrefWidgetDefinition extends AdminWidgetDefinitionBase {
  kind: 'href';
  href: string;
  description?: string;
  ctaLabel?: string;
}

export type AdminWidgetDefinition =
  | AdminPageLinkWidgetDefinition
  | AdminRouteWidgetDefinition
  | AdminHrefWidgetDefinition;

export interface AdminResourceDetailPanelDefinition {
  key: string;
  resource: string;
  title: string;
  screen: string;
  permissions?: AdminExtensionReadPermissions;
  config?: Record<string, unknown>;
}

export interface AdminExtensionEndpointContext<
  TBody = Record<string, unknown>,
  TQuery extends Record<string, string | string[]> = Record<string, string | string[]>,
> {
  body: TBody;
  params: Record<string, string>;
  query: TQuery;
  request: Request;
  user: AdminRequestUser;
}

export interface AdminExtensionActionAuditEvent {
  summary: string;
  objectId?: string;
  objectLabel?: string;
  actionLabel?: string;
  count?: number;
}

export interface AdminExtensionGetEndpointDefinition {
  key: string;
  method: 'GET';
  path: string;
  permissions?: AdminExtensionReadPermissions;
  handler: (
    context: AdminExtensionEndpointContext<never>,
  ) => Promise<unknown> | unknown;
}

export interface AdminExtensionPostEndpointDefinition {
  key: string;
  method: 'POST';
  path: string;
  permissions?: AdminExtensionActionPermissions;
  handler: (
    context: AdminExtensionEndpointContext,
  ) => Promise<unknown> | unknown;
  audit?: (
    context: AdminExtensionEndpointContext,
    result: unknown,
  ) => Promise<AdminExtensionActionAuditEvent | null | undefined> | AdminExtensionActionAuditEvent | null | undefined;
}

export type AdminExtensionEndpointDefinition =
  | AdminExtensionGetEndpointDefinition
  | AdminExtensionPostEndpointDefinition;

export interface DjAdminExtension {
  id: string;
  pages?: AdminPageDefinition[];
  navItems?: AdminNavItemDefinition[];
  widgets?: AdminWidgetDefinition[];
  detailPanels?: AdminResourceDetailPanelDefinition[];
  endpoints?: AdminExtensionEndpointDefinition[];
}

export interface AdminPageSchemaBase {
  slug: string;
  label: string;
  category: string;
  route: string;
  permissions?: AdminExtensionReadPermissions;
}

export interface AdminEmbedPageSchema extends AdminPageSchemaBase {
  kind: 'embed';
  url: string;
  title?: string;
  description?: string;
  height: number;
  allow?: string;
  referrerPolicy?: AdminEmbedPageDefinition['referrerPolicy'];
}

export interface AdminScreenPageSchema extends AdminPageSchemaBase {
  kind: 'screen';
  screen: string;
  title?: string;
  description?: string;
}

export type AdminPageSchema = AdminEmbedPageSchema | AdminScreenPageSchema;

export interface AdminNavItemSchemaBase {
  key: string;
  label: string;
  category: string;
  order: number;
  permissions?: AdminExtensionReadPermissions;
}

export interface AdminPageNavItemSchema extends AdminNavItemSchemaBase {
  kind: 'page';
  pageSlug: string;
}

export interface AdminHrefNavItemSchema extends AdminNavItemSchemaBase {
  kind: 'href';
  href: string;
}

export type AdminNavItemSchema = AdminPageNavItemSchema | AdminHrefNavItemSchema;

export interface AdminWidgetSchemaBase {
  key: string;
  title: string;
  slot: 'dashboard-main' | 'dashboard-side';
  order: number;
  permissions?: AdminExtensionReadPermissions;
}

export interface AdminPageLinkWidgetSchema extends AdminWidgetSchemaBase {
  kind: 'page-link';
  pageSlug: string;
  description?: string;
  ctaLabel?: string;
}

export interface AdminRouteWidgetSchema extends AdminWidgetSchemaBase {
  kind: 'route';
  route: string;
  description?: string;
  ctaLabel?: string;
}

export interface AdminHrefWidgetSchema extends AdminWidgetSchemaBase {
  kind: 'href';
  href: string;
  description?: string;
  ctaLabel?: string;
}

export type AdminWidgetSchema =
  | AdminPageLinkWidgetSchema
  | AdminRouteWidgetSchema
  | AdminHrefWidgetSchema;

export interface AdminResourceDetailPanelSchema {
  key: string;
  resource: string;
  title: string;
  screen: string;
  permissions?: AdminExtensionReadPermissions;
  config?: Record<string, unknown>;
}
