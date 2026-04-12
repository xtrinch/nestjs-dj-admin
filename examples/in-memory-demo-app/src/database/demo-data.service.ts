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
    const minimumOrders = 22;
    const existingOrders = await orderRepository.count();

    if (existingOrders < minimumOrders) {
      const ordersToSeed = buildDemoOrders().slice(existingOrders, minimumOrders);
      await orderRepository.save(ordersToSeed.map((order) => orderRepository.create(order)));
    }
  }
}

function buildDemoOrders(): Array<{
  number: string;
  userEmail: string;
  status: OrderStatus;
  total: number;
}> {
  const users = ['ada@example.com', 'grace@example.com', 'linus@example.com'];
  const statuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CANCELLED];

  return Array.from({ length: 24 }, (_, index) => ({
    number: `ORD-${String(1001 + index)}`,
    userEmail: users[index % users.length],
    status: statuses[index % statuses.length],
    total: Number((79 + index * 17.35).toFixed(2)),
  }));
}
