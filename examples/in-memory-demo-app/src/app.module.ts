import { Module } from '@nestjs/common';
import { InMemoryAdminAdapter } from '#src/admin/adapters/in-memory.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { DEMO_IN_MEMORY_ADMIN_STORE } from '#examples-shared/in-memory-demo-store.js';
import { verifyPassword } from './auth/password.js';
import { CategoryModule } from './modules/category/category.module.js';
import { OrderDetailModule } from './modules/order-detail/order-detail.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [
    CategoryModule,
    OrderDetailModule,
    OrderModule,
    ProductModule,
    UserModule,
    AdminModule.forRoot({
      path: '/admin',
      adapter: {
        useFactory: () => new InMemoryAdminAdapter(DEMO_IN_MEMORY_ADMIN_STORE),
      },
      branding: {
        siteHeader: 'Northwind Admin',
        siteTitle: 'Northwind Admin',
        indexTitle: 'Northwind administration',
        accentColor: '#7aa37a',
      },
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
      auditLog: {
        enabled: true,
      },
      auth: {
        authenticate: async ({ email, password }) => {
          const user = DEMO_IN_MEMORY_ADMIN_STORE.users.find(
            (candidate) => String(candidate.email ?? '') === email,
          );

          if (!user || user.active !== true || user.role !== 'admin') {
            return null;
          }

          if (!verifyPassword(password, String(user.passwordHash ?? ''))) {
            return null;
          }

          return {
            id: String(user.id),
            roles: [String(user.role)],
            email: String(user.email),
          };
        },
      },
    }),
  ],
  providers: [],
})
export class AppModule {}
