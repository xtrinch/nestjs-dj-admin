import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/examples/shared/src/modules/order-detail/shared.js', import.meta.url))
  ? await import('../../../../../dist/examples/shared/src/modules/order-detail/shared.js')
  : await import('../../../../../examples/shared/src/modules/order-detail/shared.ts');

export const CreateOrderDetailDto = moduleRef.CreateOrderDetailDto;
export const UpdateOrderDetailDto = moduleRef.UpdateOrderDetailDto;
export const orderDetailAdminOptions = moduleRef.orderDetailAdminOptions;
