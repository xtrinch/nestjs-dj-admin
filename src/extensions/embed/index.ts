import type { DjAdminExtension } from '../../extension-api/types.js';

export interface EmbedPageExtensionOptions {
  id: string;
  page: {
    slug: string;
    label: string;
    category?: string;
    title?: string;
    description?: string;
    url: string;
    height?: number;
    allow?: string;
    referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
    permissions?: {
      read?: string[];
    };
  };
  navItem?: {
    key?: string;
    label?: string;
    category?: string;
    order?: number;
    permissions?: {
      read?: string[];
    };
  };
}

export function embedPageExtension(options: EmbedPageExtensionOptions): DjAdminExtension {
  return {
    id: options.id,
    pages: [
      {
        kind: 'embed',
        ...options.page,
      },
    ],
    navItems: [
      {
        kind: 'page',
        key: options.navItem?.key ?? `${options.id}:nav`,
        label: options.navItem?.label ?? options.page.label,
        category: options.navItem?.category ?? options.page.category,
        order: options.navItem?.order,
        permissions: options.navItem?.permissions ?? options.page.permissions,
        pageSlug: options.page.slug,
      },
    ],
  };
}
