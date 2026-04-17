import { Module } from '@nestjs/common';
import { InMemoryAdminAdapter } from '#src/admin/adapters/in-memory.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { CategoryModule } from '../../in-memory-demo-app/src/modules/category/category.module.js';
import { OrderDetailModule } from '../../in-memory-demo-app/src/modules/order-detail/order-detail.module.js';
import { OrderModule } from '../../in-memory-demo-app/src/modules/order/order.module.js';
import { ProductModule } from '../../in-memory-demo-app/src/modules/product/product.module.js';
import { UserModule } from '../../in-memory-demo-app/src/modules/user/user.module.js';
import { HostAuthController, HostSessionGuard, clearHostSession } from './host-auth.js';

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
        mode: 'external',
        guards: [HostSessionGuard],
        resolveUser: (request) => request.user ?? null,
        loginUrl: '/host-auth/login?next=/admin',
        loginMessage: 'Use the host application session to enter the admin.',
        logout: (request, response) => {
          clearHostSession(request, response);
        },
      },
    }),
  ],
  controllers: [HostAuthController],
  providers: [HostSessionGuard],
})
export class AppModule {}
