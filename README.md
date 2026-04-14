# nestjs-dj-admin

NestJS-native admin framework inspired by Django admin, packaged as an npm library.

The example apps deliberately use a small back-office dataset that follows a derivative of Northwind, rather than a generic todo-style domain.
Shared example primitives live in `examples/shared`, while each demo app keeps its own ORM-specific model classes and thin `*.admin.ts` wrappers.

## Package shape

- Public API entrypoint: [src/index.ts](/Users/mojca/repos/nestjs-dj-admin/src/index.ts)
- Library build output: `dist/`
- Prebuilt admin UI assets: `dist/admin-ui/`
- Example apps:
  - [examples/typeorm-demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/typeorm-demo-app)
  - [examples/in-memory-demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/in-memory-demo-app)
  - [examples/prisma-demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/prisma-demo-app)

The root package now exports library primitives instead of booting a server directly.

## Public API

```ts
import {
  AdminModule,
  AdminResource,
  PrismaAdminAdapter,
  TypeOrmAdminAdapter,
} from 'nestjs-dj-admin';
```

## Example usage

```ts
@Module({
  imports: [
    AdminModule.forRoot({
      path: '/admin',
      adapter: PrismaAdminAdapter,
    }),
  ],
})
export class AppModule {}
```

```ts
@Injectable()
@AdminResource({
  model: User,
  list: ['email', 'role', 'createdAt'],
  search: ['email'],
  filters: ['role'],
  readonly: ['createdAt'],
})
export class UserAdmin {}
```

The example resources live in each app under `examples/*/src/modules`.
The default dev app uses TypeORM with PostgreSQL seed data.
The current example domain starts with `User`, `Order`, `Product`, and `OrderDetail`.

## Commands

Build the library and bundled admin UI:

```bash
npm install
npm run build
```

Run the default TypeORM example during development:

```bash
npm run dev
```

Demo admin login:

```text
email: ada@example.com
password: admin123
```

Start the TypeORM demo database first:

```bash
docker compose up -d postgres
```

Default demo database settings:

```bash
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nestjs_dj_admin_demo
```

Destroy the postgres container:
```bash
docker compose down -v
```

Build and run the TypeORM example explicitly:

```bash
npm run build:example
npm run start:example
```

Other example commands:

```bash
npm run dev:inmemory-example
npm run dev:prisma-example
npm run build:examples
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

Set up the Prisma example against the same local Postgres container:

```bash
docker compose up -d postgres
npm run prisma:setup:example
npm run dev:prisma-example
```

Example status:

- `typeorm-demo-app`: primary runnable example
- `in-memory-demo-app`: runnable adapter example with static auth data
- `prisma-demo-app`: runnable adapter example after `npm run prisma:setup:example`

## Current status

- The package is structured as a library and exports a public entrypoint.
- The example apps are separated from the publishable source.
- The TypeORM example is the primary runnable demo and seeds `User` and `Order` rows into PostgreSQL on startup.
- The in-memory example is runnable with the in-memory adapter.
- The Prisma example is split into its own app directory and uses Prisma schema push plus generated client code.
- `AdminModule` now mounts the bundled admin UI itself when `dist/admin-ui` is present.
