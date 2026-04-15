import 'reflect-metadata';
import { BadRequestException, Controller, Injectable, Module, Post, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { hashPassword, verifyPassword } from '../../examples/in-memory-demo-app/src/auth/password.js';
import { categoryAdminOptions } from '../../examples/shared/src/modules/category/shared.js';
import { orderAdminOptions } from '../../examples/shared/src/modules/order/shared.js';
import { productAdminOptions } from '../../examples/shared/src/modules/product/shared.js';
import { userAdminOptions } from '../../examples/shared/src/modules/user/shared.js';
import { InMemoryAdminAdapter, IN_MEMORY_ADMIN_STORE } from '../../src/admin/adapters/in-memory.adapter.js';
import { AdminModule } from '../../src/admin/admin.module.js';
import { AdminResource } from '../../src/admin/decorators/admin-resource.decorator.js';

const SEEDED_USERS = [
  {
    id: '1',
    email: 'ada@example.com',
    phone: '+1 206 555 0101',
    profileUrl: 'https://example.com/users/ada',
    role: 'admin',
    passwordHash: 'afa966a0e009d93ec6b84a85e18b6f05:6cad40e0c9109b42799f300763f58dfe4ed1bcbabe93ff5e4d3198e40e022617eb975b08d2edc6df14c2de5239d6eb965f7881d7c377687b69b0f2c77d152a9a',
    active: true,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-10T09:30:00.000Z',
  },
  {
    id: '2',
    email: 'grace@example.com',
    phone: '+1 206 555 0102',
    profileUrl: 'https://example.com/users/grace',
    role: 'editor',
    passwordHash: '023f35ca7d651fe4461ee1fc8832b017:1ceaeaa0045c7ecde39c002c4286bc4cd418b21afbebdd2a23eaa8cc8d4dff631a2bd3c05f6192f469f57785d1ce3b0322d140dde9efea26a27c0d6c2d7d4f4b',
    active: true,
    createdAt: '2026-04-05T10:30:00.000Z',
    updatedAt: '2026-04-11T11:05:00.000Z',
  },
  {
    id: '3',
    email: 'linus@example.com',
    phone: '+1 206 555 0103',
    profileUrl: 'https://example.com/users/linus',
    role: 'viewer',
    passwordHash: 'a6edd95f7ed30a5269c01d85ba56e2ae:52bc63660f38c953162ea6ea202f333db103258172f4ba1c79bccf9e0ee2b7a7dad5a41c32974aa6640af620acda9444da4b3886fbc091ed2486faa60be8ae62',
    active: false,
    createdAt: '2026-04-07T12:15:00.000Z',
    updatedAt: '2026-04-09T16:40:00.000Z',
  },
] as const;

const SEEDED_CATEGORIES = [
  {
    id: '401',
    name: 'Beverages',
    description: 'Soft drinks, coffees, teas, beers, and ales.',
    createdAt: '2026-04-03T07:40:00.000Z',
    updatedAt: '2026-04-10T07:40:00.000Z',
  },
  {
    id: '402',
    name: 'Condiments',
    description: 'Sweet and savory sauces, relishes, spreads, and seasonings.',
    createdAt: '2026-04-03T07:41:00.000Z',
    updatedAt: '2026-04-10T07:41:00.000Z',
  },
] as const;

const SEEDED_PRODUCTS = [
  {
    id: '201',
    sku: 'NW-001',
    name: 'Chai',
    unitPrice: 18,
    unitsInStock: 39,
    discontinued: false,
    deletedAt: null,
    categories: ['401'],
    createdAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-10T08:00:00.000Z',
  },
  {
    id: '202',
    sku: 'NW-010',
    name: 'Ikura',
    unitPrice: 31,
    unitsInStock: 20,
    discontinued: false,
    deletedAt: '2026-04-12T10:15:00.000Z',
    categories: ['402'],
    createdAt: '2026-04-03T08:30:00.000Z',
    updatedAt: '2026-04-12T10:15:00.000Z',
  },
] as const;

const SEEDED_ORDERS = [
  {
    id: '301',
    number: 'ORD-1001',
    orderDate: '2026-04-08T09:00:00.000Z',
    deliveryTime: '09:30',
    fulfillmentAt: null,
    userId: '1',
    status: 'pending',
    total: 42.5,
    internalNote: 'Priority',
    createdAt: '2026-04-08T09:00:00.000Z',
    updatedAt: '2026-04-08T09:00:00.000Z',
  },
  {
    id: '302',
    number: 'ORD-1002',
    orderDate: '2026-04-09T11:15:00.000Z',
    deliveryTime: '12:00',
    fulfillmentAt: null,
    userId: '2',
    status: 'pending',
    total: 19.99,
    internalNote: '',
    createdAt: '2026-04-09T11:15:00.000Z',
    updatedAt: '2026-04-09T11:15:00.000Z',
  },
] as const;

class TestUserModel {}
class TestCategoryModel {}
class TestProductModel {}
class TestOrderModel {}

class TestUserAdmin {}
Injectable()(TestUserAdmin);
AdminResource({
  model: TestUserModel,
  resourceName: 'users',
  ...userAdminOptions,
  password: {
    hash: hashPassword,
    helpText:
      'Raw passwords are not stored, so there is no way to see this user’s password. You can change the password using the dedicated form.',
  },
  transformCreate: async (payload) => {
    const password = String(payload.password ?? '');
    const passwordConfirm = String(payload.passwordConfirm ?? '');

    if (!password.trim()) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [{ field: 'password', constraints: { isDefined: 'Password is required' } }],
      });
    }

    if (password !== passwordConfirm) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [{ field: 'passwordConfirm', constraints: { matches: 'Passwords do not match' } }],
      });
    }

    const next = { ...payload };
    delete next.password;
    delete next.passwordConfirm;

    return {
      ...next,
      passwordHash: hashPassword(password),
    };
  },
})(TestUserAdmin);

class TestCategoryAdmin {}
Injectable()(TestCategoryAdmin);
AdminResource({
  model: TestCategoryModel,
  resourceName: 'categories',
  ...categoryAdminOptions,
})(TestCategoryAdmin);

class TestProductAdmin {}
Injectable()(TestProductAdmin);
AdminResource({
  model: TestProductModel,
  resourceName: 'products',
  ...productAdminOptions,
})(TestProductAdmin);

class TestOrderAdmin {}
Injectable()(TestOrderAdmin);
AdminResource({
  model: TestOrderModel,
  resourceName: 'orders',
  ...orderAdminOptions,
})(TestOrderAdmin);

class TestController {
  reset() {
    resetStore();
    return { success: true };
  }
}
Post('reset')(TestController.prototype, 'reset', Object.getOwnPropertyDescriptor(TestController.prototype, 'reset')!);
Controller('__test')(TestController);

class AdminE2EServerModule {}
Module({
  imports: [
    AdminModule.forRoot({
      path: '/admin',
      adapter: InMemoryAdminAdapter,
      display: {
        locale: 'en-US',
      },
      auth: {
        authenticate: async ({ email, password }) => {
          const user = IN_MEMORY_ADMIN_STORE.users.find((candidate) => String(candidate.email) === email);
          if (!user || user.active !== true) {
            return null;
          }

          if (!verifyPassword(password, String(user.passwordHash))) {
            return null;
          }

          return {
            id: String(user.id),
            role: String(user.role),
            email: String(user.email),
          };
        },
      },
    }),
  ],
  controllers: [TestController],
  providers: [TestUserAdmin, TestCategoryAdmin, TestProductAdmin, TestOrderAdmin],
})(AdminE2EServerModule);

async function bootstrap(): Promise<void> {
  resetStore();
  const app = await NestFactory.create(AdminE2EServerModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const port = Number(process.env['ADMIN_E2E_PORT'] ?? 3101);
  await app.listen(port, '127.0.0.1');
  process.stdout.write(`ADMIN_E2E_READY ${port}\n`);
}

function resetStore() {
  IN_MEMORY_ADMIN_STORE.users = SEEDED_USERS.map((user) => ({ ...user }));
  IN_MEMORY_ADMIN_STORE.categories = SEEDED_CATEGORIES.map((category) => ({ ...category }));
  IN_MEMORY_ADMIN_STORE.orders = SEEDED_ORDERS.map((order) => ({ ...order }));
  IN_MEMORY_ADMIN_STORE.products = SEEDED_PRODUCTS.map((product) => ({ ...product }));
  IN_MEMORY_ADMIN_STORE['order-details'] = [];
}

await bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
