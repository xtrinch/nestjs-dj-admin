import type { DjAdminExtension } from '../../extension-api/types.js';

type DashboardLinkWidgetTarget =
  | {
      pageSlug: string;
      route?: never;
      href?: never;
    }
  | {
      pageSlug?: never;
      route: string;
      href?: never;
    }
  | {
      pageSlug?: never;
      route?: never;
      href: string;
    };

type DashboardLinkWidgetExtensionOptionsBase = {
  id: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  slot?: 'dashboard-main' | 'dashboard-side';
  order?: number;
  permissions?: {
    read?: string[];
  };
};

export type DashboardLinkWidgetExtensionOptions =
  DashboardLinkWidgetExtensionOptionsBase & DashboardLinkWidgetTarget;

export function dashboardLinkWidgetExtension(
  options: DashboardLinkWidgetExtensionOptions,
): DjAdminExtension {
  if (typeof options.pageSlug === 'string') {
    return {
      id: options.id,
      widgets: [
        {
          kind: 'page-link',
          key: `${options.id}:widget`,
          title: options.title,
          description: options.description,
          ctaLabel: options.ctaLabel,
          slot: options.slot,
          order: options.order,
          permissions: options.permissions,
          pageSlug: options.pageSlug,
        },
      ],
    };
  }

  if (typeof options.route === 'string') {
    return {
      id: options.id,
      widgets: [
        {
          kind: 'route',
          key: `${options.id}:widget`,
          title: options.title,
          description: options.description,
          ctaLabel: options.ctaLabel,
          slot: options.slot,
          order: options.order,
          permissions: options.permissions,
          route: options.route,
        },
      ],
    };
  }

  return {
    id: options.id,
    widgets: [
      {
        kind: 'href',
        key: `${options.id}:widget`,
        title: options.title,
        description: options.description,
        ctaLabel: options.ctaLabel,
        slot: options.slot,
        order: options.order,
        permissions: options.permissions,
        href: options.href,
      },
    ],
  };
}
