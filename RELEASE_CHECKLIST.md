# Release Checklist

This file should answer one question clearly: what is still worth doing before calling this project a disciplined `0.1.0`, and what can wait.

## Recommended release stance

Today, the honest stance is:

- `0.1.0`: the release target
- `1.0.0`: much later, after wider production usage and a more stable extension surface

## Best remaining `0.1.0` work

These are the highest-value remaining tasks if the goal is a confident first public release rather than more feature work.

### 1. Final release framing cleanup

The target is `0.1.0`.

Before cutting it:

- keep README, changelog, and this checklist aligned on that stance
- avoid vague “not ready” language once the actual blocker list is short

### 2. Decide and document a few final defaults

The important knobs now exist. Before release, confirm that the defaults are intentional and documented:

- `auditLog.enabled`
- auth cookie defaults
- session TTL defaults
- audit retention defaults
- whether `/admin` remains the documented default path

This is mostly a product decision pass, not a large implementation task.

## Nice to do before `0.1.0`, but not mandatory

- add one concrete production-style example for `auth.sessionStore`
- add one concrete production-style example for `auditLog.store`
- do one more UI polish pass if any obvious rough edges remain during smoke testing

## Safe to defer to `0.2.x`

These are valuable, but they should not block a disciplined `0.1.0`:

- richer theming
- more advanced bulk workflows
- relation-aware search beyond basic selectors

## Current honest status

What is already in good shape:

- shared adapter contract coverage across in-memory, TypeORM, and Prisma
- backend end-to-end coverage for auth, metadata, CRUD, actions, password flow, and audit log API
- frontend smoke coverage for save intents, password flow, soft delete, relation filters, audit log UI, and actions
- Django-admin-style password handling
- optional soft delete as a reusable library capability
- dedicated object actions and bulk actions
- migration-backed TypeORM and Prisma demos
- pluggable session storage and configurable cookie policy
- pluggable audit logging, with DB-backed examples in the ORM demos
- release-quality baseline docs, changelog, and license

What is no longer the main risk:

- backend API correctness
- demo app reproducibility
- password handling
- ORM parity

What still most deserves attention:

- final release positioning
- final defaults/documentation decisions
