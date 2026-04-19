# TypeORM example

Primary demo app for `nestjs-dj-admin`.

Runs the admin backend at `http://127.0.0.1:3000/admin` using:

- TypeORM
- PostgreSQL
- Grafana
- BullMQ
- Redis
- startup migrations
- startup seed data

## Clean setup

```bash
npm install
docker compose -f examples/typeorm-demo-app/docker-compose.yml up -d postgres grafana redis
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
- Uses Redis on `127.0.0.1:6379` for the live BullMQ demo queues
- Keeps its local Docker stack in `examples/typeorm-demo-app/docker-compose.yml`
- Creates the demo database if needed and runs checked-in TypeORM migrations with `typeorm:setup:example`
- Still applies pending migrations on startup as a safety net
- Seeds baseline users, orders, categories, products, order details, and live BullMQ demo jobs on startup
- Registers the Grafana extensions plus the queue extension with live `email`, `webhooks`, and `imports` queues
- This is the default primary demo used by `npm run dev`
- `typeorm:setup:example` prepares the Postgres database and runs the checked-in TypeORM migrations
- the app itself still runs pending migrations before serving requests
