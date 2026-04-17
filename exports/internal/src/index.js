import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../dist/index.js', import.meta.url))
  ? await import('../../../dist/index.js')
  : await import('../../../src/index.ts');

export const adminSchemaFromClassValidator = moduleRef.adminSchemaFromClassValidator;
export const adminSchemaFromZod = moduleRef.adminSchemaFromZod;
