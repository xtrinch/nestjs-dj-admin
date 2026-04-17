import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/examples/shared/src/modules/category/shared.js', import.meta.url))
  ? await import('../../../../../dist/examples/shared/src/modules/category/shared.js')
  : await import('../../../../../examples/shared/src/modules/category/shared.ts');

export const CreateCategoryDto = moduleRef.CreateCategoryDto;
export const UpdateCategoryDto = moduleRef.UpdateCategoryDto;
export const categoryAdminOptions = moduleRef.categoryAdminOptions;
