# Contributing to NatureQuery

## Working safely

- Create focused branches from the intended base branch.
- Keep web, desktop, documentation, and deployment changes in separate commits when practical.
- Do not move or rename environment files, generated output, or user data.
- Never commit secrets. Use `.env.local.example` for variable names and safe placeholders.
- Preserve compatibility when renaming stored keys, database identifiers, API fields, or desktop IPC channels.

## Code organization

- Put routes and route-owned UI in `src/app`.
- Put reusable UI in `src/components`.
- Put server actions in `src/actions` and shared server/domain code in `src/lib`.
- Put reusable browser behavior in `src/hooks` or `src/contexts`.
- Put background functions in `src/inngest`.
- Put operational utilities in `scripts`; do not add one-off scripts to the repository root.
- Keep Electron-only code under `desktop`.

Prefer small modules with a single clear responsibility. A new folder should describe a stable product or technical boundary, not a temporary task.

## Validation

Before committing web changes:

```bash
npm run validate
npm run build
```

Before committing desktop changes:

```bash
cd desktop
npm test
```

Add tests for behavior with meaningful failure modes. Avoid tests that only repeat implementation details.

## Documentation

Update `docs/README.md` when adding a maintained guide. Put point-in-time reviews in `docs/audits`, private context in `docs/internal`, and superseded material in `docs/archive`.
