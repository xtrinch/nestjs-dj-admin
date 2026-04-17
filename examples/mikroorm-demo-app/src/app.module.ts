import { Module } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { ADMIN_ADAPTER } from '#src/admin/admin.constants.js';
import { MikroOrmAdminAdapter } from '#src/admin/adapters/mikroorm.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { verifyPassword } from './auth/password.js';
import { DemoDataService } from './database/demo-data.service.js';
import { initializeDemoOrm } from './database/demo-orm.js';
import { DemoTestController } from './database/demo-test.controller.js';
import { MikroOrmAdminAuditStore } from './modules/admin-audit/mikroorm-admin-audit.store.js';
import { CategoryModule } from './modules/category/category.module.js';
import { OrderDetailModule } from './modules/order-detail/order-detail.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { Role, User } from './modules/user/user.entity.js';
import { UserModule } from './modules/user/user.module.js';
import { DEMO_PERMISSIONS, permissionsForDemoRole } from '../../shared/src/admin-permissions.js';

@Module({
  imports: [
    CategoryModule,
    OrderDetailModule,
    OrderModule,
    ProductModule,
    UserModule,
    AdminModule.forRoot({
      path: '/admin',
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
      auth: {
        authenticate: async ({ email, password }) => {
          const orm = await initializeDemoOrm();
          const user = await orm.em.fork({ clear: true }).findOne(User, { email });

          if (!user || !user.active) {
            return null;
          }

          if (!verifyPassword(password, user.passwordHash)) {
            return null;
          }

          return {
            id: String(user.id),
            permissions: permissionsForDemoRole(user.role),
            email: user.email,
            isSuperuser: user.role === Role.ADMIN,
          };
        },
      },
      auditLog: {
        enabled: true,
        permissions: {
          read: [DEMO_PERMISSIONS.audit.read],
        },
        store: new MikroOrmAdminAuditStore(() => initializeDemoOrm()),
      },
    }),
  ],
  controllers: [DemoTestController],
  providers: [
    {
      provide: MikroORM,
      useFactory: async () => initializeDemoOrm(),
    },
    {
      provide: EntityManager,
      useFactory: (orm: MikroORM) => orm.em,
      inject: [MikroORM],
    },
    {
      provide: ADMIN_ADAPTER,
      useFactory: (entityManager: EntityManager) => new MikroOrmAdminAdapter(entityManager),
      inject: [EntityManager],
    },
    DemoDataService,
  ],
})
export class AppModule {}
