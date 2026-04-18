import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_OPTIONS } from '../admin/admin.constants.js';
import type { AdminExtensionsSchema, AdminModuleOptions } from '../admin/types/admin.types.js';
import type {
  AdminExtensionEndpointDefinition,
  AdminNavItemSchema,
  AdminPageSchema,
  AdminResourceDetailPanelSchema,
  AdminWidgetSchema,
  DjAdminExtension,
} from './types.js';
import { matchExtensionRoute, normalizeExtensionRoute } from './route.utils.js';

@Injectable()
export class AdminExtensionRegistry {
  private initialized = false;
  private pages: AdminPageSchema[] = [];
  private navItems: AdminNavItemSchema[] = [];
  private widgets: AdminWidgetSchema[] = [];
  private detailPanels: AdminResourceDetailPanelSchema[] = [];
  private endpoints: AdminExtensionEndpointDefinition[] = [];

  constructor(@Inject(ADMIN_OPTIONS) private readonly options: AdminModuleOptions) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const extensions = this.options.extensions ?? [];
    const pageBySlug = new Map<string, AdminPageSchema>();
    const navKeySet = new Set<string>();
    const widgetKeySet = new Set<string>();
    const detailPanelKeySet = new Set<string>();
    const endpointKeySet = new Set<string>();

    for (const extension of extensions) {
      this.assertExtensionId(extension);

      for (const page of extension.pages ?? []) {
        if (pageBySlug.has(page.slug)) {
          throw new Error(`Duplicate admin extension page slug "${page.slug}"`);
        }

        if (page.kind === 'embed') {
          pageBySlug.set(page.slug, {
            ...page,
            category: page.category ?? 'General',
            route: normalizeExtensionRoute(page.route ?? `/pages/${page.slug}`),
            height: page.height ?? 960,
          });
          continue;
        }

        pageBySlug.set(page.slug, {
          ...page,
          category: page.category ?? 'General',
          route: normalizeExtensionRoute(page.route),
        });
      }
    }

    for (const extension of extensions) {
      for (const navItem of extension.navItems ?? []) {
        if (navKeySet.has(navItem.key)) {
          throw new Error(`Duplicate admin extension nav item key "${navItem.key}"`);
        }

        if (navItem.kind === 'page' && !pageBySlug.has(navItem.pageSlug)) {
          throw new Error(`Unknown admin extension page slug "${navItem.pageSlug}" referenced by nav item "${navItem.key}"`);
        }

        navKeySet.add(navItem.key);
        this.navItems.push({
          ...navItem,
          category: navItem.category ?? 'General',
          order: navItem.order ?? 0,
        });
      }

      for (const widget of extension.widgets ?? []) {
        if (widgetKeySet.has(widget.key)) {
          throw new Error(`Duplicate admin extension widget key "${widget.key}"`);
        }

        if (widget.kind === 'page-link' && !pageBySlug.has(widget.pageSlug)) {
          throw new Error(`Unknown admin extension page slug "${widget.pageSlug}" referenced by widget "${widget.key}"`);
        }

        widgetKeySet.add(widget.key);
        this.widgets.push({
          ...widget,
          slot: widget.slot ?? 'dashboard-main',
          order: widget.order ?? 0,
        });
      }

      for (const detailPanel of extension.detailPanels ?? []) {
        if (detailPanelKeySet.has(detailPanel.key)) {
          throw new Error(`Duplicate admin extension detail panel key "${detailPanel.key}"`);
        }

        detailPanelKeySet.add(detailPanel.key);
        this.detailPanels.push(detailPanel);
      }

      for (const endpoint of extension.endpoints ?? []) {
        if (endpointKeySet.has(endpoint.key)) {
          throw new Error(`Duplicate admin extension endpoint key "${endpoint.key}"`);
        }

        endpointKeySet.add(endpoint.key);
        this.endpoints.push({
          ...endpoint,
          path: normalizeExtensionRoute(endpoint.path),
        });
      }
    }

    this.pages = [...pageBySlug.values()];
    this.navItems.sort(compareOrderThenLabel);
    this.widgets.sort(compareOrderThenTitle);
    this.initialized = true;
  }

  getSchema(): AdminExtensionsSchema {
    return {
      pages: this.pages,
      navItems: this.navItems,
      widgets: this.widgets,
      detailPanels: this.detailPanels,
    };
  }

  resolveEndpoint(method: 'GET' | 'POST', path: string):
    | {
        endpoint: AdminExtensionEndpointDefinition;
        params: Record<string, string>;
      }
    | undefined {
    const normalizedPath = normalizeExtensionRoute(path);
    for (const endpoint of this.endpoints) {
      if (endpoint.method !== method) {
        continue;
      }

      const matched = matchExtensionRoute(endpoint.path, normalizedPath);
      if (matched) {
        return {
          endpoint,
          params: matched.params,
        };
      }
    }

    return undefined;
  }

  private assertExtensionId(extension: DjAdminExtension): void {
    if (!extension.id.trim()) {
      throw new Error('Admin extension id must not be empty');
    }
  }
}

function compareOrderThenLabel(left: AdminNavItemSchema, right: AdminNavItemSchema): number {
  return left.order - right.order || left.label.localeCompare(right.label);
}

function compareOrderThenTitle(left: AdminWidgetSchema, right: AdminWidgetSchema): number {
  return left.order - right.order || left.title.localeCompare(right.title);
}
