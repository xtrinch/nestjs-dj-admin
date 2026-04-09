# Roadmap

## Positioning

This project is a NestJS-native admin framework inspired by Django admin.

The goal is not to become a generic admin platform. The goal is to provide a convention-driven admin experience for Nest applications with:

- declarative resource config
- automatic CRUD UI
- DTO-driven forms
- tight Nest integration
- Prisma and TypeORM adapter support

The roadmap should stay aligned with that constraint.

## Current MVP

Implemented or in progress:

- `AdminModule.forRoot(...)`
- admin login/logout/session flow
- protected admin site and API
- `@AdminResource(...)` resource registration
- automatic CRUD API generation
- pagination, sorting, filtering, search
- minimal React admin UI
- DTO-driven form generation
- simple permissions model
- custom resource actions
- explicit resource categories
- in-memory adapter
- TypeORM demo app

## Guiding Principles

- convention over configuration
- Nest-first, not framework-agnostic
- DTO-first for forms and validation
- metadata-driven, not builder-driven
- simple defaults with escape hatches
- avoid plugin-system complexity in early versions

## Phase 1: Solidify MVP

Goal: make the current system stable, credible, and usable for small real projects.

### Authentication

- Keep the admin site itself behind login
- Support real login/logout flow under `/admin`
- Protect both admin UI and admin API with the same auth layer
- Authenticate against the host app's actual `User` model
- Treat authorization as a layer on top of authentication, not a replacement for it

### Backend

- Harden resource metadata typing and inference
- Finish adapter parity between in-memory, TypeORM, and Prisma
- Normalize error handling across adapters
- Improve validation error shape for frontend consumption
- Add stronger route and action guards
- Support resource-level labels and better default naming

### Frontend

- Improve list/edit UX polish
- Better empty states and loading states
- Better success and failure feedback
- Cleaner category navigation
- Safer destructive action confirmations

### Demo and docs

- Stabilize the TypeORM demo app
- Document the default demo admin credentials and login flow
- Document recommended setup for real projects
- Clarify how adapters, DTOs, guards, and resources fit together
- Add side-by-side examples for typical resources like `User` and `Order`

## Phase 2: Django Admin Essentials

Goal: cover the features users expect from a real admin panel.

### Bulk workflows

- Bulk selection in list pages
- Bulk actions
- Bulk delete
- Bulk status transitions

### Better relations

- Many-to-one dropdown backed by lookup endpoints
- Many-to-many multi-select backed by lookup endpoints
- Better relation labels
- Relation-aware search in forms

### Better field control

- Field labels
- Help text
- Hidden fields
- Create-only fields
- Update-only fields
- Computed readonly fields
- Grouped fields or sections

### Better list pages

- Enum labels
- Richer filter UI
- Default sort config
- Column labels
- Optional column overrides
- Saved list presets later if needed

## Phase 3: Admin Operations Features

Goal: support the workflows real back-office teams need.

### Audit and history

- Audit log per resource
- Change history per record
- Show actor and timestamp for changes
- Action history for custom actions

### Safety features

- Soft delete support
- Restore actions
- Stale update protection / optimistic locking
- Masking for sensitive fields
- Confirmations for dangerous actions

### Data movement

- CSV export
- CSV import for selected resources
- Background job hooks for larger imports later

## Phase 4: Adapter Maturity

Goal: make adapter support credible rather than nominal.

### Shared testing

- Define adapter contract tests
- Run the same contract suite against:
  - in-memory adapter
  - TypeORM adapter
  - Prisma adapter

### TypeORM

- Improve relation handling
- Improve filtering/search behavior parity
- Add realistic migration-based demo flow

### Prisma

- Build the first production-quality Prisma adapter
- Add Prisma demo app
- Ensure parity with TypeORM resource behavior

## Phase 5: Better Nest Integration

Goal: make the library feel native inside a Nest app.

- Better module ergonomics for resource registration
- Cleaner guard integration patterns
- Better support for request user extraction
- Stronger DTO metadata usage
- Better support for custom service-backed actions
- Hooks for before/after create and update where justified

## Phase 6: Optional Quality-of-Life Features

These are useful, but should not dilute the core.

- Minimal dashboard/home page
- Global search
- Per-resource icons
- Breadcrumbs
- Basic theming
- Better mobile layout

## Non-Goals

These should remain out of scope unless the project direction changes.

- framework-agnostic admin support
- GraphQL admin
- low-code schema builder
- backend JSX config
- requiring React authoring for standard CRUD usage
- large plugin ecosystem before core is stable

## Recommended Near-Term Priorities

If choosing the next practical milestones, the order should be:

1. Prisma adapter parity
2. Adapter contract tests
3. Better relation support
4. Bulk actions
5. Audit log
6. Soft delete
7. CSV export

## Release Shape

Suggested release framing:

- `0.1.x`: MVP stabilization
- `0.2.x`: relation support and bulk actions
- `0.3.x`: audit log and soft delete
- `0.4.x`: Prisma parity and adapter contract coverage
- `1.0.0`: stable Nest-first admin framework for Prisma and TypeORM
