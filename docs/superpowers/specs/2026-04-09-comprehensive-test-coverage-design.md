# Comprehensive Test Coverage Initiative

**Date:** 2026-04-09
**Status:** Approved
**Goal:** Achieve 95% test coverage across all categories (statements, branches, functions, lines) for the entire `apps/web` codebase.

## Overview

Excalibre currently has 16 server-side unit tests with 61.4% statement coverage (only counting files touched by those tests). Zero React component, hook, or page tests exist. This initiative adds ~80 new test files, moves existing tests to co-located positions, sets up Vitest browser mode with Playwright for component testing, and enforces 95% coverage thresholds.

## Architecture

### Vitest Workspace

Replace `apps/web/vitest.config.ts` with `apps/web/vitest.workspace.ts` defining two projects:

**Node project:**
- Environment: `node`
- Include: `src/**/*.test.ts`
- Purpose: server functions, utilities, DB schema, API route handlers
- Plugins: `vite-tsconfig-paths`

**Browser project:**
- Browser: enabled, provider `playwright`, instances `[{ browser: "chromium" }]`
- Include: `src/**/*.browser.test.tsx`
- Purpose: React components, hooks, pages
- Plugins: `vite-tsconfig-paths`

Both projects share coverage config:
- Provider: `v8`
- Reporters: `text`, `text-summary`, `html`
- Include: `src/**`
- Exclude: `src/routeTree.gen.ts`, test files
- Thresholds: 95% for statements, branches, functions, lines

### Dependencies

**Add:**
- `@vitest/browser` — browser mode provider
- `playwright` — browser engine

**No testing-library dependencies.** Browser tests use Vitest's native browser API with Playwright locators (`page.getByRole`, `page.getByText`, etc.).

### Naming Convention

- `*.test.ts` — node tests (server, utils, DB)
- `*.browser.test.tsx` — browser tests (components, hooks, pages)

Enforced by workspace include patterns. No per-file directives needed.

## Test File Organization

All tests co-located next to their source files. The existing `src/__tests__/` directory is deleted after migration.

### Existing Test Migration

| Current | New |
|---|---|
| `src/__tests__/scanner.test.ts` | `src/server/scanner.test.ts` |
| `src/__tests__/extractors.test.ts` | `src/server/extractors/extractors.test.ts` |
| `src/__tests__/path-safety.test.ts` | `src/server/path-safety.test.ts` |
| `src/__tests__/reading-utils.test.ts` | `src/server/reading-utils.test.ts` |
| `src/__tests__/request-auth.test.ts` | `src/server/request-auth.test.ts` |
| `src/__tests__/sync-settings.test.ts` | `src/server/sync-settings.test.ts` |
| `src/__tests__/job-worker.test.ts` | `src/server/job-worker.test.ts` |
| `src/__tests__/kobo-auth.test.ts` | `src/server/kobo-auth.test.ts` |
| `src/__tests__/kobo-sync.test.ts` | `src/server/kobo-sync.test.ts` |
| `src/__tests__/kosync-auth.test.ts` | `src/server/kosync-auth.test.ts` |
| `src/__tests__/opds-auth.test.ts` | `src/server/opds-auth.test.ts` |
| `src/__tests__/opds-routes.test.ts` | `src/server/opds-routes.test.ts` |
| `src/__tests__/access-route-errors.test.ts` | `src/server/access-route-errors.test.ts` |
| `src/__tests__/auth-hardening.test.ts` | `src/server/auth-hardening.test.ts` |
| `src/__tests__/asset-streaming.test.ts` | `src/server/asset-streaming.test.ts` |
| `src/__tests__/router.test.ts` | `src/router.test.ts` |

## Testing Strategy by Category

### Node Tests

**Server functions** (~10 new files: books, authors, shelves, collections, reading-lists, search, reading, conversion, scan-actions):
- Mock DB via `vi.mock` on drizzle-orm
- Test query construction, auth enforcement (`requireAuth`/`requireLibraryAccess` called), error paths
- Validate input handling and response shapes

**Server utilities** (~8 new files: access-control, converter, conversion-options, epub-fixer, http-errors, middleware, request-auth-resolver, scheduler):
- Unit test pure logic
- Mock external deps (fs, crypto) where needed
- `access-control.ts` is currently at 0% — needs full coverage of all assertion functions

**Existing server tests** (15 moved files):
- Fill branch/line coverage gaps to reach 95%
- Key gaps: `kobo.ts` (20%), `job-worker.ts` (38%), `opds.ts` (59%), `scanner.ts` (66%)
- Fix the 2 failing tests in `auth-hardening.test.ts`

**Lib utilities** (~3 new files):
- `validators.ts` — test each Zod schema with valid and invalid inputs
- `utils.ts` — test `cn()` class merging behavior
- `query-keys.ts` — test key factory returns correct structure

**DB schema** (~7 new files):
- Validate schema exports, column definitions, relations, default values
- Test that tables can be referenced correctly by drizzle

**API route handlers** (~5 new files: OPDS routes, Kobo routes, KoSync routes, book/cover serving, auth catch-all):
- Test handler logic, request parsing, response shapes
- Mock underlying server functions

### Browser Tests

**shadcn/ui primitives** (~15 new files: button, card, badge, dialog, dropdown-menu, form, input, label, select, separator, sheet, sidebar, skeleton, sonner, tooltip):
- Render each component, verify DOM structure
- Test variants/props (e.g., button variants: default, destructive, outline, secondary, ghost)
- Test interactive states (dialog open/close, dropdown toggle, sheet slide, tooltip hover)

**Library components** (~4 new files: book-card, book-grid, library-header, convert-dialog):
- Render with mock data
- Test user interactions (click, hover, image error fallback)
- Test loading/skeleton states

**Organization components** (~5 new files: add-to-shelf, collection-form, reading-list-form, shelf-form, smart-filter-builder):
- Render forms, test validation feedback
- Test submit behavior with mocked mutations
- Smart filter builder: test add/remove conditions, and/or logic

**Reader components** (~6 new files: ebook-reader, pdf-reader, reader-progress-bar, reader-settings, reader-toolbar, toc-drawer):
- Render with mocked reader engines (foliate-js, react-pdf mocked at module level)
- Test toolbar interactions, settings changes
- Test progress bar rendering with various percentages

**Layout components** (~3 new files: app-layout, app-sidebar, header):
- Render and verify navigation links present
- Test sidebar collapse/expand
- Test responsive behavior

**Settings components** (~1 new file: library-form):
- Render form, test validation, test submit

**Page/route components** (~15 new files: login, register, home, search, book detail, author/series/collection/reading-list/shelf/library detail, settings pages, reader page):
- Wrap in `QueryClientProvider` + `RouterProvider` with `createMemoryHistory`
- Mock server functions via `vi.mock`
- Test key interactions and conditional rendering (loading, error, empty states)

**Custom hooks** (~3 new files: use-reading-progress, use-reader-settings, use-mobile):
- `use-mobile`: test media query matching in real browser
- `use-reader-settings`: test localStorage read/write
- `use-reading-progress`: test with mocked React Query client

### Mocking Strategy for Browser Tests

- **Server functions** (`createServerFn`): mocked at module level via `vi.mock`
- **React Query**: wrap components in `QueryClientProvider` with a fresh test `QueryClient`
- **TanStack Router**: use `createMemoryHistory` + `RouterProvider` for page tests
- **External reader libs** (foliate-js, react-pdf): mocked to avoid loading real reader engines in test browser
- **Auth**: mock `useSession` to return test user data

## Coverage

### Current State

| Category | Current | Target |
|---|---|---|
| Statements | 61.4% | 95% |
| Branches | 45.5% | 95% |
| Functions | 51.4% | 95% |
| Lines | 62.2% | 95% |

Note: current numbers only reflect files imported by existing tests. Adding component tests grows the denominator significantly before coverage catches up.

### Exclusions

- `src/routeTree.gen.ts` — auto-generated by TanStack Router
- Test files themselves

### Enforcement

Coverage thresholds set in vitest workspace config. `bun run test` fails if any category in either project drops below 95%.

## Phases

### Phase 1 — Infrastructure
Set up vitest workspace, install `@vitest/browser` and `playwright`, move existing tests to co-located positions, delete `src/__tests__/`, verify all existing tests still pass.

### Phase 2 — Node test gaps (server)
Add missing server function tests (books, authors, shelves, collections, reading-lists, search, reading, conversion, scan-actions). Improve existing test coverage for kobo, opds, job-worker, scanner to reach 95%. Fix failing auth-hardening tests.

### Phase 3 — Node test gaps (lib/db/routes)
Add tests for validators, utils, query-keys, DB schema validation, API route handlers.

### Phase 4 — Browser test infrastructure
Get one browser test working end-to-end (`button.browser.test.tsx`) to validate Playwright setup, rendering, and locator API.

### Phase 5 — shadcn/ui component tests
All 15 UI primitives. Establishes browser test patterns and helpers.

### Phase 6 — Domain component tests
Library components (book-card, book-grid, library-header, convert-dialog), organization components (add-to-shelf, collection-form, reading-list-form, shelf-form, smart-filter-builder), settings components (library-form).

### Phase 7 — Reader component tests
ebook-reader, pdf-reader, reader-progress-bar, reader-settings, reader-toolbar, toc-drawer. Most complex — requires mocked reader engines.

### Phase 8 — Layout & page tests
Layout components (app-layout, app-sidebar, header), then all route/page components with router context.

### Phase 9 — Hook tests
use-reading-progress, use-reader-settings, use-mobile — tested in browser.

### Phase 10 — Coverage enforcement & cleanup
Enable 95% thresholds in vitest workspace config. Fix any remaining coverage gaps. Final verification that `bun run test` passes with thresholds enforced.
