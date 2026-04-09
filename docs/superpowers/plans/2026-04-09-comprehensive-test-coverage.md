# Comprehensive Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 95% test coverage across all categories for the entire `apps/web` codebase using Vitest workspace with node and browser (Playwright) projects.

**Architecture:** Vitest workspace with two projects — `node` for server/utility tests and `browser` for React component/hook/page tests using Playwright. All tests co-located next to source files.

**Tech Stack:** Vitest 4.x, @vitest/browser, @vitest/browser-playwright, vitest-browser-react, Playwright, v8 coverage

**Spec:** `docs/superpowers/specs/2026-04-09-comprehensive-test-coverage-design.md`

---

## Phase 1: Infrastructure

### Task 1: Install dependencies and create vitest workspace

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.workspace.ts`

- [ ] **Step 1: Install browser testing dependencies**

```bash
cd apps/web && bun add -d @vitest/browser @vitest/browser-playwright vitest-browser-react playwright
```

- [ ] **Step 2: Update vitest.config.ts with shared coverage settings**

Replace `apps/web/vitest.config.ts` with:

```typescript
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**"],
			exclude: [
				"src/routeTree.gen.ts",
				"src/**/*.test.ts",
				"src/**/*.browser.test.tsx",
			],
		},
	},
});
```

- [ ] **Step 3: Create vitest.workspace.ts**

Create `apps/web/vitest.workspace.ts`:

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		extends: "./vitest.config.ts",
		test: {
			name: "node",
			environment: "node",
			include: ["src/**/*.test.ts"],
		},
	},
	{
		extends: "./vitest.config.ts",
		test: {
			name: "browser",
			include: ["src/**/*.browser.test.tsx"],
			browser: {
				enabled: true,
				provider: "playwright",
				instances: [{ browser: "chromium" }],
			},
		},
	},
]);
```

- [ ] **Step 4: Verify workspace is detected**

```bash
cd apps/web && bunx vitest --version
```

Expected: Vitest version prints without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock apps/web/vitest.config.ts apps/web/vitest.workspace.ts
git commit -m "feat: add vitest workspace with node and browser projects"
```

---

### Task 2: Move existing tests to co-located positions

**Files:**
- Move: All 16 files from `src/__tests__/` to co-located positions
- Delete: `src/__tests__/` directory

- [ ] **Step 1: Move all test files**

```bash
cd apps/web
git mv src/__tests__/scanner.test.ts src/server/scanner.test.ts
git mv src/__tests__/extractors.test.ts src/server/extractors/extractors.test.ts
git mv src/__tests__/path-safety.test.ts src/server/path-safety.test.ts
git mv src/__tests__/reading-utils.test.ts src/server/reading-utils.test.ts
git mv src/__tests__/request-auth.test.ts src/server/request-auth.test.ts
git mv src/__tests__/sync-settings.test.ts src/server/sync-settings.test.ts
git mv src/__tests__/job-worker.test.ts src/server/job-worker.test.ts
git mv src/__tests__/kobo-auth.test.ts src/server/kobo-auth.test.ts
git mv src/__tests__/kobo-sync.test.ts src/server/kobo-sync.test.ts
git mv src/__tests__/kosync-auth.test.ts src/server/kosync-auth.test.ts
git mv src/__tests__/opds-auth.test.ts src/server/opds-auth.test.ts
git mv src/__tests__/opds-routes.test.ts src/server/opds-routes.test.ts
git mv src/__tests__/access-route-errors.test.ts src/server/access-route-errors.test.ts
git mv src/__tests__/auth-hardening.test.ts src/server/auth-hardening.test.ts
git mv src/__tests__/asset-streaming.test.ts src/server/asset-streaming.test.ts
git mv src/__tests__/router.test.ts src/router.test.ts
```

- [ ] **Step 2: Delete the empty __tests__ directory**

```bash
cd apps/web && rmdir src/__tests__
```

- [ ] **Step 3: Fix any import paths in moved test files**

Check each moved test file for relative imports that reference `__tests__` or need path adjustments. The tests use path aliases (`src/...`) so most imports should work unchanged. Verify by scanning for relative imports:

```bash
cd apps/web && grep -r "from '\.\." src/server/*.test.ts src/router.test.ts
```

Fix any relative paths found.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move tests to co-located positions next to source files"
```

---

### Task 3: Verify all tests pass in new structure

- [ ] **Step 1: Run all tests**

```bash
cd apps/web && bun run test
```

Expected: 15 passed, 1 failed (the 2 pre-existing failures in auth-hardening.test.ts). All other tests pass.

- [ ] **Step 2: Fix auth-hardening.test.ts failures**

Read `src/server/auth-hardening.test.ts` and fix the 2 failing tests:
1. The 5s timeout issue — increase timeout or fix async handling
2. The `db.select()` mock returning undefined — fix the mock chain to include `.from()`

Read the test file, identify the exact failures, and fix them.

- [ ] **Step 3: Run tests again to confirm all pass**

```bash
cd apps/web && bun run test
```

Expected: All 16 test files pass, 73+ tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve auth-hardening test failures after migration"
```

---

## Phase 2: Server Test Gaps

### Task 4: Test access-control.ts (0% coverage)

**Files:**
- Create: `apps/web/src/server/access-control.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/web/src/server/access-control.test.ts`:

```typescript
import { beforeEach, describe, expect, test, vi } from "vitest";

const libraryFindFirst = vi.fn();
const libraryFindMany = vi.fn();
const bookFindFirst = vi.fn();
const bookFileFindFirst = vi.fn();
const authorFindFirst = vi.fn();
const seriesFindFirst = vi.fn();
const userFindFirst = vi.fn();
const dbSelect = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
		query: {
			libraries: { findFirst: libraryFindFirst, findMany: libraryFindMany },
			books: { findFirst: bookFindFirst },
			bookFiles: { findFirst: bookFileFindFirst },
			authors: { findFirst: authorFindFirst },
			series: { findFirst: seriesFindFirst },
			user: { findFirst: userFindFirst },
		},
	},
}));

vi.mock("src/db/schema", () => ({
	libraries: "libraries",
	libraryAccess: "libraryAccess",
	books: "books",
	bookFiles: "bookFiles",
	authors: "authors",
	booksAuthors: "booksAuthors",
	series: "series",
	user: "user",
}));

beforeEach(() => {
	vi.resetAllMocks();
});

describe("getAccessibleLibraryIds", () => {
	test("returns all library IDs for admin users", async () => {
		dbSelect.mockReturnValue({
			from: () => Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }]),
		});

		const { getAccessibleLibraryIds } = await import(
			"src/server/access-control"
		);
		const result = await getAccessibleLibraryIds("user-1", "admin");
		expect(result).toEqual([1, 2, 3]);
	});

	test("returns only accessible library IDs for regular users", async () => {
		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ libraryId: 1 }, { libraryId: 3 }]),
				}),
			}),
		});

		const { getAccessibleLibraryIds } = await import(
			"src/server/access-control"
		);
		const result = await getAccessibleLibraryIds("user-2", "user");
		expect(result).toEqual([1, 3]);
	});

	test("resolves role from DB when not provided", async () => {
		userFindFirst.mockResolvedValue({ role: "user" });
		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ libraryId: 1 }]),
				}),
			}),
		});

		const { getAccessibleLibraryIds } = await import(
			"src/server/access-control"
		);
		const result = await getAccessibleLibraryIds("user-2");
		expect(userFindFirst).toHaveBeenCalled();
		expect(result).toEqual([1]);
	});
});

describe("assertUserCanAccessLibrary", () => {
	test("returns library when admin", async () => {
		const lib = { id: 1, name: "Main" };
		libraryFindFirst.mockResolvedValue(lib);

		const { assertUserCanAccessLibrary } = await import(
			"src/server/access-control"
		);
		const result = await assertUserCanAccessLibrary("user-1", 1, "admin");
		expect(result).toEqual(lib);
	});

	test("throws NotFoundError when library does not exist", async () => {
		libraryFindFirst.mockResolvedValue(undefined);

		const { assertUserCanAccessLibrary } = await import(
			"src/server/access-control"
		);
		await expect(
			assertUserCanAccessLibrary("user-1", 999, "admin"),
		).rejects.toThrow(/not found/i);
	});

	test("throws ForbiddenError when user lacks access", async () => {
		libraryFindFirst.mockResolvedValue({ id: 1, name: "Main" });
		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});

		const { assertUserCanAccessLibrary } = await import(
			"src/server/access-control"
		);
		await expect(
			assertUserCanAccessLibrary("user-2", 1, "user"),
		).rejects.toThrow(/forbidden/i);
	});
});

describe("assertUserCanAccessBook", () => {
	test("returns book when user has library access", async () => {
		const book = { id: 10, libraryId: 1, title: "Test" };
		bookFindFirst.mockResolvedValue(book);
		libraryFindFirst.mockResolvedValue({ id: 1 });

		const { assertUserCanAccessBook } = await import(
			"src/server/access-control"
		);
		const result = await assertUserCanAccessBook("user-1", 10, "admin");
		expect(result).toEqual(book);
	});

	test("throws NotFoundError when book does not exist", async () => {
		bookFindFirst.mockResolvedValue(undefined);

		const { assertUserCanAccessBook } = await import(
			"src/server/access-control"
		);
		await expect(
			assertUserCanAccessBook("user-1", 999, "admin"),
		).rejects.toThrow(/not found/i);
	});
});

describe("assertUserCanAccessBookFile", () => {
	test("returns file when user has access", async () => {
		const file = { id: 5, bookId: 10, format: "epub" };
		bookFileFindFirst.mockResolvedValue(file);
		bookFindFirst.mockResolvedValue({ id: 10, libraryId: 1 });
		libraryFindFirst.mockResolvedValue({ id: 1 });

		const { assertUserCanAccessBookFile } = await import(
			"src/server/access-control"
		);
		const result = await assertUserCanAccessBookFile("user-1", 5, "admin");
		expect(result).toEqual(file);
	});

	test("throws NotFoundError when file does not exist", async () => {
		bookFileFindFirst.mockResolvedValue(undefined);

		const { assertUserCanAccessBookFile } = await import(
			"src/server/access-control"
		);
		await expect(
			assertUserCanAccessBookFile("user-1", 999, "admin"),
		).rejects.toThrow(/not found/i);
	});
});

describe("assertUserCanAccessAuthor", () => {
	test("returns author when they have books in accessible libraries", async () => {
		const author = { id: 1, name: "Author" };
		authorFindFirst.mockResolvedValue(author);
		dbSelect.mockReturnValue({
			from: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
		});

		const { assertUserCanAccessAuthor } = await import(
			"src/server/access-control"
		);
		const result = await assertUserCanAccessAuthor("user-1", 1, "admin");
		expect(result).toEqual(author);
	});

	test("throws NotFoundError when author does not exist", async () => {
		authorFindFirst.mockResolvedValue(undefined);

		const { assertUserCanAccessAuthor } = await import(
			"src/server/access-control"
		);
		await expect(
			assertUserCanAccessAuthor("user-1", 999, "admin"),
		).rejects.toThrow(/not found/i);
	});
});

describe("assertUserCanAccessSeries", () => {
	test("returns series when user has library access", async () => {
		const s = { id: 1, name: "Series", libraryId: 1 };
		seriesFindFirst.mockResolvedValue(s);
		libraryFindFirst.mockResolvedValue({ id: 1 });

		const { assertUserCanAccessSeries } = await import(
			"src/server/access-control"
		);
		const result = await assertUserCanAccessSeries("user-1", 1, "admin");
		expect(result).toEqual(s);
	});

	test("throws NotFoundError when series does not exist", async () => {
		seriesFindFirst.mockResolvedValue(undefined);

		const { assertUserCanAccessSeries } = await import(
			"src/server/access-control"
		);
		await expect(
			assertUserCanAccessSeries("user-1", 999, "admin"),
		).rejects.toThrow(/not found/i);
	});
});
```

- [ ] **Step 2: Run the test**

```bash
cd apps/web && bunx vitest run src/server/access-control.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/access-control.test.ts
git commit -m "test: add access-control tests (was 0% coverage)"
```

---

### Task 5: Test books.ts and authors.ts server functions

**Files:**
- Create: `apps/web/src/server/books.test.ts`
- Create: `apps/web/src/server/authors.test.ts`

- [ ] **Step 1: Write books.test.ts**

Read `src/server/books.ts` first. Mock `src/db`, `src/server/middleware`, `src/server/access-control`. Use the same DB mock pattern as Task 4.

Test `getBooksByLibraryFn`: pagination (limit/offset), search filtering with like operator, library access enforcement via requireLibraryAccess.

Test `getBookDetailFn`: returns book with files/authors/series/tags, calls assertUserCanAccessBook, handles null series.

Test `getRecentBooksFn`: limit parameter, ordering by creation date desc, calls getAccessibleLibraryIds.

- [ ] **Step 2: Write authors.test.ts**

Read `src/server/authors.ts`. Mock same deps.

Test `getAuthorDetailFn`: returns author with books, calls assertUserCanAccessAuthor, filters books by accessible libraries.

Test `getSeriesDetailFn`: returns series with books, calls assertUserCanAccessSeries, orders by seriesIndex.

- [ ] **Step 3: Run tests**

```bash
cd apps/web && bunx vitest run src/server/books.test.ts src/server/authors.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/books.test.ts apps/web/src/server/authors.test.ts
git commit -m "test: add books and authors server function tests"
```

---

### Task 6: Test shelves.ts server functions

**Files:**
- Create: `apps/web/src/server/shelves.test.ts`

- [ ] **Step 1: Write shelves.test.ts**

This is a complex module with 9 exported functions and smart filter logic. Read `src/server/shelves.ts` carefully. Mock `src/db`, `src/server/middleware`, `src/server/access-control`.

Test all exported functions:
- `getShelvesFn`: returns shelves for current user
- `getShelfFn`: returns single shelf, ownership check
- `getShelfBooksFn`: manual shelves (query shelvesBooks join), smart shelves (evaluateSmartShelf)
- `createShelfFn`: manual type creation, smart type with filterRules
- `updateShelfFn`: name/filterRules/sortOrder updates
- `deleteShelfFn`: ownership verification
- `addBookToShelfFn`: validates manual type only, onConflictDoNothing
- `removeBookFromShelfFn`: ownership verification
- `getBookMembershipFn`: returns shelf/collection/reading-list IDs

Test the filter condition builder:
- Each field type: title, author, tag, series, rating, hasProgress, isFinished
- Each operation: contains, equals, startsWith, greaterThan, lessThan, exists
- AND/OR logic with multiple conditions

- [ ] **Step 2: Run test**

```bash
cd apps/web && bunx vitest run src/server/shelves.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/shelves.test.ts
git commit -m "test: add shelves server function tests with smart filter coverage"
```

---

### Task 7: Test collections.ts and reading-lists.ts

**Files:**
- Create: `apps/web/src/server/collections.test.ts`
- Create: `apps/web/src/server/reading-lists.test.ts`

- [ ] **Step 1: Write collections.test.ts**

Read `src/server/collections.ts`. Test all 7 exported functions:
- `getCollectionsFn`: book count aggregation, user filtering
- `getCollectionBooksFn`: accessible library filtering
- `createCollectionFn`: name validation, user assignment
- `updateCollectionFn`: ownership check, coverImage update
- `deleteCollectionFn`: ownership check
- `addBookToCollectionFn`: book access + collection ownership, onConflictDoNothing
- `removeBookFromCollectionFn`: ownership check

- [ ] **Step 2: Write reading-lists.test.ts**

Read `src/server/reading-lists.ts`. Test all 8 exported functions:
- `getReadingListsFn`: book count aggregation
- `getReadingListBooksFn`: sortOrder ordering, accessible library filtering
- `createReadingListFn`: user assignment
- `updateReadingListFn`: ownership check
- `deleteReadingListFn`: ownership check
- `addBookToReadingListFn`: auto-increment sortOrder (max + 1, or 0 if null)
- `removeBookFromReadingListFn`: ownership check
- `reorderReadingListFn`: bulk sortOrder update via Promise.all, parallel access verification

- [ ] **Step 3: Run tests and commit**

```bash
cd apps/web && bunx vitest run src/server/collections.test.ts src/server/reading-lists.test.ts
git add apps/web/src/server/collections.test.ts apps/web/src/server/reading-lists.test.ts
git commit -m "test: add collections and reading-lists server function tests"
```

---

### Task 8: Test search.ts and reading.ts

**Files:**
- Create: `apps/web/src/server/search.test.ts`
- Create: `apps/web/src/server/reading.test.ts`

- [ ] **Step 1: Write search.test.ts**

Read `src/server/search.ts`. Test:
- `searchFn`: like-based pattern matching across books/authors/series, library access filtering via getAccessibleLibraryIds, limit parameter, empty accessible libraries returns empty results
- `getContinueReadingFn`: filters isFinished=false AND progress > 0, orders by updatedAt desc, accessible library filtering

- [ ] **Step 2: Write reading.test.ts**

Read `src/server/reading.ts`. Test:
- `getReadingProgressFn`: returns progress entries filtered by bookId and userId
- `saveReadingProgressFn`: normalizes progress via normalizeReadingProgress, auto-sets isFinished=true when progress >= 1.0, upsert logic (update existing record vs insert new by userId/bookId/deviceType composite)

- [ ] **Step 3: Run tests and commit**

```bash
cd apps/web && bunx vitest run src/server/search.test.ts src/server/reading.test.ts
git add apps/web/src/server/search.test.ts apps/web/src/server/reading.test.ts
git commit -m "test: add search and reading server function tests"
```

---

### Task 9: Test conversion pipeline

**Files:**
- Create: `apps/web/src/server/conversion.test.ts`
- Create: `apps/web/src/server/converter.test.ts`
- Create: `apps/web/src/server/conversion-options.test.ts`

- [ ] **Step 1: Write conversion-options.test.ts**

```typescript
import { describe, expect, test } from "vitest";
import { getSupportedConversions } from "src/server/conversion-options";

describe("getSupportedConversions", () => {
	test("returns target formats for epub including kepub", () => {
		const result = getSupportedConversions("epub");
		expect(result).toContain("kepub");
		expect(result).toContain("mobi");
		expect(result).toContain("pdf");
	});

	test("returns target formats for mobi without kepub", () => {
		const result = getSupportedConversions("mobi");
		expect(result).toContain("epub");
		expect(result).not.toContain("kepub");
	});

	test("returns empty array for unknown format", () => {
		const result = getSupportedConversions("xyz");
		expect(result).toEqual([]);
	});

	test("returns formats for docx", () => {
		const result = getSupportedConversions("docx");
		expect(result).toContain("epub");
		expect(result).toContain("pdf");
	});
});
```

- [ ] **Step 2: Write conversion.test.ts**

Read `src/server/conversion.ts`. Mock DB, middleware, access-control, conversion-options. Test:
- `requestConversionFn`: creates job record with type "convert", validates format, access control
- `getSupportedConversionsFn`: delegates to getSupportedConversions
- `getJobsForBookFn`: JSON extraction query, access control
- `getRecentJobsFn`: admin-only check (requireAdmin), returns last 50 jobs

- [ ] **Step 3: Write converter.test.ts**

Read `src/server/converter.ts`. Mock `node:child_process` (promisified execFile), `node:fs`, `node:path`, `src/db`. Test:
- `convertBook`: fetches book file from DB, routes to kepubify for "kepub" target, pandoc for others, creates output directory, inserts new BookFile record
- `sanitizeFilename`: removes special chars, replaces spaces with underscores, truncates to 200 chars
- Error cases: missing book in DB, missing file record, conversion CLI failure

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/web && bunx vitest run src/server/conversion-options.test.ts src/server/conversion.test.ts src/server/converter.test.ts
git add apps/web/src/server/conversion-options.test.ts apps/web/src/server/conversion.test.ts apps/web/src/server/converter.test.ts
git commit -m "test: add conversion pipeline tests"
```

---

### Task 10: Test middleware, http-errors, request-auth-resolver

**Files:**
- Create: `apps/web/src/server/http-errors.test.ts`
- Create: `apps/web/src/server/middleware.test.ts`
- Create: `apps/web/src/server/request-auth-resolver.test.ts`

- [ ] **Step 1: Write http-errors.test.ts**

```typescript
import { describe, expect, test } from "vitest";
import {
	ForbiddenError,
	HttpError,
	NotFoundError,
	UnauthorizedError,
	responseFromHttpError,
} from "src/server/http-errors";

describe("HttpError classes", () => {
	test("UnauthorizedError has status 401", () => {
		const err = new UnauthorizedError();
		expect(err.status).toBe(401);
		expect(err.message).toBe("Unauthorized");
		expect(err).toBeInstanceOf(HttpError);
		expect(err).toBeInstanceOf(Error);
	});

	test("ForbiddenError has status 403", () => {
		const err = new ForbiddenError();
		expect(err.status).toBe(403);
		expect(err.message).toBe("Forbidden");
	});

	test("NotFoundError has status 404", () => {
		const err = new NotFoundError();
		expect(err.status).toBe(404);
		expect(err.message).toBe("Not found");
	});

	test("accepts custom message", () => {
		const err = new NotFoundError("Book not found");
		expect(err.message).toBe("Book not found");
		expect(err.status).toBe(404);
	});
});

describe("responseFromHttpError", () => {
	test("returns text response for HttpError", () => {
		const err = new NotFoundError();
		const res = responseFromHttpError(err);
		expect(res).toBeInstanceOf(Response);
		expect(res!.status).toBe(404);
	});

	test("returns JSON response when asJsonError is true", async () => {
		const err = new ForbiddenError("No access");
		const res = responseFromHttpError(err, { asJsonError: true });
		const body = await res!.json();
		expect(body).toEqual({ error: "No access" });
	});

	test("returns null for non-HttpError", () => {
		const res = responseFromHttpError(new Error("regular error"));
		expect(res).toBeNull();
	});

	test("returns null for non-error values", () => {
		expect(responseFromHttpError("string")).toBeNull();
		expect(responseFromHttpError(null)).toBeNull();
	});
});
```

- [ ] **Step 2: Write middleware.test.ts**

Read `src/server/middleware.ts`. Mock `src/lib/auth`, `src/db`, `@tanstack/react-start/server`. Test:
- `requireAuth`: returns session when authenticated, throws UnauthorizedError when no session
- `requireAdmin`: returns session for admin, throws ForbiddenError for non-admin
- `requireLibraryAccess`: delegates to assertUserCanAccessLibrary
- `getAuthSessionFn`: augments session with user role from DB

- [ ] **Step 3: Write request-auth-resolver.test.ts**

Read `src/server/request-auth-resolver.ts`. Mock `src/lib/auth`, `src/server/kobo`, `src/server/opds`. Test:
- `resolveRequestAuth`: tries session auth first, falls back to OPDS auth, then Kobo token from query params, returns null if all fail
- `requireRequestAuth`: throws UnauthorizedError when resolveRequestAuth returns null
- Test each fallback independently

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/web && bunx vitest run src/server/http-errors.test.ts src/server/middleware.test.ts src/server/request-auth-resolver.test.ts
git add apps/web/src/server/http-errors.test.ts apps/web/src/server/middleware.test.ts apps/web/src/server/request-auth-resolver.test.ts
git commit -m "test: add middleware, http-errors, and request-auth-resolver tests"
```

---

### Task 11: Test remaining server modules

**Files:**
- Create: `apps/web/src/server/epub-fixer.test.ts`
- Create: `apps/web/src/server/scheduler.test.ts`
- Create: `apps/web/src/server/scan-actions.test.ts`
- Create: `apps/web/src/server/auth.test.ts`

- [ ] **Step 1: Write epub-fixer.test.ts**

Read `src/server/epub-fixer.ts`. Mock `adm-zip`, `node:fs`, `node:path`, `src/db`. Test:
- `fixEpub`: returns null when no changes needed, creates new BookFile when EPUB content is fixed
- `stripNullBytes`: removes null bytes from content
- `addXmlDeclarationIfMissing`: adds XML declaration when absent, no-op when present
- `addXmlLangIfMissing`: adds xml:lang to html tag when missing
- `fixEntryContent`: composes all fixes, returns changed=true when any fix applied
- Error cases: file not found in DB, non-EPUB format

- [ ] **Step 2: Write scheduler.test.ts**

Read `src/server/scheduler.ts`. Mock `src/db`, `src/server/scanner`, `src/server/job-worker`. Use `vi.useFakeTimers()`. Test:
- `ensureSchedulerStarted`: singleton pattern (second call is no-op)
- `checkAndRunDueScans`: triggers scan when interval elapsed since lastScannedAt, skips when not due
- Error resilience: scan failure doesn't crash scheduler (errors caught silently)

- [ ] **Step 3: Write scan-actions.test.ts**

Read `src/server/scan-actions.ts`. Mock `src/server/middleware` (requireAdmin). Test:
- `triggerScanFn`: admin-only (calls requireAdmin), dynamically imports scanner module, calls scanLibrary with libraryId
- `triggerScanAllFn`: admin-only, calls scanAllLibraries

- [ ] **Step 4: Write auth.test.ts**

Read `src/server/auth.ts`. Mock `src/db`. Test:
- `getIsFirstUserFn`: returns { isFirstUser: true } when user count is 0, returns false when users exist

- [ ] **Step 5: Run tests and commit**

```bash
cd apps/web && bunx vitest run src/server/epub-fixer.test.ts src/server/scheduler.test.ts src/server/scan-actions.test.ts src/server/auth.test.ts
git add apps/web/src/server/epub-fixer.test.ts apps/web/src/server/scheduler.test.ts apps/web/src/server/scan-actions.test.ts apps/web/src/server/auth.test.ts
git commit -m "test: add epub-fixer, scheduler, scan-actions, and auth tests"
```

---

### Task 12: Improve existing server test coverage to 95%

**Files:**
- Modify: existing test files as needed

- [ ] **Step 1: Run coverage and identify gaps**

```bash
cd apps/web && bunx vitest run --coverage 2>&1
```

Review the full coverage table. Focus on files below 95%: kobo.ts (20%), job-worker.ts (38%), opds.ts (59%), scanner.ts (66%), plus any newly tested files with gaps.

- [ ] **Step 2: Add missing kobo.ts coverage**

Read `src/server/kobo.ts` and `src/server/kobo-auth.test.ts`. Add tests for uncovered branches: token creation/hashing, device auth flow, all error paths, bookmark sync operations, library initialization.

- [ ] **Step 3: Add missing opds.ts coverage**

Read `src/server/opds.ts` and `src/server/opds-auth.test.ts`. Add tests for: OPDS feed generation with multiple books, pagination next/prev links, cover URL generation, MIME type mapping, error paths.

- [ ] **Step 4: Add missing job-worker.ts coverage**

Read `src/server/job-worker.ts` and `src/server/job-worker.test.ts`. Add tests for: job polling, retry logic (attempts < maxAttempts), failed job handling, multiple job types, worker start/stop states.

- [ ] **Step 5: Add missing scanner.ts coverage**

Read `src/server/scanner.ts` and `src/server/scanner.test.ts`. Add tests for: full rescan flow, new book discovery, author/series/tag updates, missing book detection, edge cases (empty dir, unsupported formats).

- [ ] **Step 6: Run coverage to verify**

```bash
cd apps/web && bunx vitest run --coverage
```

Verify all server files are at or above 95%.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: improve existing server test coverage to 95%"
```

---

## Phase 3: Lib, DB, and API Route Tests

### Task 13: Test lib utilities

**Files:**
- Create: `apps/web/src/lib/utils.test.ts`
- Create: `apps/web/src/lib/validators.test.ts`
- Create: `apps/web/src/lib/query-keys.test.ts`

- [ ] **Step 1: Write utils.test.ts**

```typescript
import { describe, expect, test } from "vitest";
import { cn } from "src/lib/utils";

describe("cn", () => {
	test("merges class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	test("handles conditional classes", () => {
		expect(cn("base", false && "hidden", "extra")).toBe("base extra");
	});

	test("resolves tailwind conflicts", () => {
		expect(cn("p-4", "p-2")).toBe("p-2");
	});

	test("handles undefined and null", () => {
		expect(cn("base", undefined, null, "end")).toBe("base end");
	});

	test("handles empty call", () => {
		expect(cn()).toBe("");
	});
});
```

- [ ] **Step 2: Write validators.test.ts**

```typescript
import { describe, expect, test, vi } from "vitest";

vi.mock("src/server/path-safety", () => ({
	isValidLibraryScanPath: vi.fn((path: string) => !path.startsWith("/etc")),
}));

describe("createShelfSchema", () => {
	test("accepts valid manual shelf", async () => {
		const { createShelfSchema } = await import("src/lib/validators");
		const result = createShelfSchema.safeParse({ name: "My Shelf", type: "manual" });
		expect(result.success).toBe(true);
	});

	test("accepts valid smart shelf with filter rules", async () => {
		const { createShelfSchema } = await import("src/lib/validators");
		const result = createShelfSchema.safeParse({
			name: "Smart Shelf",
			type: "smart",
			filterRules: { operator: "and", conditions: [{ field: "title", operation: "contains", value: "test" }] },
		});
		expect(result.success).toBe(true);
	});

	test("rejects empty name", async () => {
		const { createShelfSchema } = await import("src/lib/validators");
		expect(createShelfSchema.safeParse({ name: "", type: "manual" }).success).toBe(false);
	});

	test("rejects invalid type", async () => {
		const { createShelfSchema } = await import("src/lib/validators");
		expect(createShelfSchema.safeParse({ name: "test", type: "invalid" }).success).toBe(false);
	});
});

describe("createCollectionSchema", () => {
	test("accepts valid collection", async () => {
		const { createCollectionSchema } = await import("src/lib/validators");
		expect(createCollectionSchema.safeParse({ name: "My Collection" }).success).toBe(true);
	});

	test("rejects empty name", async () => {
		const { createCollectionSchema } = await import("src/lib/validators");
		expect(createCollectionSchema.safeParse({ name: "" }).success).toBe(false);
	});
});

describe("createReadingListSchema", () => {
	test("accepts valid reading list", async () => {
		const { createReadingListSchema } = await import("src/lib/validators");
		expect(createReadingListSchema.safeParse({ name: "My List" }).success).toBe(true);
	});
});

describe("createLibrarySchema", () => {
	test("accepts valid library", async () => {
		const { createLibrarySchema } = await import("src/lib/validators");
		const result = createLibrarySchema.safeParse({
			name: "Books", type: "book", scanPaths: [{ value: "/data/books" }], scanInterval: 60,
		});
		expect(result.success).toBe(true);
	});

	test("rejects invalid library type", async () => {
		const { createLibrarySchema } = await import("src/lib/validators");
		expect(createLibrarySchema.safeParse({
			name: "Books", type: "invalid", scanPaths: [{ value: "/data" }], scanInterval: 60,
		}).success).toBe(false);
	});

	test("rejects dangerous scan paths", async () => {
		const { createLibrarySchema } = await import("src/lib/validators");
		expect(createLibrarySchema.safeParse({
			name: "Books", type: "book", scanPaths: [{ value: "/etc/passwd" }], scanInterval: 60,
		}).success).toBe(false);
	});
});
```

- [ ] **Step 3: Write query-keys.test.ts**

```typescript
import { describe, expect, test } from "vitest";
import { queryKeys } from "src/lib/query-keys";

describe("queryKeys", () => {
	test("libraries keys have correct structure", () => {
		expect(queryKeys.libraries.all).toBeDefined();
		expect(queryKeys.libraries.list()).toEqual(expect.arrayContaining(["libraries"]));
	});

	test("books detail key includes book ID", () => {
		const key = queryKeys.books.detail(42);
		expect(key).toContain(42);
	});

	test("shelves books key includes shelf ID", () => {
		const key = queryKeys.shelves.books(7);
		expect(key).toContain(7);
	});

	test("search key includes query", () => {
		const key = queryKeys.search("hello");
		expect(key).toContain("hello");
	});

	test("reading progress key includes book ID", () => {
		const key = queryKeys.readingProgress(5);
		expect(key).toContain(5);
	});
});
```

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/web && bunx vitest run src/lib/utils.test.ts src/lib/validators.test.ts src/lib/query-keys.test.ts
git add apps/web/src/lib/utils.test.ts apps/web/src/lib/validators.test.ts apps/web/src/lib/query-keys.test.ts
git commit -m "test: add lib utility tests (utils, validators, query-keys)"
```

---

### Task 14: Test DB schema exports

**Files:**
- Create: `apps/web/src/db/schema/schema.test.ts`

- [ ] **Step 1: Write schema.test.ts**

```typescript
import { describe, expect, test } from "vitest";
import * as schema from "src/db/schema";

describe("schema exports", () => {
	const expectedTables = [
		"user", "session", "account", "verification",
		"books", "authors", "series", "booksAuthors", "tags", "booksTags", "bookFiles",
		"jobs",
		"libraries", "libraryAccess",
		"shelves", "shelvesBooks", "collections", "collectionsBooks",
		"readingLists", "readingListBooks",
		"readingProgress", "annotations",
		"koboTokens", "opdsKeys",
	];

	for (const table of expectedTables) {
		test(`exports ${table} table`, () => {
			expect((schema as Record<string, unknown>)[table]).toBeDefined();
		});
	}
});
```

- [ ] **Step 2: Run test and commit**

```bash
cd apps/web && bunx vitest run src/db/schema/schema.test.ts
git add apps/web/src/db/schema/schema.test.ts
git commit -m "test: add DB schema export validation tests"
```

---

## Phase 4: Browser Test Infrastructure

### Task 15: First browser test (button component)

**Files:**
- Create: `apps/web/src/components/ui/button.browser.test.tsx`

- [ ] **Step 1: Write button.browser.test.tsx**

```tsx
import { render } from "vitest-browser-react";
import { describe, expect, test, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
	test("renders with text content", async () => {
		const screen = await render(<Button>Click me</Button>);
		await expect.element(screen.getByRole("button", { name: "Click me" })).toBeVisible();
	});

	test("renders destructive variant", async () => {
		const screen = await render(<Button variant="destructive">Delete</Button>);
		await expect.element(screen.getByRole("button", { name: "Delete" })).toBeVisible();
	});

	test("renders all variant types", async () => {
		for (const variant of ["default", "outline", "secondary", "ghost", "link"] as const) {
			const screen = await render(<Button variant={variant}>{variant}</Button>);
			await expect.element(screen.getByRole("button")).toBeVisible();
		}
	});

	test("renders different sizes", async () => {
		for (const size of ["default", "sm", "lg", "icon"] as const) {
			const screen = await render(<Button size={size}>btn</Button>);
			await expect.element(screen.getByRole("button")).toBeVisible();
		}
	});

	test("handles click events", async () => {
		const onClick = vi.fn();
		const screen = await render(<Button onClick={onClick}>Click</Button>);
		await screen.getByRole("button").click();
		expect(onClick).toHaveBeenCalledOnce();
	});

	test("can be disabled", async () => {
		const screen = await render(<Button disabled>Disabled</Button>);
		await expect.element(screen.getByRole("button")).toBeDisabled();
	});

	test("renders as child element with asChild", async () => {
		const screen = await render(
			<Button asChild><a href="/test">Link Button</a></Button>,
		);
		await expect.element(screen.getByRole("link")).toBeVisible();
	});
});
```

- [ ] **Step 2: Run the browser test**

```bash
cd apps/web && bunx vitest run --project browser src/components/ui/button.browser.test.tsx
```

Expected: All tests pass in Chromium. If playwright browsers aren't installed, run `bunx playwright install chromium` first.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/button.browser.test.tsx
git commit -m "test: add first browser test (button) validating Playwright setup"
```

---

## Phase 5: shadcn/ui Component Tests

### Task 16: Simple display components

**Files:**
- Create: `apps/web/src/components/ui/badge.browser.test.tsx`
- Create: `apps/web/src/components/ui/card.browser.test.tsx`
- Create: `apps/web/src/components/ui/separator.browser.test.tsx`
- Create: `apps/web/src/components/ui/skeleton.browser.test.tsx`
- Create: `apps/web/src/components/ui/input.browser.test.tsx`
- Create: `apps/web/src/components/ui/label.browser.test.tsx`

- [ ] **Step 1: Write all simple component tests**

Read each source file. Follow the button test pattern for each:

**badge:** Render each variant (default, secondary, destructive, outline), test asChild, test custom className.

**card:** Render Card with CardHeader, CardTitle, CardDescription, CardContent, CardFooter. Verify all sub-components render their children.

**separator:** Render horizontal (default) and vertical orientations. Verify role="separator".

**skeleton:** Render, verify container element renders (has animate-pulse styling).

**input:** Test value changes via `userEvent.fill()`, disabled state, placeholder, type variants (text, password, email).

**label:** Render with text content, verify it renders visible text.

- [ ] **Step 2: Run tests**

```bash
cd apps/web && bunx vitest run --project browser src/components/ui/badge.browser.test.tsx src/components/ui/card.browser.test.tsx src/components/ui/separator.browser.test.tsx src/components/ui/skeleton.browser.test.tsx src/components/ui/input.browser.test.tsx src/components/ui/label.browser.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/*.browser.test.tsx
git commit -m "test: add browser tests for simple shadcn/ui display components"
```

---

### Task 17: Interactive shadcn/ui components

**Files:**
- Create: `apps/web/src/components/ui/dialog.browser.test.tsx`
- Create: `apps/web/src/components/ui/sheet.browser.test.tsx`
- Create: `apps/web/src/components/ui/tooltip.browser.test.tsx`
- Create: `apps/web/src/components/ui/select.browser.test.tsx`
- Create: `apps/web/src/components/ui/dropdown-menu.browser.test.tsx`

- [ ] **Step 1: Write dialog.browser.test.tsx**

```tsx
import { render } from "vitest-browser-react";
import { describe, expect, test } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Button } from "./button";

describe("Dialog", () => {
	test("opens when trigger is clicked", async () => {
		const screen = await render(
			<Dialog>
				<DialogTrigger asChild><Button>Open</Button></DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Test Dialog</DialogTitle>
						<DialogDescription>Description here</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);
		await screen.getByRole("button", { name: "Open" }).click();
		await expect.element(screen.getByRole("dialog")).toBeVisible();
		await expect.element(screen.getByText("Test Dialog")).toBeVisible();
	});

	test("closes when close button is clicked", async () => {
		const screen = await render(
			<Dialog defaultOpen>
				<DialogContent><DialogTitle>Test</DialogTitle></DialogContent>
			</Dialog>,
		);
		await expect.element(screen.getByRole("dialog")).toBeVisible();
		await screen.getByRole("button", { name: /close/i }).click();
		await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Write remaining interactive component tests**

**sheet.browser.test.tsx:** Test open/close, side prop (left, right), SheetHeader/Title/Description rendering. Use defaultOpen for initial render tests.

**tooltip.browser.test.tsx:** Render TooltipProvider > Tooltip > TooltipTrigger + TooltipContent. Test hover shows content, unhover hides it.

**select.browser.test.tsx:** Render Select with SelectTrigger, SelectContent, SelectItems. Test clicking trigger opens dropdown, selecting item updates value.

**dropdown-menu.browser.test.tsx:** Test menu opens on trigger click, menu items render, item click fires handler.

- [ ] **Step 3: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/ui/dialog.browser.test.tsx src/components/ui/sheet.browser.test.tsx src/components/ui/tooltip.browser.test.tsx src/components/ui/select.browser.test.tsx src/components/ui/dropdown-menu.browser.test.tsx
git add apps/web/src/components/ui/*.browser.test.tsx
git commit -m "test: add browser tests for interactive shadcn/ui components"
```

---

### Task 18: Complex shadcn/ui (form, sidebar, sonner)

**Files:**
- Create: `apps/web/src/components/ui/form.browser.test.tsx`
- Create: `apps/web/src/components/ui/sidebar.browser.test.tsx`
- Create: `apps/web/src/components/ui/sonner.browser.test.tsx`

- [ ] **Step 1: Write form.browser.test.tsx**

```tsx
import { render } from "vitest-browser-react";
import { describe, expect, test } from "vitest";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./form";
import { Input } from "./input";

function TestForm() {
	const form = useForm({ defaultValues: { name: "" } });
	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(() => {})}>
				<FormField control={form.control} name="name" rules={{ required: "Name is required" }}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl><Input {...field} /></FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<button type="submit">Submit</button>
			</form>
		</Form>
	);
}

describe("Form", () => {
	test("renders form with label and input", async () => {
		const screen = await render(<TestForm />);
		await expect.element(screen.getByText("Name")).toBeVisible();
		await expect.element(screen.getByRole("textbox")).toBeVisible();
	});

	test("shows validation error on submit", async () => {
		const screen = await render(<TestForm />);
		await screen.getByRole("button", { name: "Submit" }).click();
		await expect.element(screen.getByText("Name is required")).toBeVisible();
	});
});
```

- [ ] **Step 2: Write sidebar.browser.test.tsx**

Mock `src/hooks/use-mobile` to control mobile vs desktop. Test:
- SidebarProvider renders children
- SidebarTrigger toggles open state
- SidebarMenuButton shows active state
- Collapsed state hides menu text

- [ ] **Step 3: Write sonner.browser.test.tsx**

Mock `next-themes` useTheme. Test Toaster component renders without errors.

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/ui/form.browser.test.tsx src/components/ui/sidebar.browser.test.tsx src/components/ui/sonner.browser.test.tsx
git add apps/web/src/components/ui/*.browser.test.tsx
git commit -m "test: add browser tests for complex shadcn/ui components"
```

---

## Phase 6: Domain Component Tests

### Task 19: Library components

**Files:**
- Create: `apps/web/src/components/library/book-card.browser.test.tsx`
- Create: `apps/web/src/components/library/book-grid.browser.test.tsx`
- Create: `apps/web/src/components/library/library-header.browser.test.tsx`
- Create: `apps/web/src/components/library/convert-dialog.browser.test.tsx`

- [ ] **Step 1: Write all library component tests**

Mock `@tanstack/react-router` (Link as `<a>`) for all tests.

**book-card:** Test renders title and author, shows placeholder when coverPath is null, links to book detail.

**book-grid:** Test loading state (12 skeletons), empty state ("No books found"), populated state (renders BookCards).

**library-header:** Test title + book count badge, search input onChange, scan button admin-only and disabled while scanning.

**convert-dialog:** Mock `@tanstack/react-query` and server functions. Test dialog open, format loading, format selection, convert button submission.

- [ ] **Step 2: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/library/
git add apps/web/src/components/library/*.browser.test.tsx
git commit -m "test: add browser tests for library components"
```

---

### Task 20: Organization components

**Files:**
- Create: `apps/web/src/components/organization/add-to-shelf.browser.test.tsx`
- Create: `apps/web/src/components/organization/collection-form.browser.test.tsx`
- Create: `apps/web/src/components/organization/reading-list-form.browser.test.tsx`
- Create: `apps/web/src/components/organization/shelf-form.browser.test.tsx`
- Create: `apps/web/src/components/organization/smart-filter-builder.browser.test.tsx`

- [ ] **Step 1: Write all organization component tests**

Mock `@tanstack/react-query`, `sonner`, and relevant server functions for each.

**add-to-shelf:** Test dropdown renders sections (Shelves, Collections, Reading Lists), checkmarks for added items, toggle behavior.

**collection-form:** Test create mode (empty form), edit mode (pre-filled), validation, submit success.

**reading-list-form:** Same pattern as collection-form with reading list text.

**shelf-form:** Test manual/smart type toggle, SmartFilterBuilder appears for smart type, submit includes filterRules.

**smart-filter-builder:** Test AND/OR toggle, add condition, remove condition, field selection changes defaults.

- [ ] **Step 2: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/organization/
git add apps/web/src/components/organization/*.browser.test.tsx
git commit -m "test: add browser tests for organization components"
```

---

### Task 21: Settings and reader simple components

**Files:**
- Create: `apps/web/src/components/settings/library-form.browser.test.tsx`
- Create: `apps/web/src/components/reader/reader-progress-bar.browser.test.tsx`
- Create: `apps/web/src/components/reader/reader-toolbar.browser.test.tsx`
- Create: `apps/web/src/components/reader/reader-settings.browser.test.tsx`
- Create: `apps/web/src/components/reader/toc-drawer.browser.test.tsx`

- [ ] **Step 1: Write library-form.browser.test.tsx**

Mock React Query and server functions. Test create/edit mode, dynamic scan paths add/remove, validation, submit.

- [ ] **Step 2: Write reader-progress-bar.browser.test.tsx**

```tsx
import { render } from "vitest-browser-react";
import { describe, expect, test } from "vitest";
import { ReaderProgressBar } from "./reader-progress-bar";

describe("ReaderProgressBar", () => {
	test("renders position label and percentage", async () => {
		const screen = await render(
			<ReaderProgressBar fraction={0.42} positionLabel="Chapter 3" visible={true} />,
		);
		await expect.element(screen.getByText("Chapter 3")).toBeVisible();
		await expect.element(screen.getByText("42%")).toBeVisible();
	});

	test("clamps percentage to 0-100", async () => {
		const screen = await render(
			<ReaderProgressBar fraction={1.5} positionLabel="End" visible={true} />,
		);
		await expect.element(screen.getByText("100%")).toBeVisible();
	});

	test("shows saving indicator", async () => {
		const screen = await render(
			<ReaderProgressBar fraction={0.5} positionLabel="Mid" isSaving={true} visible={true} />,
		);
		await expect.element(screen.getByText(/saving/i)).toBeVisible();
	});
});
```

- [ ] **Step 3: Write reader-toolbar, reader-settings, toc-drawer tests**

**reader-toolbar:** Mock router Link. Test renders book title, chapter subtitle, TOC/Settings button handlers, back link.

**reader-settings:** Test renders all setting sections. Test slider/button changes call onUpdateSettings. Test reset button.

**toc-drawer:** Test renders TOC items, clicking calls onSelect, active item highlighted, empty state.

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/settings/ src/components/reader/
git add apps/web/src/components/settings/*.browser.test.tsx apps/web/src/components/reader/*.browser.test.tsx
git commit -m "test: add browser tests for settings and reader simple components"
```

---

## Phase 7: Complex Reader & Layout Tests

### Task 22: Complex reader components

**Files:**
- Create: `apps/web/src/components/reader/ebook-reader.browser.test.tsx`
- Create: `apps/web/src/components/reader/pdf-reader.browser.test.tsx`

- [ ] **Step 1: Write ebook-reader.browser.test.tsx**

Mock foliate-js dynamic import at module level with a minimal reader object. Mock global fetch for book file loading.

Test: renders container element, exposes navigation ref methods (next/prev/goTo), calls onTocAvailable after mount.

- [ ] **Step 2: Write pdf-reader.browser.test.tsx**

Mock `react-pdf` Document/Page components. Mock pdfjs-dist worker. Test: renders document container, displays page number, navigation works, dark theme applies filter.

- [ ] **Step 3: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/reader/ebook-reader.browser.test.tsx src/components/reader/pdf-reader.browser.test.tsx
git add apps/web/src/components/reader/*.browser.test.tsx
git commit -m "test: add browser tests for ebook-reader and pdf-reader"
```

---

### Task 23: Layout components

**Files:**
- Create: `apps/web/src/components/layout/app-layout.browser.test.tsx`
- Create: `apps/web/src/components/layout/app-sidebar.browser.test.tsx`
- Create: `apps/web/src/components/layout/header.browser.test.tsx`

- [ ] **Step 1: Write layout component tests**

Common mocks for all layout tests:
- `@tanstack/react-router`: Link as `<a>`, useRouterState returning pathname
- `src/lib/auth-client`: useSession returning test user, signOut as vi.fn
- `@tanstack/react-query`: useQuery returning mock data

**app-layout:** Test renders sidebar + header + children.

**app-sidebar:** Test renders logo, Home link, Libraries section, Shelves with create button, Collections with create button, Admin section (conditional on role), Sign Out button.

**header:** Test renders sidebar trigger, search link.

- [ ] **Step 2: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/components/layout/
git add apps/web/src/components/layout/*.browser.test.tsx
git commit -m "test: add browser tests for layout components"
```

---

## Phase 8: Page Component Tests

### Task 24: Auth and root pages

**Files:**
- Create: `apps/web/src/routes/login.browser.test.tsx`
- Create: `apps/web/src/routes/register.browser.test.tsx`
- Create: `apps/web/src/routes/__root.browser.test.tsx`

- [ ] **Step 1: Write page tests**

Read each route file to understand how the component is exported (Route.component or direct export). Extract the component for testing.

**login:** Mock auth-client signIn. Test renders email/password fields, login button, link to register, form submission.

**register:** Mock auth-client signUp. Test renders name/email/password fields, submit button, link to login.

**__root:** Mock router Outlet. Test renders outlet and Toaster.

- [ ] **Step 2: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/routes/login.browser.test.tsx src/routes/register.browser.test.tsx src/routes/__root.browser.test.tsx
git add apps/web/src/routes/*.browser.test.tsx
git commit -m "test: add browser tests for auth and root pages"
```

---

### Task 25: Main app pages

**Files:**
- Create: `apps/web/src/routes/_authed/index.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/search.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/books.$bookId.browser.test.tsx`

- [ ] **Step 1: Write main app page tests**

Mock server functions, React Query (useQuery/useMutation), router (Link, useParams, useNavigate), auth (useSession).

**index (home):** Test "Continue Reading" and "Recently Added" sections, loading skeletons, empty state.

**search:** Test search input, debounced query, results in books/authors/series sections, empty results.

**books.$bookId:** Test book detail display (title, cover, description, authors, files table), read button, convert dialog trigger, add-to-shelf trigger.

- [ ] **Step 2: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/routes/_authed/index.browser.test.tsx src/routes/_authed/search.browser.test.tsx "src/routes/_authed/books.\$bookId.browser.test.tsx"
git add apps/web/src/routes/_authed/*.browser.test.tsx
git commit -m "test: add browser tests for main app pages"
```

---

### Task 26: Detail pages

**Files:**
- Create: `apps/web/src/routes/_authed/authors.$authorId.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/series.$seriesId.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/collections.$collectionId.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/reading-lists.$listId.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/shelves.$shelfId.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/libraries.$libraryId.browser.test.tsx`

- [ ] **Step 1: Write all detail page tests**

Each follows the same pattern: mock server functions and router params, render component, verify data display.

**authors.$authorId:** Renders author name, bio, book count, BookGrid.
**series.$seriesId:** Renders series name, books with index badges.
**collections.$collectionId:** Renders name, BookGrid, edit/delete buttons, delete confirmation.
**reading-lists.$listId:** Renders ordered books, reorder buttons, remove buttons, edit/delete.
**shelves.$shelfId:** Renders name with type badge, BookGrid, edit/delete buttons.
**libraries.$libraryId:** Renders LibraryHeader with search/scan, BookGrid.

- [ ] **Step 2: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/routes/_authed/authors* src/routes/_authed/series* src/routes/_authed/collections* src/routes/_authed/reading-lists* src/routes/_authed/shelves* src/routes/_authed/libraries*
git add apps/web/src/routes/_authed/*.browser.test.tsx
git commit -m "test: add browser tests for detail pages"
```

---

### Task 27: Settings pages and reader page

**Files:**
- Create: `apps/web/src/routes/_authed/settings/general.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/settings/libraries.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/settings/scanning.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/settings/jobs.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/settings/sync.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/settings/users.browser.test.tsx`
- Create: `apps/web/src/routes/_authed/read.$bookId.$fileId.browser.test.tsx`

- [ ] **Step 1: Write settings page tests**

**general:** Renders page content (placeholder).
**libraries:** Library table, create button opens LibraryForm, delete confirmation.
**scanning:** Library list with scan info, individual scan buttons, scan-all button.
**jobs:** Job table with type badges, status, timestamps, error messages.
**sync:** KoSync URL, Kobo token list with create/delete, OPDS key with regenerate.
**users:** Renders page content (placeholder).

- [ ] **Step 2: Write reader page test**

Mock reader components, server functions, reading progress hook. Test:
- Renders EbookReader for EPUB files, PdfReader for PDF files
- Toolbar visibility toggle
- Settings panel and TOC drawer open/close
- Progress bar displays

- [ ] **Step 3: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/routes/_authed/settings/ "src/routes/_authed/read*"
git add apps/web/src/routes/_authed/settings/*.browser.test.tsx "apps/web/src/routes/_authed/read.\$bookId.\$fileId.browser.test.tsx"
git commit -m "test: add browser tests for settings pages and reader page"
```

---

## Phase 9: Hook Tests

### Task 28: Custom hook tests

**Files:**
- Create: `apps/web/src/hooks/use-mobile.browser.test.tsx`
- Create: `apps/web/src/hooks/use-reader-settings.browser.test.tsx`
- Create: `apps/web/src/hooks/use-reading-progress.browser.test.tsx`

- [ ] **Step 1: Write use-mobile.browser.test.tsx**

```tsx
import { render } from "vitest-browser-react";
import { describe, expect, test } from "vitest";
import { useIsMobile } from "./use-mobile";

function TestComponent() {
	const isMobile = useIsMobile();
	return <div data-testid="result">{isMobile ? "mobile" : "desktop"}</div>;
}

describe("useIsMobile", () => {
	test("returns false for desktop viewport", async () => {
		const screen = await render(<TestComponent />);
		await expect.element(screen.getByTestId("result")).toHaveTextContent("desktop");
	});
});
```

- [ ] **Step 2: Write use-reader-settings.browser.test.tsx**

```tsx
import { render } from "vitest-browser-react";
import { describe, expect, test } from "vitest";
import { useReaderSettings } from "./use-reader-settings";

function TestComponent() {
	const { settings, updateSettings, resetSettings } = useReaderSettings();
	return (
		<div>
			<span data-testid="theme">{settings.theme}</span>
			<span data-testid="fontSize">{settings.fontSize}</span>
			<button onClick={() => updateSettings({ theme: "sepia" })}>Change Theme</button>
			<button onClick={() => resetSettings()}>Reset</button>
		</div>
	);
}

describe("useReaderSettings", () => {
	test("returns default settings", async () => {
		localStorage.removeItem("reader-settings");
		const screen = await render(<TestComponent />);
		await expect.element(screen.getByTestId("theme")).toHaveTextContent("dark");
	});

	test("updates and persists settings", async () => {
		localStorage.removeItem("reader-settings");
		const screen = await render(<TestComponent />);
		await screen.getByRole("button", { name: "Change Theme" }).click();
		await expect.element(screen.getByTestId("theme")).toHaveTextContent("sepia");
		expect(JSON.parse(localStorage.getItem("reader-settings")!).theme).toBe("sepia");
	});

	test("resets to defaults", async () => {
		localStorage.setItem("reader-settings", JSON.stringify({ theme: "sepia" }));
		const screen = await render(<TestComponent />);
		await screen.getByRole("button", { name: "Reset" }).click();
		await expect.element(screen.getByTestId("theme")).toHaveTextContent("dark");
	});
});
```

- [ ] **Step 3: Write use-reading-progress.browser.test.tsx**

Mock `@tanstack/react-query` (useQuery, useMutation, useQueryClient) and server functions. Wrap test component in QueryClientProvider. Test:
- Returns initial progress from query data
- saveProgress calls mutation
- isSaving reflects mutation pending state

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/web && bunx vitest run --project browser src/hooks/
git add apps/web/src/hooks/*.browser.test.tsx
git commit -m "test: add browser tests for custom hooks"
```

---

## Phase 10: Coverage Enforcement

### Task 29: Enable 95% thresholds and fix gaps

**Files:**
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1: Run full coverage report**

```bash
cd apps/web && bunx vitest run --coverage 2>&1
```

Review the complete coverage table. List every file below 95% in any category.

- [ ] **Step 2: Fix coverage gaps**

For each file below 95%, read the source and the existing test file. Add targeted tests for uncovered lines/branches. The coverage report shows exact line numbers.

Common patterns to cover:
- Error handling branches (try/catch, if(!x) throw)
- Edge case parameters (null, undefined, empty arrays)
- Conditional rendering paths in components
- Default parameter values
- Early returns

- [ ] **Step 3: Enable thresholds**

Update `apps/web/vitest.config.ts`:

```typescript
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**"],
			exclude: [
				"src/routeTree.gen.ts",
				"src/**/*.test.ts",
				"src/**/*.browser.test.tsx",
			],
			thresholds: {
				statements: 95,
				branches: 95,
				functions: 95,
				lines: 95,
			},
		},
	},
});
```

- [ ] **Step 4: Run full suite with thresholds**

```bash
cd apps/web && bun run test
```

Expected: All tests pass AND all coverage thresholds met. If thresholds fail, iterate: check report, add tests, re-run.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: enable 95% coverage thresholds across all categories"
```

---

### Task 30: Final cleanup

- [ ] **Step 1: Verify src/__tests__/ is deleted**

```bash
ls apps/web/src/__tests__/ 2>&1
```

Expected: "No such file or directory"

- [ ] **Step 2: Run linting on test files**

```bash
cd apps/web && bun run lint
```

Fix any lint issues.

- [ ] **Step 3: Full test suite final verification**

```bash
cd apps/web && bun run test
```

Expected: All tests pass, both node and browser projects, 95% thresholds met.

- [ ] **Step 4: Commit if needed**

```bash
git add -A
git commit -m "chore: final test coverage cleanup"
```
