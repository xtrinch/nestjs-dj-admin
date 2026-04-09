# nestjs-dj-admin

NestJS-native admin framework inspired by Django admin, packaged as an npm library.

## Package shape

- Public API entrypoint: [src/index.ts](/Users/mojca/repos/nestjs-dj-admin/src/index.ts)
- Library build output: `dist/`
- Prebuilt admin UI assets: `dist/admin-ui/`
- Demo Nest app: [examples/demo-app](/Users/mojca/repos/nestjs-dj-admin/examples/demo-app)

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

The demo resources live at [user.admin.ts](/Users/mojca/repos/nestjs-dj-admin/examples/demo-app/src/modules/user/user.admin.ts) and [order.admin.ts](/Users/mojca/repos/nestjs-dj-admin/examples/demo-app/src/modules/order/order.admin.ts).
The demo app now uses TypeORM with PostgreSQL seed data instead of the in-memory adapter.

## Commands

Build the library and bundled admin UI:

```bash
npm install
npm run build
```

Run the demo app during development:

```bash
npm run dev
```

Start the demo database first:

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

Build and run the demo app explicitly:

```bash
npm run build:example
npm run start:example
```

## Current status

- The package is structured as a library and exports a public entrypoint.
- The demo app is separated from the publishable source.
- The demo app is TypeORM-backed and seeds `User` and `Order` rows into PostgreSQL on startup.
- The admin UI is still built separately and served by the demo app bootstrap, not yet by `AdminModule` itself.
