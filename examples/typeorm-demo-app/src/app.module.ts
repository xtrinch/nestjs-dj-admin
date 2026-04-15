import { Module } from '@nestjs/common';
import { ADMIN_ADAPTER } from '#src/admin/admin.constants.js';
import { TypeOrmAdminAdapter } from '#src/admin/adapters/typeorm.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { verifyPassword } from './auth/password.js';
import { DataSource } from 'typeorm';
import { initializeDemoDataSource } from './database/demo-data.source.js';
import { DemoDataService } from './database/demo-data.service.js';
import { TypeOrmAdminAuditStore } from './modules/admin-audit/typeorm-admin-audit.store.js';
import { CategoryModule } from './modules/category/category.module.js';
import { OrderDetailModule } from './modules/order-detail/order-detail.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { Role, User } from './modules/user/user.entity.js';
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
          const dataSource = await initializeDemoDataSource();

          const user = await dataSource.getRepository(User).findOne({
            where: { email },
          });

          if (!user || !user.active || user.role !== Role.ADMIN) {
            return null;
          }

          if (!verifyPassword(password, user.passwordHash)) {
            return null;
          }

          return {
            id: String(user.id),
            role: user.role,
            email: user.email,
          };
        },
      },
      auditLog: {
        store: new TypeOrmAdminAuditStore(() => initializeDemoDataSource()),
      },
    }),
  ],
  providers: [
    {
      provide: DataSource,
      useFactory: async () => {
        return initializeDemoDataSource();
      },
    },
    {
      provide: ADMIN_ADAPTER,
      useFactory: (dataSource: DataSource) => new TypeOrmAdminAdapter(dataSource),
      inject: [DataSource],
    },
    DemoDataService,
  ],
})
export class AppModule {}
