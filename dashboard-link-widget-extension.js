import { existsSync } from 'node:fs';

const widgetModule = existsSync(new URL('./dist/extensions/dashboard-link-widget/index.js', import.meta.url))
  ? await import('./dist/extensions/dashboard-link-widget/index.js')
  : await import('./src/extensions/dashboard-link-widget/index.ts');

export const dashboardLinkWidgetExtension = widgetModule.dashboardLinkWidgetExtension;
