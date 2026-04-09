import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../modules/order/order.entity.js';
import { Role, User } from '../modules/user/user.entity.js';

@Injectable()
export class DemoDataService implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    if ((await userRepository.count()) === 0) {
      await userRepository.save([
        userRepository.create({
          email: 'ada@example.com',
          role: Role.ADMIN,
          active: true,
        }),
        userRepository.create({
          email: 'grace@example.com',
          role: Role.EDITOR,
          active: true,
        }),
        userRepository.create({
          email: 'linus@example.com',
          role: Role.VIEWER,
          active: false,
        }),
      ]);
    }

    const orderRepository = this.dataSource.getRepository(Order);
    if ((await orderRepository.count()) === 0) {
      await orderRepository.save([
        orderRepository.create({
          number: 'ORD-1001',
          userEmail: 'ada@example.com',
          status: OrderStatus.PENDING,
          total: 129.99,
        }),
        orderRepository.create({
          number: 'ORD-1002',
          userEmail: 'grace@example.com',
          status: OrderStatus.PAID,
          total: 349.5,
        }),
        orderRepository.create({
          number: 'ORD-1003',
          userEmail: 'linus@example.com',
          status: OrderStatus.CANCELLED,
          total: 79,
        }),
      ]);
    }
  }
}
