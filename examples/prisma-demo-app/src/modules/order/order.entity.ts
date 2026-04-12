export { OrderStatus } from '../../../../shared/src/modules/order/shared.js';
import { OrderStatus } from '../../../../shared/src/modules/order/shared.js';

export class Order {
  id!: number;
  number!: string;
  userId!: number;
  status!: OrderStatus;
  total!: number;
  createdAt!: Date;
}
