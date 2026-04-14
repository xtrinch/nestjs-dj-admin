export { OrderStatus } from '../../../../shared/src/modules/order/shared.js';
import { OrderStatus } from '../../../../shared/src/modules/order/shared.js';

export class Order {
  id!: number;
  number!: string;
  orderDate!: Date;
  deliveryTime!: string | null;
  fulfillmentAt!: Date | null;
  userId!: number;
  status!: OrderStatus;
  total!: number;
  internalNote!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
