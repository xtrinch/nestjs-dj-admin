import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/examples/shared/src/modules/order/shared.js', import.meta.url))
  ? await import('../../../../../dist/examples/shared/src/modules/order/shared.js')
  : await import('../../../../../examples/shared/src/modules/order/shared.ts');

export const OrderStatus = moduleRef.OrderStatus;
export const CreateOrderDto = moduleRef.CreateOrderDto;
export const UpdateOrderDto = moduleRef.UpdateOrderDto;
export const orderAdminOptions = moduleRef.orderAdminOptions;
