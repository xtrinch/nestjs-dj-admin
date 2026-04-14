# Release Checklist

This file captures what is still needed before calling this project a credible `0.1.0` release.

The current codebase is already a useful preview, but it is not yet at a level where `0.1.0` should imply stable, defended behavior for outside users.

## Release framing

Recommended versioning stance:

- `0.1.0-alpha` or `0.1.0-preview`: acceptable today
- `0.1.0`: only after the must-have items below are complete
- `1.0.0`: much later, after proven stability and clearer production guidance

## Must-have for `0.1.0`

### 3. Finish the Django-admin baseline

The baseline experience should be coherent and predictable.

Concrete remaining work:


### 4. Example apps must be reproducible from a clean setup

All three examples should be explicitly verified:

- TypeORM example
- Prisma example
- in-memory example

Each should have:

- clear run steps
- working auth
- seeded baseline data
- current docs

The TypeORM example can remain the default primary demo, but the Prisma example should no longer feel secondary or fragile.

### 5. Release-quality documentation

The README should be expanded or supplemented with docs for:

- quickstart
- auth integration
- resource registration
- DTO-driven forms
- custom actions
- relation fields
- TypeORM setup
- Prisma setup
- limitations / non-goals
- compatibility expectations

Right now the docs are good enough for local development, but thin for external adoption.

### 6. Release metadata and policy

Before `0.1.0`, add:

- changelog or release notes
- explicit license
- supported version matrix
- known limitations section
- versioning expectations

### 7. Primitive field coverage

The current form layer now covers:

- text
- email
- password
- number
- checkbox / boolean
- date
- datetime
- enum select
- relation select / multiselect

## Strongly recommended before `0.1.0`

### TypeORM demo maturity

The TypeORM demo still uses `synchronize: true`.

That is acceptable during active development, but it is weak as a public reference app. A migration-based demo would be more credible.

If this is not changed before `0.1.0`, it should at least be documented clearly as a demo-only shortcut.

### Auth hardening guidance

The login flow exists, which is a strong step forward.

What is still missing:

- production guidance for sessions/cookies
- CSRF stance
- rate limit / lockout guidance
- explicit explanation of what the library owns versus what the host app owns

### Better destructive action handling

The UX should align more closely with admin expectations:

## Safe to defer to `0.2.x`

These are valuable, but they should not block a disciplined `0.1.0`:

- audit log
- soft delete
- CSV export/import
- dashboard
- saved filters
- richer theming
- more advanced bulk workflows
- relation-aware search beyond basic selectors

## Current honest project status

Today, the project is best described as:

- a strong preview
- a useful internal/demo-quality package
- a promising Nest-first admin foundation

It is not yet a defended `0.1.0` stable release.

## Suggested order of work

1. Finish the Django-admin baseline
2. Verify all example apps from a clean setup
3. Expand docs into release-quality guidance
4. Final release metadata and changelog
