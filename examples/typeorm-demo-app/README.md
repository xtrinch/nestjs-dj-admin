# TypeORM example

Primary demo app for `nestjs-dj-admin`.

Runs the admin backend at `http://127.0.0.1:3000/admin` using:

- TypeORM
- PostgreSQL
- startup seed data

## Clean setup

```bash
npm install
docker compose up -d postgres
npm run dev:typeorm-example
```

## Built run

```bash
npm run build:typeorm-example
npm run start:typeorm-example
```

## Seeded admin login

```text
email: ada@example.com
password: admin123
```

## Notes

- Uses the shared demo database `nestjs_dj_admin_demo` on `127.0.0.1:5432`
- Seeds baseline users, orders, categories, products, and order details on startup
- This is the default primary demo used by `npm run dev`
