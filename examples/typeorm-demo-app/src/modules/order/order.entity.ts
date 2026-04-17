import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
export { OrderStatus } from '#examples-shared/modules/order/shared.js';
import { OrderStatus } from '#examples-shared/modules/order/shared.js';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  number!: string;

  @Column({ type: 'date' })
  orderDate!: string;

  @Column({ type: 'time', nullable: true })
  deliveryTime!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fulfillmentAt!: Date | null;

  @Column()
  userId!: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status!: OrderStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  total!: number;

  @Column({ type: 'text', default: '' })
  internalNote!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
