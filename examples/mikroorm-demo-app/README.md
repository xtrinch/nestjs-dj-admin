# MikroORM example

Runnable PostgreSQL demo app for `nestjs-dj-admin` using MikroORM.

Runs the admin backend at `http://127.0.0.1:3000/admin` using:

- MikroORM
- PostgreSQL
- startup migrations
- startup seed data

## Clean setup

```bash
npm install
docker compose up -d postgres
npm run mikroorm:setup:example
npm run dev:mikroorm-example
```

## Built run

```bash
npm run mikroorm:setup:example
npm run build:mikroorm-example
npm run start:mikroorm-example
```

## Seeded admin logins

```text
email: ada@example.com
password: admin123

email: grace@example.com
password: editor123
```

## Notes

- Uses the PostgreSQL database `nestjs_dj_admin_mikroorm` on `127.0.0.1:5432` by default
- Applies the checked-in MikroORM migration on startup
- Seeds baseline users, orders, categories, products, and order details on startup
- Uses the same admin UI and shared DTO/resource definitions as the other demos
