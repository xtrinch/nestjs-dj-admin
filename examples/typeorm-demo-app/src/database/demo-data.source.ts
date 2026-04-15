import { DataSource } from 'typeorm';
import { Category } from '../modules/category/category.entity.js';
import { InitialDemoSchema1710000000000 } from './migrations/1710000000000-initial-demo-schema.js';
import { OrderDetail } from '../modules/order-detail/order-detail.entity.js';
import { Order } from '../modules/order/order.entity.js';
import { Product } from '../modules/product/product.entity.js';
import { User } from '../modules/user/user.entity.js';

export const demoDataSource = new DataSource({
  type: (process.env.DB_TYPE as 'postgres' | 'mysql') ?? 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'nestjs_dj_admin_demo',
  entities: [User, Order, Category, Product, OrderDetail],
  migrations: [InitialDemoSchema1710000000000],
  synchronize: false,
});

let initializePromise: Promise<DataSource> | null = null;

export async function initializeDemoDataSource(): Promise<DataSource> {
  if (demoDataSource.isInitialized) {
    return demoDataSource;
  }

  if (!initializePromise) {
    initializePromise = (async () => {
      await demoDataSource.initialize();
      await demoDataSource.runMigrations();
      return demoDataSource;
    })().catch((error) => {
      initializePromise = null;
      throw error;
    });
  }

  return initializePromise;
}
