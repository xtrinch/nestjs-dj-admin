# Changelog

All notable changes to `nestjs-dj-admin` should be documented in this file.

The format is loosely based on Keep a Changelog, but kept intentionally lightweight.

## [0.1.0] - 2026-04-15

Initial public release.

Highlights:

- NestJS-native admin module with bundled UI
- DTO-driven admin form metadata
- TypeORM, Prisma, and in-memory adapters
- CRUD, object actions, bulk actions, lookups, and delete summaries
- Django-style password handling with dedicated password-change flow
- shared adapter contract tests
- backend end-to-end coverage
- migration-backed TypeORM and Prisma example apps
- explicit branding hooks and accent-color support
- audit log disabled by default, with opt-in enablement and pluggable stores

Current caveats:

- API and UI contracts may still change across `0.x` minors before `1.0.0`
- production auth/session hardening guidance is still intentionally thin
- theming and advanced admin workflows remain limited
