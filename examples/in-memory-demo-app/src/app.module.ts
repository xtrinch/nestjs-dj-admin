import { Module } from '@nestjs/common';
import { InMemoryAdminAdapter } from '#src/admin/adapters/in-memory.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { CategoryModule } from './modules/category/category.module.js';
import { OrderDetailModule } from './modules/order-detail/order-detail.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { UserModule } from './modules/user/user.module.js';

const DEMO_USERS = [
  {
    id: '1',
    email: 'ada@example.com',
    password: 'admin123',
    role: 'admin',
    active: true,
  },
];

@Module({
  imports: [
    CategoryModule,
    OrderDetailModule,
    OrderModule,
    ProductModule,
    UserModule,
    AdminModule.forRoot({
      path: '/admin',
      adapter: InMemoryAdminAdapter,
      display: {
        locale: 'en-US',
        dateFormat: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
        dateTimeFormat: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        },
      },
      auth: {
        authenticate: async ({ email, password }) => {
          const user = DEMO_USERS.find((candidate) => candidate.email === email);

          if (!user || !user.active || user.role !== 'admin') {
            return null;
          }

          if (password !== user.password) {
            return null;
          }

          return {
            id: user.id,
            role: user.role,
            email: user.email,
          };
        },
      },
    }),
  ],
  providers: [],
})
export class AppModule {}
