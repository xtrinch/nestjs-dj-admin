# Prisma example

Prisma-backed runnable demo for `nestjs-dj-admin`.

Runs the admin backend at `http://127.0.0.1:3000/admin` using:

- Prisma
- PostgreSQL
- startup seed data

## Clean setup

```bash
npm install
docker compose up -d postgres
npm run prisma:setup:example
npm run dev:prisma-example
```

## Built run

```bash
npm run prisma:setup:example
npm run build:prisma-example
npm run start:prisma-example
```

## Seeded admin login

```text
email: ada@example.com
password: admin123
```

## Notes

- Uses `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nestjs_dj_admin_prisma?schema=public` by default
- Seeds the same baseline demo dataset as the TypeORM example
- Uses its own PostgreSQL database so it can coexist with the TypeORM example in the same local container
- `npm run prisma:setup:example` creates the demo database if needed, then generates the client and pushes the schema
