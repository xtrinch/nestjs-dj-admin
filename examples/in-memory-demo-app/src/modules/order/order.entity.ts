import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export { OrderStatus } from '../../../../shared/src/modules/order/shared.js';
import { OrderStatus } from '../../../../shared/src/modules/order/shared.js';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  number!: string;

  @Column()
  userId!: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status!: OrderStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  total!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
