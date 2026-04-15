# nestjs-dj-admin

NestJS-native admin framework inspired by Django admin, packaged as an npm library.

It gives you:

- server-side resource registration
- DTO-driven form metadata
- list, create, edit, delete, and lookup endpoints
- bundled admin UI assets
- TypeORM, Prisma, and in-memory adapter support

The example apps deliberately use a small back-office dataset derived from Northwind rather than a todo-style domain. Shared example primitives live in `examples/shared`, while each demo app keeps its own ORM-specific model classes and thin `*.admin.ts` wrappers.

## Quickstart

Install the package plus the Nest and validation dependencies it expects:

```bash
npm install nestjs-dj-admin @nestjs/common @nestjs/core @nestjs/platform-express class-validator class-transformer reflect-metadata rxjs
```

Then mount the admin module and provide an adapter:

```ts
import { Module } from '@nestjs/common';
import { ADMIN_ADAPTER, AdminModule, TypeOrmAdminAdapter } from 'nestjs-dj-admin';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    AdminModule.forRoot({
      path: '/admin',
    }),
  ],
  providers: [
    {
      provide: ADMIN_ADAPTER,
      useFactory: (dataSource: DataSource) => new TypeOrmAdminAdapter(dataSource),
      inject: [DataSource],
    },
  ],
})
export class AppModule {}
```

Register at least one resource:

```ts
import { Injectable } from '@nestjs/common';
import { AdminResource } from 'nestjs-dj-admin';
import { User } from './user.entity.js';

@Injectable()
@AdminResource({
  model: User,
  list: ['id', 'email', 'role', 'active', 'createdAt'],
  search: ['email'],
  filters: ['role', 'active'],
  readonly: ['createdAt'],
})
export class UserAdmin {}
```

Build the library UI assets and start your app. The admin API and UI will be mounted at the `path` you configured, such as `/admin`.

## Public API

The root package exports the core module, decorator, constants, adapters, and the main public types:

```ts
import {
  ADMIN_ADAPTER,
  AdminField,
  AdminModule,
  AdminResource,
  InMemoryAdminAdapter,
  PrismaAdminAdapter,
  TypeOrmAdminAdapter,
} from 'nestjs-dj-admin';
```

The complete barrel lives in [src/index.ts](/Users/mojca/repos/nestjs-dj-admin/src/index.ts).

## Auth Integration

`nestjs-dj-admin` does not implement your real user model or password policy. You provide an `authenticate` function, and the admin module manages the session cookie around it.

```ts
AdminModule.forRoot({
  path: '/admin',
  auth: {
    authenticate: async ({ email, password }, request) => {
      const user = await usersService.findByEmail(email);

      if (!user || !user.isAdmin) {
        return null;
      }

      const ok = await passwords.verify(password, user.passwordHash);
      if (!ok) {
        return null;
      }

      return {
        id: String(user.id),
        role: user.role,
        email: user.email,
      };
    },
  },
});
```

Auth options currently include:

- `cookieName`
- `rememberMeMaxAgeMs`
- `authenticate(credentials, request)`

The examples show the full pattern in:

- [examples/typeorm-demo-app/src/app.module.ts](/Users/mojca/repos/nestjs-dj-admin/examples/typeorm-demo-app/src/app.module.ts)
- [examples/prisma-demo-app/src/app.module.ts](/Users/mojca/repos/nestjs-dj-admin/examples/prisma-demo-app/src/app.module.ts)
- [examples/in-memory-demo-app/src/app.module.ts](/Users/mojca/repos/nestjs-dj-admin/examples/in-memory-demo-app/src/app.module.ts)

## Resource Registration

Resources are discovered from providers decorated with `@AdminResource(...)`.

The resource options define:

- list columns
- search fields
- filters
- readonly fields
- permissions
- object actions
- bulk actions
- DTOs for create and update
- optional write-time transforms

Example:

```ts
@Injectable()
@AdminResource({
  model: Order,
  category: 'Sales',
  objectLabel: 'number',
  list: ['id', 'number', 'orderDate', 'userId', 'status', 'total'],
  search: ['number'],
  filters: ['status', 'userId'],
  readonly: ['createdAt', 'updatedAt'],
  createDto: CreateOrderDto,
  updateDto: UpdateOrderDto,
  actions: [
    {
      name: 'Mark as paid',
      handler: async (entity, context) => {
        return context.adapter.update(context.resource, String(entity.id), {
          status: 'paid',
        });
      },
    },
  ],
  bulkActions: [
    {
      name: 'Archive selected',
      handler: async (ids, context) => {
        await Promise.all(
          ids.map((id) =>
            context.adapter.update(context.resource, id, {
              archived: true,
            }),
          ),
        );
      },
    },
  ],
})
export class OrderAdmin {}
```

## DTO-Driven Forms

Form fields come from your DTOs, not from inspecting the ORM model directly.

Validation stays server-side through `class-validator`, while the admin library derives UI metadata from DTO fields and optional `@AdminField(...)` annotations.

Example:

```ts
import { AdminField } from 'nestjs-dj-admin';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  number!: string;

  @Type(() => Date)
  @IsDate()
  orderDate!: Date;

  @AdminField({
    label: 'Internal note',
    input: 'textarea',
  })
  @IsString()
  @IsOptional()
  internalNote?: string;

  @AdminField({
    label: 'User',
    relation: {
      kind: 'many-to-one',
      option: { resource: 'users', labelField: 'email', valueField: 'id' },
    },
  })
  @IsInt()
  userId!: number;

  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
```

Currently supported primitive inputs include:

- `text`
- `email`
- `tel`
- `url`
- `password`
- `number`
- `checkbox`
- `date`
- `time`
- `datetime-local`
- `textarea`
- `select`
- `multiselect`

Field metadata also supports:

- `label`
- `helpText`
- `modes: ['create']`, `['update']`, or both
- relation metadata for selector fields

Create and update DTOs can differ. That is how the examples implement Django-style password handling:

- create DTO includes `password` and `passwordConfirm`
- update DTO omits editable password fields
- existing-record password changes use a dedicated password form

## Write Transforms And Password Handling

Resource-level write transforms let you reshape validated DTO payloads before they reach the adapter.

That is the intended place for:

- hashing passwords into `passwordHash`
- dropping confirmation fields
- mapping UI field names to storage field names
- resource-specific write normalization

Example:

```ts
@AdminResource({
  model: User,
  createDto: CreateUserDto,
  updateDto: UpdateUserDto,
  password: {
    hash: hashPassword,
    helpText:
      'Raw passwords are not stored, so there is no way to see this user password.',
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
      passwordHash: await hashPassword(password),
    };
  },
})
export class UserAdmin {}
```

See the real example in:

- [examples/typeorm-demo-app/src/modules/user/user.admin.ts](/Users/mojca/repos/nestjs-dj-admin/examples/typeorm-demo-app/src/modules/user/user.admin.ts)
- [examples/prisma-demo-app/src/modules/user/user.admin.ts](/Users/mojca/repos/nestjs-dj-admin/examples/prisma-demo-app/src/modules/user/user.admin.ts)

## Custom Actions

Single-record actions run against one object and appear on the list and edit pages. Bulk actions run against selected IDs from the changelist.

Use them for admin operations such as:

- mark as paid
- deactivate user
- archive selected records

Action handlers receive the adapter, resolved resource metadata, authenticated admin user, and either the current entity or selected IDs.

The shared examples define both action styles in:

- [examples/shared/src/modules/order/shared.ts](/Users/mojca/repos/nestjs-dj-admin/examples/shared/src/modules/order/shared.ts)
- [examples/shared/src/modules/user/shared.ts](/Users/mojca/repos/nestjs-dj-admin/examples/shared/src/modules/user/shared.ts)

## Relation Fields

Relation selectors are configured from DTO metadata, not inferred automatically from the ORM.

For relation fields, declare:

- `kind`: currently `many-to-one` or `many-to-many`
- `resource`: target admin resource name
- `labelField`: target field used for display
- `valueField`: target field used as the submitted value, usually `id`

Example:

```ts
@AdminField({
  label: 'Product',
  relation: {
    kind: 'many-to-one',
    option: { resource: 'products', labelField: 'name', valueField: 'id' },
  },
})
productId!: number;
```

This drives:

- relation selectors on create and edit forms
- lookup endpoints
- relation labels in list pages
- delete summaries and object labeling

See:

- [examples/shared/src/modules/order/shared.ts](/Users/mojca/repos/nestjs-dj-admin/examples/shared/src/modules/order/shared.ts)
- [examples/shared/src/modules/order-detail/shared.ts](/Users/mojca/repos/nestjs-dj-admin/examples/shared/src/modules/order-detail/shared.ts)

## Example Apps

All three example apps serve the admin backend on `http://127.0.0.1:3000/admin`.

Shared seeded admin login:

```text
email: ada@example.com
password: admin123
```

Shared seeded baseline:

- 3 users
- 20+ orders
- categories
- products
- order details

The `ada@example.com` account is the seeded admin user. The other seeded users are present as demo data, but they are not valid admin logins.

### TypeORM Setup

Primary demo app. Uses PostgreSQL, startup migrations, and seeded baseline data.

Clean setup:

```bash
npm install
docker compose up -d postgres
npm run typeorm:setup:example
npm run dev:typeorm-example
```

Built run:

```bash
npm run typeorm:setup:example
npm run build:typeorm-example
npm run start:typeorm-example
```

Default database settings:

```bash
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nestjs_dj_admin_demo
```

The TypeORM example now applies migrations on startup instead of relying on runtime schema synchronization.

More detail: [examples/typeorm-demo-app/README.md](/Users/mojca/repos/nestjs-dj-admin/examples/typeorm-demo-app/README.md)

### Prisma Setup

First-class runnable demo, not a secondary adapter stub. Uses the same PostgreSQL container as the TypeORM demo, but a separate PostgreSQL database so it can coexist cleanly with the TypeORM example.

Clean setup:

```bash
npm install
docker compose up -d postgres
npm run prisma:setup:example
npm run dev:prisma-example
```

Built run:

```bash
npm run prisma:setup:example
npm run build:prisma-example
npm run start:prisma-example
```

Default Prisma database URL:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nestjs_dj_admin_prisma?schema=public
```

`npm run prisma:setup:example` creates the demo database if needed, generates the client, and pushes the schema.

More detail: [examples/prisma-demo-app/README.md](/Users/mojca/repos/nestjs-dj-admin/examples/prisma-demo-app/README.md)

### In-Memory Setup

Fastest demo app. Uses the bundled in-memory adapter and starts with seeded baseline data, with no external database.

Clean setup:

```bash
npm install
npm run dev:inmemory-example
```

Built run:

```bash
npm run build:inmemory-example
npm run start:inmemory-example
```

More detail: [examples/in-memory-demo-app/README.md](/Users/mojca/repos/nestjs-dj-admin/examples/in-memory-demo-app/README.md)

### Shared Example Commands

Build all examples:

```bash
npm run build:examples
```

Default full-stack development flow:

```bash
docker compose up -d postgres
npm run dev
```

Stop and remove the demo Postgres volume:

```bash
docker compose down -v
```

## Testing

Adapter contract coverage is available across all three adapters:

- in-memory
- TypeORM
- Prisma

Covered adapter behavior:

- `findMany`
- `findOne`
- `create`
- `update`
- `delete`
- `distinct`
- pagination
- sorting
- filtering
- search

Run the contract suite:

```bash
npm run test:adapters
```

Backend end-to-end coverage exercises the admin HTTP flow for:

- login/logout
- protected `/admin` API access
- resource metadata endpoints
- CRUD routes
- custom action routes
- permission denial paths
- validation error shape

Run the backend E2E suite:

```bash
npm run test:e2e
```

Run linting and type checks:

```bash
npm run lint
npm run check
```

## Limitations And Non-Goals

Current intentional limits:

- this is an admin framework, not a complete auth framework
- relation metadata is explicit; ORM relations are not auto-derived into admin forms
- the bundled UI is opinionated and not yet a full theming system
- advanced workflows such as audit logs, import/export, dashboards, soft delete, and saved filters are not part of `0.1.x`
- the TypeORM demo is migration-backed, but it is still a demo app rather than production rollout guidance

Current operational constraints:

- you must provide your own authentication check and password verification logic
- you must decide your own production stance for sessions, CSRF, rate limits, and lockouts
- if you use Prisma or TypeORM, you still own your underlying model design and database lifecycle

## Compatibility Expectations

The package is currently developed and tested against:

- NestJS `^11.1.6`
- `class-validator` `^0.14.2`
- `class-transformer` `^0.5.1`
- `rxjs` `^7.8.2`
- TypeORM `^0.3.25`
- Prisma Client `^6.15.0 || ^7.0.0`
- Express `5.x`

Adapter dependencies are optional unless you use that adapter:

- `typeorm` is optional if you are not using `TypeOrmAdminAdapter`
- `@prisma/client` is optional if you are not using `PrismaAdminAdapter`

Compatibility should currently be read as "supported in the versions above and in the example apps", not "guaranteed across a wide matrix of older Nest, Prisma, or TypeORM versions".

## Package Shape

- Public API entrypoint: [src/index.ts](/Users/mojca/repos/nestjs-dj-admin/src/index.ts)
- Library build output: `dist/`
- Prebuilt admin UI assets: `dist/admin-ui/`
- Example apps:
  - [examples/typeorm-demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/typeorm-demo-app)
  - [examples/in-memory-demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/in-memory-demo-app)
  - [examples/prisma-demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/prisma-demo-app)
