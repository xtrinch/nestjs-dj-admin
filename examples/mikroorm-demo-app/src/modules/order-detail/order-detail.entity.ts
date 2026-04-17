import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'order_details' })
export class OrderDetail {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property()
  orderId!: number;

  @Property()
  productId!: number;

  @Property({ columnType: 'numeric(10,2)' })
  unitPrice!: number;

  @Property()
  quantity!: number;

  @Property({ columnType: 'numeric(4,2)', default: 0 })
  discount = 0;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt = new Date();
}
