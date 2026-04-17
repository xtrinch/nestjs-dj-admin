import type { AdminPermissionKey } from '../admin/types/admin.types.js';

export interface AdminExtensionReadPermissions {
  read?: AdminPermissionKey[];
}

export interface AdminPageDefinitionBase {
  slug: string;
  label: string;
  category?: string;
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

export type AdminPageDefinition = AdminEmbedPageDefinition;

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

export interface AdminHrefWidgetDefinition extends AdminWidgetDefinitionBase {
  kind: 'href';
  href: string;
  description?: string;
  ctaLabel?: string;
}

export type AdminWidgetDefinition = AdminPageLinkWidgetDefinition | AdminHrefWidgetDefinition;

export interface DjAdminExtension {
  id: string;
  pages?: AdminPageDefinition[];
  navItems?: AdminNavItemDefinition[];
  widgets?: AdminWidgetDefinition[];
}

export interface AdminPageSchemaBase {
  slug: string;
  label: string;
  category: string;
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

export type AdminPageSchema = AdminEmbedPageSchema;

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

export interface AdminHrefWidgetSchema extends AdminWidgetSchemaBase {
  kind: 'href';
  href: string;
  description?: string;
  ctaLabel?: string;
}

export type AdminWidgetSchema = AdminPageLinkWidgetSchema | AdminHrefWidgetSchema;
