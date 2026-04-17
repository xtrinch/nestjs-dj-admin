import { Module } from '@nestjs/common';
import { InMemoryAdminAdapter } from '#src/admin/adapters/in-memory.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { DEMO_PERMISSIONS } from '#examples-shared/admin-permissions.js';
import { DEMO_IN_MEMORY_ADMIN_STORE } from '#examples-shared/in-memory-demo-store.js';
import { CategoryModule } from '../../in-memory-demo-app/src/modules/category/category.module.js';
import { OrderDetailModule } from '../../in-memory-demo-app/src/modules/order-detail/order-detail.module.js';
import { OrderModule } from '../../in-memory-demo-app/src/modules/order/order.module.js';
import { ProductModule } from '../../in-memory-demo-app/src/modules/product/product.module.js';
import { UserModule } from '../../in-memory-demo-app/src/modules/user/user.module.js';
import { AdminAccessGuard, HostAuthController, HostSessionGuard, clearHostSession } from './host-auth.js';

const externalAuthReturnUrl = process.env['EXTERNAL_AUTH_RETURN_URL'] ?? 'http://localhost:5173/admin/';
const externalAuthLoginUrl = `/host-auth/login?next=${encodeURIComponent(externalAuthReturnUrl)}`;

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
        permissions: {
          read: [DEMO_PERMISSIONS.audit.read],
        },
      },
      auth: {
        mode: 'external',
        guards: [HostSessionGuard, AdminAccessGuard],
        resolveUser: (request) => {
          if (!request.user?.permissions) {
            return null;
          }

          return {
            id: request.user.id,
            email: request.user.email,
            permissions: request.user.permissions,
            isSuperuser: request.user.isSuperuser,
          };
        },
        loginUrl: externalAuthLoginUrl,
        loginMessage: 'Use the host application session to enter the admin.',
        logout: (request, response) => {
          clearHostSession(request, response);
        },
      },
    }),
  ],
  controllers: [HostAuthController],
  providers: [HostSessionGuard, AdminAccessGuard],
})
export class AppModule {}
