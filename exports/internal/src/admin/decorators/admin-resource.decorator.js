import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/admin/decorators/admin-resource.decorator.js', import.meta.url))
  ? await import('../../../../../dist/admin/decorators/admin-resource.decorator.js')
  : await import('../../../../../src/admin/decorators/admin-resource.decorator.ts');

export const AdminResource = moduleRef.AdminResource;
