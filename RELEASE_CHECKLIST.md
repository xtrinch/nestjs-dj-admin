# Release Checklist

This file captures what is still needed before calling this project a credible `0.1.0` release.

The current codebase is already a useful preview, but it is not yet at a level where `0.1.0` should imply stable, defended behavior for outside users.

## Release framing

Recommended versioning stance:

- `0.1.0-alpha` or `0.1.0-preview`: acceptable today
- `0.1.0`: only after the must-have items below are complete
- `1.0.0`: much later, after proven stability and clearer production guidance

## Strongly recommended before `0.1.0`

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

1. Tighten auth hardening guidance
2. Decide whether destructive-action polish should block `0.1.0`
