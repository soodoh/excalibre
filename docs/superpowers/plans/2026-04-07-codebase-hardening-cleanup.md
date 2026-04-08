# 2026-04-07 Codebase Hardening Cleanup

## Status

Tasks 1 through 7 in the hardening cleanup pass are implemented in
`feat/codebase-hardening-cleanup`.

## Residual Audit Risk

As of 2026-04-07, `bun audit` reports 3 remaining `h3` advisories.

These are upstream-pinned rather than locally fixable in this branch:

- `@tanstack/start-server-core@1.167.9` depends on the exact alias
  `npm:h3@2.0.1-rc.16`.
- `@tanstack/react-start@1.167.16` currently resolves that package, so Bun
  cannot replace it with `h3@2.0.1-rc.20` through overrides.

Verification commands in this branch confirm the remaining audit output is
limited to that upstream `h3` pin. All direct dependency advisories that were
fixable from this codebase were updated or overridden here.
