import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/examples/shared/src/modules/product/shared.js', import.meta.url))
  ? await import('../../../../../dist/examples/shared/src/modules/product/shared.js')
  : await import('../../../../../examples/shared/src/modules/product/shared.ts');

export const CreateProductDto = moduleRef.CreateProductDto;
export const UpdateProductDto = moduleRef.UpdateProductDto;
export const productAdminOptions = moduleRef.productAdminOptions;
