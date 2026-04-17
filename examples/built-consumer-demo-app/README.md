# Built consumer example

Minimal consumer-style demo app for `nestjs-dj-admin`.

This example imports only the public package surface, including extension subpaths, so it is useful for verifying that the built package works as a real consumer dependency.

## Run against the built library

```bash
npm install
npm run build:lib
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm examples/built-consumer-demo-app/src/main.ts
```

Then open `http://127.0.0.1:3112/admin`.

## Build and start

```bash
npm run build:built-consumer-example
npm run start:built-consumer-example
```

## Seeded admin login

```text
email: ada@example.com
password: admin123
```
