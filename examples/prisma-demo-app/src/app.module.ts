import { Module } from '@nestjs/common';
import { ADMIN_ADAPTER } from '#src/admin/admin.constants.js';
import { PrismaAdminAdapter } from '#src/admin/adapters/prisma.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './auth/password.js';
import { DEFAULT_PRISMA_DATABASE_URL } from '../prisma.config.js';
import { DemoDataService } from './database/demo-data.service.js';
import { DemoTestController } from './database/demo-test.controller.js';
import { PrismaAdminAuditStore } from './modules/admin-audit/prisma-admin-audit.store.js';
import { CategoryModule } from './modules/category/category.module.js';
import { OrderDetailModule } from './modules/order-detail/order-detail.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { Role } from './modules/user/user.entity.js';
import { UserModule } from './modules/user/user.module.js';

const connectionString = process.env['DATABASE_URL'] ?? DEFAULT_PRISMA_DATABASE_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

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
          const user = await prisma.user.findUnique({
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
        enabled: true,
        store: new PrismaAdminAuditStore(prisma),
      },
    }),
  ],
  controllers: [DemoTestController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: async () => {
        await prisma.$connect();
        return prisma;
      },
    },
    {
      provide: ADMIN_ADAPTER,
      useFactory: (prisma: PrismaClient) => new PrismaAdminAdapter(prisma),
      inject: [PrismaClient],
    },
    DemoDataService,
  ],
})
export class AppModule {}
