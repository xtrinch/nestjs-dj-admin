import { DataSource } from 'typeorm';
import { Order } from '../modules/order/order.entity.js';
import { User } from '../modules/user/user.entity.js';

export const demoDataSource = new DataSource({
  type: (process.env.DB_TYPE as 'postgres' | 'mysql') ?? 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'nestjs_dj_admin_demo',
  entities: [User, Order],
  synchronize: true,
});
