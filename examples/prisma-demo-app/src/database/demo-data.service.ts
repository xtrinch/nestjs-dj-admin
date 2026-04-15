import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../auth/password.js';
import { OrderStatus } from '../modules/order/order.entity.js';
import { Role } from '../modules/user/user.entity.js';

@Injectable()
export class DemoDataService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaClient) {}

  async onApplicationBootstrap(): Promise<void> {
    const defaultUsers = [
      { email: 'ada@example.com', phone: '+1 206 555 0101', profileUrl: 'https://example.com/users/ada', role: Role.ADMIN, passwordHash: hashPassword('admin123'), active: true },
      { email: 'grace@example.com', phone: '+1 206 555 0102', profileUrl: 'https://example.com/users/grace', role: Role.EDITOR, passwordHash: hashPassword('editor123'), active: true },
      { email: 'linus@example.com', phone: '+1 206 555 0103', profileUrl: 'https://example.com/users/linus', role: Role.VIEWER, passwordHash: hashPassword('viewer123'), active: false },
    ];

    for (const defaults of defaultUsers) {
      const existing = await this.prisma.user.findUnique({ where: { email: defaults.email } });
      if (!existing) {
        await this.prisma.user.create({ data: defaults as never });
      } else if (
        !existing.passwordHash ||
        !(existing as Record<string, unknown>).phone ||
        !(existing as Record<string, unknown>).profileUrl
      ) {
        await this.prisma.user.update({
          where: { email: defaults.email },
          data: {
            passwordHash: defaults.passwordHash,
            phone: defaults.phone,
            profileUrl: defaults.profileUrl,
          } as never,
        });
      }
    }

    const savedUsers = await this.prisma.user.findMany({ orderBy: { id: 'asc' } });

    const minimumOrders = 22;
    const existingOrders = await this.prisma.order.count();

    if (existingOrders < minimumOrders) {
      const statuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CANCELLED];
      const ordersToSeed = Array.from({ length: minimumOrders - existingOrders }, (_, i) => {
        const index = existingOrders + i;
        return {
          number: `ORD-${String(1001 + index)}`,
          orderDate: buildOrderDate(index),
          deliveryTime: buildDeliveryTime(index),
          fulfillmentAt: buildFulfillmentAt(index),
          userId: savedUsers[index % savedUsers.length].id,
          status: statuses[index % statuses.length],
          total: Number((79 + index * 17.35).toFixed(2)),
          internalNote: buildInternalNote(index),
        };
      });
      await this.prisma.order.createMany({ data: ordersToSeed, skipDuplicates: true });
    }

    const categoryDefs = buildDemoCategoryDefs();
    for (const defaults of categoryDefs) {
      const existing = await this.prisma.category.findUnique({ where: { name: defaults.name } });
      if (!existing) {
        await this.prisma.category.create({ data: defaults });
      }
    }

    const savedCategories = await this.prisma.category.findMany({ orderBy: { id: 'asc' } });
    const minimumProducts = 12;
    const existingProducts = await this.prisma.product.count();

    if (existingProducts < minimumProducts) {
      const productDefs = buildDemoProductDefs().slice(existingProducts, minimumProducts);
      for (const product of productDefs) {
        await this.prisma.product.create({
          data: {
            sku: product.sku,
            name: product.name,
            unitPrice: product.unitPrice,
            unitsInStock: product.unitsInStock,
            discontinued: product.discontinued,
            deletedAt: product.sku === 'NW-012' ? new Date(Date.UTC(2026, 3, 12, 10, 15)) : null,
            categories: {
              connect: product.categoryNames
                .map((name) => savedCategories.find((category) => category.name === name))
                .filter(Boolean)
                .map((category) => ({ id: category!.id })),
            },
          },
        });
      }
    }

    const softDeletedProduct = await this.prisma.product.findUnique({
      where: { sku: 'NW-012' },
    });
    if (softDeletedProduct && !softDeletedProduct.deletedAt) {
      await this.prisma.product.update({
        where: { sku: 'NW-012' },
        data: {
          deletedAt: new Date(Date.UTC(2026, 3, 12, 10, 15)),
        },
      });
    }

    const savedOrders = await this.prisma.order.findMany({ orderBy: { id: 'asc' } });
    const savedProducts = await this.prisma.product.findMany({ orderBy: { id: 'asc' } });

    const minimumOrderDetails = 36;
    const existingOrderDetails = await this.prisma.orderDetail.count();

    if (existingOrderDetails < minimumOrderDetails) {
      const orderDetailsToSeed = Array.from(
        { length: minimumOrderDetails - existingOrderDetails },
        (_, i) => {
          const index = existingOrderDetails + i;
          const order = savedOrders[index % savedOrders.length];
          const product = savedProducts[(index * 2) % savedProducts.length];
          return {
            orderId: order.id,
            productId: product.id,
            unitPrice: product.unitPrice,
            quantity: 1 + (index % 6),
            discount: [0, 0.05, 0.1][index % 3],
          };
        },
      );
      await this.prisma.orderDetail.createMany({ data: orderDetailsToSeed, skipDuplicates: false });
    }
  }
}

function buildOrderDate(index: number): Date {
  return new Date(Date.UTC(2026, 3, 1 + (index % 28)));
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
