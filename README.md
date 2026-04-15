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

## Example apps

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

### TypeORM example

Primary demo app. Uses PostgreSQL plus TypeORM `synchronize: true` and seeds baseline data on startup.

Clean setup:

```bash
npm install
docker compose up -d postgres
npm run dev:typeorm-example
```

Built run:

```bash
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

### Prisma example

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

### In-memory example

Fastest demo app. Uses the bundled in-memory adapter and starts with seeded baseline data, no external database required.

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

### Shared example commands

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

Example status:

- `typeorm-demo-app`: primary runnable example
- `in-memory-demo-app`: runnable adapter example with seeded in-memory data
- `prisma-demo-app`: runnable PostgreSQL example after `npm run prisma:setup:example`

## Current status

- The package is structured as a library and exports a public entrypoint.
- The example apps are separated from the publishable source.
- The TypeORM example is the primary runnable demo and seeds `User` and `Order` rows into PostgreSQL on startup.
- The in-memory example is runnable with the in-memory adapter.
- The Prisma example is split into its own app directory and uses Prisma schema push plus generated client code.
- `AdminModule` now mounts the bundled admin UI itself when `dist/admin-ui` is present.
