# In-memory example

Fastest runnable demo for `nestjs-dj-admin`.

Runs the admin backend at `http://127.0.0.1:3000/admin` using:

- the in-memory adapter
- seeded in-process data
- no external database

## Clean setup

```bash
npm install
npm run dev:inmemory-example
```

## Built run

```bash
npm run build:inmemory-example
npm run start:inmemory-example
```

## Seeded admin login

```text
email: ada@example.com
password: admin123
```

## Notes

- Starts with seeded users, orders, categories, products, and order details
- Best option for quickly checking admin behavior without database setup
- Intentionally mixes schema providers: `Category` uses explicit Zod schema config, while the other demo resources stay on the DTO and `class-validator` path
