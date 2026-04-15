import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { OrderStatus } from '../../modules/order/order.entity.js';
import { Role } from '../../modules/user/user.entity.js';

export class InitialDemoSchema1710000000000 implements MigrationInterface {
  name = 'InitialDemoSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'email', type: 'varchar', isUnique: true },
          { name: 'phone', type: 'varchar', default: queryRunner.connection.options.type === 'postgres' ? "''" : "''" },
          { name: 'profileUrl', type: 'varchar', default: queryRunner.connection.options.type === 'postgres' ? "''" : "''" },
          { name: 'role', type: 'enum', enum: Object.values(Role), enumName: 'users_role_enum' },
          { name: 'passwordHash', type: 'varchar' },
          { name: 'active', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'categories',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'name', type: 'varchar', isUnique: true },
          { name: 'description', type: 'varchar', default: queryRunner.connection.options.type === 'postgres' ? "''" : "''" },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'sku', type: 'varchar', isUnique: true },
          { name: 'name', type: 'varchar' },
          { name: 'unitPrice', type: 'decimal', precision: 10, scale: 2 },
          { name: 'unitsInStock', type: 'int', default: 0 },
          { name: 'discontinued', type: 'boolean', default: false },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'number', type: 'varchar', isUnique: true },
          { name: 'orderDate', type: 'date' },
          { name: 'deliveryTime', type: 'time', isNullable: true },
          { name: 'fulfillmentAt', type: 'timestamp', isNullable: true },
          { name: 'userId', type: 'int' },
          { name: 'status', type: 'enum', enum: Object.values(OrderStatus), enumName: 'orders_status_enum' },
          { name: 'total', type: 'decimal', precision: 10, scale: 2 },
          { name: 'internalNote', type: 'text', default: queryRunner.connection.options.type === 'postgres' ? "''" : "''" },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_orders_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'order_details',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'orderId', type: 'int' },
          { name: 'productId', type: 'int' },
          { name: 'unitPrice', type: 'decimal', precision: 10, scale: 2 },
          { name: 'quantity', type: 'int' },
          { name: 'discount', type: 'decimal', precision: 4, scale: 2, default: 0 },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'order_details',
      new TableIndex({
        name: 'IDX_order_details_orderId',
        columnNames: ['orderId'],
      }),
    );

    await queryRunner.createIndex(
      'order_details',
      new TableIndex({
        name: 'IDX_order_details_productId',
        columnNames: ['productId'],
      }),
    );

    await queryRunner.createForeignKey(
      'order_details',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'order_details',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_categories',
        columns: [
          { name: 'productId', type: 'int', isPrimary: true },
          { name: 'categoryId', type: 'int', isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'product_categories',
      new TableIndex({
        name: 'IDX_product_categories_productId',
        columnNames: ['productId'],
      }),
    );

    await queryRunner.createIndex(
      'product_categories',
      new TableIndex({
        name: 'IDX_product_categories_categoryId',
        columnNames: ['categoryId'],
      }),
    );

    await queryRunner.createForeignKey(
      'product_categories',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'product_categories',
      new TableForeignKey({
        columnNames: ['categoryId'],
        referencedTableName: 'categories',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_categories', true);
    await queryRunner.dropTable('order_details', true);
    await queryRunner.dropTable('orders', true);
    await queryRunner.dropTable('products', true);
    await queryRunner.dropTable('categories', true);
    await queryRunner.dropTable('users', true);
  }
}
