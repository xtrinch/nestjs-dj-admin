# Agent Notes

- Do not run `npm run check` by default after every edit.
- Only run `npm run check` when it is strictly necessary:
  - type-level refactors
  - shared API/type changes
  - build/runtime uncertainty that cannot be resolved by inspection
- For small UI, copy, CSS, or isolated edits, prefer no typecheck unless the change clearly risks breakage.
