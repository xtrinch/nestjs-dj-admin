import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import { hashPassword } from '../auth/password.js';
import { Category } from '../modules/category/category.entity.js';
import { OrderDetail } from '../modules/order-detail/order-detail.entity.js';
import { Order, OrderStatus } from '../modules/order/order.entity.js';
import { Product } from '../modules/product/product.entity.js';
import { Role, User } from '../modules/user/user.entity.js';

@Injectable()
export class DemoDataService implements OnApplicationBootstrap {
  constructor(private readonly orm: MikroORM) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async reset(): Promise<void> {
    await this.orm.em.getConnection().execute(`
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
  }

  private async seed(): Promise<void> {
    const em = this.orm.em.fork({ clear: true });
    const defaultUsers = [
      { email: 'ada@example.com', phone: '+1 206 555 0101', profileUrl: 'https://example.com/users/ada', role: Role.ADMIN, passwordHash: hashPassword('admin123'), active: true },
      { email: 'grace@example.com', phone: '+1 206 555 0102', profileUrl: 'https://example.com/users/grace', role: Role.EDITOR, passwordHash: hashPassword('editor123'), active: true },
      { email: 'linus@example.com', phone: '+1 206 555 0103', profileUrl: 'https://example.com/users/linus', role: Role.VIEWER, passwordHash: hashPassword('viewer123'), active: false },
    ];

    const savedUsers: User[] = [];
    for (const defaults of defaultUsers) {
      let user = await em.findOne(User, { email: defaults.email });

      if (!user) {
        user = em.create(User, defaults as never);
      } else if (!user.passwordHash || !user.phone || !user.profileUrl) {
        em.assign(user, {
          passwordHash: defaults.passwordHash,
          phone: defaults.phone,
          profileUrl: defaults.profileUrl,
        });
      }

      em.persist(user);
      savedUsers.push(user);
    }

    await em.flush();

    const minimumOrders = 22;
    const existingOrders = await em.count(Order, {});
    const savedOrders = await em.find(Order, {}, { orderBy: { id: 'asc' } });

    if (existingOrders < minimumOrders) {
      const statuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CANCELLED];

      for (let i = existingOrders; i < minimumOrders; i += 1) {
        const order = em.create(Order, {
          number: `ORD-${String(1001 + i)}`,
          orderDate: buildOrderDate(i),
          deliveryTime: buildDeliveryTime(i),
          fulfillmentAt: buildFulfillmentAt(i),
          userId: savedUsers[i % savedUsers.length]!.id,
          status: statuses[i % statuses.length]!,
          total: Number((79 + i * 17.35).toFixed(2)),
          internalNote: buildInternalNote(i),
        } as never);
        em.persist(order);
        savedOrders.push(order);
      }

      await em.flush();
    }

    const categoryDefs = buildDemoCategoryDefs();
    const savedCategories: Category[] = [];

    for (const [index, defaults] of categoryDefs.entries()) {
      let category = await em.findOne(Category, { name: defaults.name });
      if (!category) {
        category = em.create(Category, {
          ...defaults,
          createdById: savedUsers[index % savedUsers.length]!.id,
        } as never);
      }

      em.persist(category);
      savedCategories.push(category);
    }

    await em.flush();

    const minimumProducts = 12;
    const existingProducts = await em.count(Product, {});
    const savedProducts = await em.find(Product, {}, {
      orderBy: { id: 'asc' },
      populate: ['categories'],
    }) as Product[];

    if (existingProducts < minimumProducts) {
      const productDefs = buildDemoProductDefs();

      for (const productDef of productDefs.slice(existingProducts, minimumProducts)) {
        const product = em.create(Product, {
          sku: productDef.sku,
          name: productDef.name,
          unitPrice: productDef.unitPrice,
          unitsInStock: productDef.unitsInStock,
          discontinued: productDef.discontinued,
          deletedAt: productDef.sku === 'NW-012' ? new Date(Date.UTC(2026, 3, 12, 10, 15)) : null,
        } as never);
        product.categories.set(
          productDef.categoryNames
            .map((name) => savedCategories.find((category) => category.name === name))
            .filter((category): category is Category => Boolean(category)),
        );
        em.persist(product);
        savedProducts.push(product);
      }

      await em.flush();
    }

    const softDeletedProduct = await em.findOne(Product, { sku: 'NW-012' });
    if (softDeletedProduct && !softDeletedProduct.deletedAt) {
      softDeletedProduct.deletedAt = new Date(Date.UTC(2026, 3, 12, 10, 15));
      await em.flush();
    }

    const minimumOrderDetails = 36;
    const existingOrderDetails = await em.count(OrderDetail, {});

    if (existingOrderDetails < minimumOrderDetails) {
      for (let i = existingOrderDetails; i < minimumOrderDetails; i += 1) {
        const order = savedOrders[i % savedOrders.length]!;
        const product = savedProducts[(i * 2) % savedProducts.length]!;
        em.persist(em.create(OrderDetail, {
          orderId: order.id,
          productId: product.id,
          unitPrice: product.unitPrice,
          quantity: 1 + (i % 6),
          discount: [0, 0.05, 0.1][i % 3]!,
        } as never));
      }

      await em.flush();
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

  return notes[index % notes.length]!;
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
