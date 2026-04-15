# Changelog

All notable changes to `nestjs-dj-admin` should be documented in this file.

The format is loosely based on Keep a Changelog, but kept intentionally lightweight for the current pre-`0.1.0` phase.

## [0.1.0-preview] - 2026-04-15

Initial public preview release candidate.

Highlights:

- NestJS-native admin module with bundled UI
- DTO-driven admin form metadata
- TypeORM, Prisma, and in-memory adapters
- CRUD, object actions, bulk actions, lookups, and delete summaries
- Django-style password handling with dedicated password-change flow
- shared adapter contract tests
- backend end-to-end coverage
- migration-backed TypeORM and Prisma example apps

Known preview caveats:

- API and UI contracts may still change before a stable `0.1.0`
- production auth/session hardening guidance is still intentionally thin
- theming and advanced admin workflows remain limited
