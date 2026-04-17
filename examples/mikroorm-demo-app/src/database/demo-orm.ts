import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { AdminAuditLogEntity } from '../modules/admin-audit/admin-audit-log.entity.js';
import { Category } from '../modules/category/category.entity.js';
import { OrderDetail } from '../modules/order-detail/order-detail.entity.js';
import { Order } from '../modules/order/order.entity.js';
import { Product } from '../modules/product/product.entity.js';
import { User } from '../modules/user/user.entity.js';
import { Migration20260417000000InitialDemoSchema } from './migrations/Migration20260417000000InitialDemoSchema.js';

let demoOrmPromise: Promise<MikroORM> | null = null;

export async function initializeDemoOrm(): Promise<MikroORM> {
  if (!demoOrmPromise) {
    demoOrmPromise = (async () => {
      const orm = await MikroORM.init({
        host: process.env['DB_HOST'] ?? '127.0.0.1',
        port: Number(process.env['DB_PORT'] ?? 5432),
        user: process.env['DB_USER'] ?? 'postgres',
        password: process.env['DB_PASSWORD'] ?? 'postgres',
        dbName: process.env['DB_NAME'] ?? 'nestjs_dj_admin_mikroorm',
        entities: [User, Order, Category, Product, OrderDetail, AdminAuditLogEntity],
        metadataProvider: ReflectMetadataProvider,
        allowGlobalContext: true,
        extensions: [Migrator],
        migrations: {
          migrationsList: [Migration20260417000000InitialDemoSchema],
        },
      });

      await orm.migrator.up();
      return orm;
    })().catch((error) => {
      demoOrmPromise = null;
      throw error;
    });
  }

  return demoOrmPromise;
}
