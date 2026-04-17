# TypeORM example

Primary demo app for `nestjs-dj-admin`.

Runs the admin backend at `http://127.0.0.1:3000/admin` using:

- TypeORM
- PostgreSQL
- Grafana
- startup migrations
- startup seed data

## Clean setup

```bash
npm install
docker compose up -d postgres grafana
npm run typeorm:setup:example
npm run dev:typeorm-example
```

## Built run

```bash
npm run typeorm:setup:example
npm run build:typeorm-example
npm run start:typeorm-example
```

## Seeded admin logins

```text
email: ada@example.com
password: admin123

email: grace@example.com
password: editor123
```

## Notes

- Uses the shared demo database `nestjs_dj_admin_demo` on `127.0.0.1:5432`
- Uses the local Grafana demo at `http://127.0.0.1:3001`
- Creates the demo database if needed and applies TypeORM migrations on startup
- Seeds baseline users, orders, categories, products, and order details on startup
- Registers a composable embed page extension plus dashboard link widget extension for `Grafana overview`
- This is the default primary demo used by `npm run dev`
- `typeorm:setup:example` prepares the Postgres database, while the app itself runs pending migrations before serving requests
