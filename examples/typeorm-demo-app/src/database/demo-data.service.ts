import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Category } from '../modules/category/category.entity.js';
import { DataSource } from 'typeorm';
import { OrderDetail } from '../modules/order-detail/order-detail.entity.js';
import { hashPassword } from '../auth/password.js';
import { Order, OrderStatus } from '../modules/order/order.entity.js';
import { Product } from '../modules/product/product.entity.js';
import { DemoQueueService } from '../queues/demo-queue.service.js';
import { Role, User } from '../modules/user/user.entity.js';

@Injectable()
export class DemoDataService implements OnApplicationBootstrap {
  constructor(
    private readonly dataSource: DataSource,
    private readonly demoQueueService: DemoQueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
    await this.demoQueueService.reset();
  }

  async reset(): Promise<void> {
    await this.dataSource.query(`
      TRUNCATE TABLE
        "admin_audit_logs",
        "order_details",
        "product_categories",
        "orders",
        "products",
        "categories",
        "users"
      RESTART IDENTITY CASCADE
    `);
    await this.seed();
    await this.demoQueueService.reset();
  }

  private async seed(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    const defaultUsers = [
      { email: 'ada@example.com', phone: '+1 206 555 0101', profileUrl: 'https://example.com/users/ada', role: Role.ADMIN, passwordHash: hashPassword('admin123'), active: true },
      { email: 'grace@example.com', phone: '+1 206 555 0102', profileUrl: 'https://example.com/users/grace', role: Role.EDITOR, passwordHash: hashPassword('editor123'), active: true },
      { email: 'linus@example.com', phone: '+1 206 555 0103', profileUrl: 'https://example.com/users/linus', role: Role.VIEWER, passwordHash: hashPassword('viewer123'), active: false },
    ];

    const savedUsers: User[] = [];
    for (const defaults of defaultUsers) {
      let user = await userRepository.findOne({ where: { email: defaults.email } });
      if (!user) {
        user = await userRepository.save(userRepository.create(defaults));
      } else if (!user.passwordHash || !user.phone || !user.profileUrl) {
        user.passwordHash = defaults.passwordHash;
        user.phone = defaults.phone;
        user.profileUrl = defaults.profileUrl;
        user = await userRepository.save(user);
      }
      savedUsers.push(user);
    }

    const orderRepository = this.dataSource.getRepository(Order);
    const minimumOrders = 22;
    const existingOrders = await orderRepository.count();

    const savedOrders: Order[] = await orderRepository.find({ order: { id: 'ASC' } });

    if (existingOrders < minimumOrders) {
      const statuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CANCELLED];
      const ordersToSeed = Array.from({ length: minimumOrders - existingOrders }, (_, i) => {
        const index = existingOrders + i;
        return orderRepository.create({
          number: `ORD-${String(1001 + index)}`,
          orderDate: buildOrderDate(index),
          deliveryTime: buildDeliveryTime(index),
          fulfillmentAt: buildFulfillmentAt(index),
          userId: savedUsers[index % savedUsers.length].id,
          status: statuses[index % statuses.length],
          total: Number((79 + index * 17.35).toFixed(2)),
          internalNote: buildInternalNote(index),
        });
      });
      const newOrders = await orderRepository.save(ordersToSeed);
      savedOrders.push(...newOrders);
    }

    const productRepository = this.dataSource.getRepository(Product);
    const categoryRepository = this.dataSource.getRepository(Category);
    const categoryDefs = buildDemoCategoryDefs();
    const savedCategories: Category[] = [];

    for (const [index, defaults] of categoryDefs.entries()) {
      let category = await categoryRepository.findOne({ where: { name: defaults.name } });
      if (!category) {
        category = await categoryRepository.save(categoryRepository.create({
          ...defaults,
          createdById: savedUsers[index % savedUsers.length]!.id,
        }));
      }
      savedCategories.push(category);
    }

    const minimumProducts = 12;
    const existingProducts = await productRepository.count();

    const savedProducts: Product[] = await productRepository.find({
      order: { id: 'ASC' },
      relations: ['categories'],
    });

    if (existingProducts < minimumProducts) {
      const productDefs = buildDemoProductDefs();
      const productsToSeed = productDefs.slice(existingProducts, minimumProducts).map((p) =>
        productRepository.create({
          ...p,
          deletedAt: p.sku === 'NW-012' ? new Date(Date.UTC(2026, 3, 12, 10, 15)) : null,
          categories: p.categoryNames
            .map((name) => savedCategories.find((category) => category.name === name))
            .filter(Boolean) as Category[],
        }),
      );
      const newProducts = await productRepository.save(productsToSeed);
      savedProducts.push(...newProducts);
    }

    const softDeletedProduct = await productRepository.findOne({ where: { sku: 'NW-012' } });
    if (softDeletedProduct && !softDeletedProduct.deletedAt) {
      softDeletedProduct.deletedAt = new Date(Date.UTC(2026, 3, 12, 10, 15));
      await productRepository.save(softDeletedProduct);
    }

    const orderDetailRepository = this.dataSource.getRepository(OrderDetail);
    const minimumOrderDetails = 36;
    const existingOrderDetails = await orderDetailRepository.count();

    if (existingOrderDetails < minimumOrderDetails) {
      const orderDetailsToSeed = Array.from(
        { length: minimumOrderDetails - existingOrderDetails },
        (_, i) => {
          const index = existingOrderDetails + i;
          const order = savedOrders[index % savedOrders.length];
          const product = savedProducts[(index * 2) % savedProducts.length];
          return orderDetailRepository.create({
            orderId: order.id,
            productId: product.id,
            unitPrice: product.unitPrice,
            quantity: 1 + (index % 6),
            discount: [0, 0.05, 0.1][index % 3],
          });
        },
      );
      await orderDetailRepository.save(orderDetailsToSeed);
    }
  }
}

function buildOrderDate(index: number): string {
  const date = new Date(Date.UTC(2026, 3, 1 + (index % 28)));
  return date.toISOString().slice(0, 10);
}

function buildFulfillmentAt(index: number): Date | null {
  if (index % 4 === 0) {
    return null;
  }

  return new Date(Date.UTC(2026, 3, 1 + (index % 28), 9 + (index % 8), 30));
}

function buildDeliveryTime(index: number): string | null {
  if (index % 5 === 0) {
    return null;
  }

  const hour = 8 + (index % 9);
  const minute = index % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function buildInternalNote(index: number): string {
  const notes = [
    'Call before delivery.',
    'Gift order. Do not include invoice in the parcel.',
    'Customer requested split fulfillment if stock is low.',
    '',
  ];

  return notes[index % notes.length];
}

function buildDemoProductDefs(): Array<{
  sku: string;
  name: string;
  categoryNames: string[];
  unitPrice: number;
  unitsInStock: number;
  discontinued: boolean;
}> {
  const products = [
    ['NW-001', 'Chai', ['Beverages']],
    ['NW-002', 'Chang', ['Beverages']],
    ['NW-003', 'Aniseed Syrup', ['Condiments']],
    ['NW-004', 'Chef Anton Gumbo Mix', ['Condiments']],
    ['NW-005', 'Grandmas Boysenberry Spread', ['Condiments']],
    ['NW-006', 'Chocolate Biscuits', ['Confections']],
    ['NW-007', 'Scottish Longbreads', ['Confections']],
    ['NW-008', 'Dried Pears', ['Produce']],
    ['NW-009', 'Tofu', ['Produce']],
    ['NW-010', 'Ikura', ['Seafood']],
    ['NW-011', 'Konbu', ['Seafood']],
    ['NW-012', 'Boston Crab Meat', ['Seafood', 'Condiments']],
  ] as const;

  return products.map(([sku, name, categoryNames], index) => ({
    sku,
    name,
    categoryNames: [...categoryNames],
    unitPrice: Number((12.5 + index * 3.85).toFixed(2)),
    unitsInStock: 8 + index * 3,
    discontinued: index === products.length - 1,
  }));
}

function buildDemoCategoryDefs(): Array<{ name: string; description: string }> {
  return [
    { name: 'Beverages', description: 'Soft drinks, coffees, teas, beers, and ales.' },
    { name: 'Condiments', description: 'Sweet and savory sauces, relishes, spreads, and seasonings.' },
    { name: 'Confections', description: 'Desserts, candies, and sweet baked goods.' },
    { name: 'Produce', description: 'Dried fruit and bean curd.' },
    { name: 'Seafood', description: 'Seaweed and fish products.' },
  ];
}
