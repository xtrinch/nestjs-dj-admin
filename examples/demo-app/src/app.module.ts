import { Module } from '@nestjs/common';
import { ADMIN_ADAPTER } from '#src/admin/admin.constants.js';
import { TypeOrmAdminAdapter } from '#src/admin/adapters/typeorm.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { verifyPassword } from './auth/password.js';
import { DataSource } from 'typeorm';
import { demoDataSource } from './database/demo-data.source.js';
import { DemoDataService } from './database/demo-data.service.js';
import { OrderModule } from './modules/order/order.module.js';
import { Role, User } from './modules/user/user.entity.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [
    OrderModule,
    UserModule,
    AdminModule.forRoot({
      path: '/admin',
      auth: {
        authenticate: async ({ email, password }) => {
          if (!demoDataSource.isInitialized) {
            await demoDataSource.initialize();
          }

          const user = await demoDataSource.getRepository(User).findOne({
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
    }),
  ],
  providers: [
    {
      provide: DataSource,
      useFactory: async () => {
        if (!demoDataSource.isInitialized) {
          await demoDataSource.initialize();
        }

        return demoDataSource;
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
