import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
export { OrderStatus } from '#examples-shared/modules/order/shared.js';
import { OrderStatus } from '#examples-shared/modules/order/shared.js';

@Entity({ tableName: 'orders' })
export class Order {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ unique: true })
  number!: string;

  @Property({ columnType: 'date' })
  orderDate!: string;

  @Property({ columnType: 'time', nullable: true })
  deliveryTime!: string | null;

  @Property({ nullable: true })
  fulfillmentAt!: Date | null;

  @Property()
  userId!: number;

  @Property()
  status!: OrderStatus;

  @Property({ columnType: 'numeric(10,2)' })
  total!: number;

  @Property({ columnType: 'text', default: '' })
  internalNote = '';

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt = new Date();
}
