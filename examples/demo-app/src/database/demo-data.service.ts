import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/password.js';
import { Order, OrderStatus } from '../modules/order/order.entity.js';
import { Role, User } from '../modules/user/user.entity.js';

@Injectable()
export class DemoDataService implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    const defaultUsers = [
      {
        email: 'ada@example.com',
        role: Role.ADMIN,
        passwordHash: hashPassword('admin123'),
        active: true,
      },
      {
        email: 'grace@example.com',
        role: Role.EDITOR,
        passwordHash: hashPassword('editor123'),
        active: true,
      },
      {
        email: 'linus@example.com',
        role: Role.VIEWER,
        passwordHash: hashPassword('viewer123'),
        active: false,
      },
    ];

    for (const defaults of defaultUsers) {
      const existing = await userRepository.findOne({
        where: { email: defaults.email },
      });

      if (!existing) {
        await userRepository.save(userRepository.create(defaults));
        continue;
      }

      if (!existing.passwordHash) {
        existing.passwordHash = defaults.passwordHash;
        await userRepository.save(existing);
      }
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
