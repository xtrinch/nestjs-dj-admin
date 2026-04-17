import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/admin/decorators/admin-field.decorator.js', import.meta.url))
  ? await import('../../../../../dist/admin/decorators/admin-field.decorator.js')
  : await import('../../../../../src/admin/decorators/admin-field.decorator.ts');

export const AdminField = moduleRef.AdminField;
export const ADMIN_DTO_FIELD_METADATA = moduleRef.ADMIN_DTO_FIELD_METADATA;
