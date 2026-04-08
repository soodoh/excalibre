# Codebase Hardening And Cleanup Implementation Plan

## Branch Status

Tasks 1 through 7 in the hardening cleanup pass were implemented on
`feat/codebase-hardening-cleanup` and merged locally.

### Residual Audit Risk

As of 2026-04-07, `bun audit` still reports 3 `h3` advisories. These are
upstream-pinned rather than locally fixable in this codebase because
`@tanstack/start-server-core@1.167.9` depends on the exact alias
`npm:h3@2.0.1-rc.16`, which `@tanstack/react-start@1.167.16` currently
resolves. Bun overrides cannot replace that exact alias from this branch.

All direct dependency advisories that were fixable from this repository were
updated or overridden in the hardening cleanup work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining security, robustness, and dead-code issues identified in the April 7, 2026 audit without broad architectural churn.

**Architecture:** Keep the current TanStack Start + Better Auth + Drizzle design, but tighten server-side trust boundaries. The main changes are: enforce signup rules at the auth layer, stop authenticating by making request-derived internal HTTP calls, constrain filesystem access to declared data roots, make long-running/background flows safe under concurrency, and remove clearly orphaned feature surface.

**Tech Stack:** Bun, TanStack Start, TanStack Router, Better Auth, Drizzle ORM, SQLite, Vitest, Biome, Astro/Starlight

---

## File Map

**Security / auth**
- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/routes/api/auth/$.ts`
- Modify: `apps/web/src/server/opds.ts`
- Modify: `apps/web/src/server/kosync.ts`
- Modify: `apps/web/src/routes/api/kosync/users.create.ts`
- Test: `apps/web/src/__tests__/auth-hardening.test.ts`
- Test: `apps/web/src/__tests__/opds-auth.test.ts`
- Test: `apps/web/src/__tests__/kosync-auth.test.ts`

**Filesystem / scanning**
- Modify: `apps/web/src/lib/validators.ts`
- Modify: `apps/web/src/server/libraries.ts`
- Modify: `apps/web/src/server/scanner.ts`
- Create: `apps/web/src/server/path-safety.ts`
- Test: `apps/web/src/__tests__/path-safety.test.ts`
- Test: `apps/web/src/__tests__/scanner.test.ts`

**Asset serving**
- Modify: `apps/web/src/routes/api/books/$fileId.ts`
- Modify: `apps/web/src/routes/api/covers/$bookId.ts`
- Reuse tests: `apps/web/src/__tests__/access-route-errors.test.ts`
- Create: `apps/web/src/__tests__/asset-streaming.test.ts`

**Background jobs**
- Modify: `apps/web/src/server/middleware.ts`
- Modify: `apps/web/src/server/scheduler.ts`
- Modify: `apps/web/src/server/job-worker.ts`
- Create: `apps/web/src/server/runtime-bootstrap.ts`
- Test: `apps/web/src/__tests__/job-worker.test.ts`

**Secrets / cleanup / deps**
- Modify: `apps/web/src/db/schema/sync.ts`
- Modify: `apps/web/src/server/sync-settings.ts`
- Modify: `apps/web/package.json`
- Delete: `apps/web/src/components/reader/annotation-popover.tsx`
- Delete: `apps/web/src/components/ui/scroll-area.tsx`
- Delete: `apps/web/src/components/ui/tabs.tsx`
- Delete: `apps/web/src/components/ui/textarea.tsx`
- Modify: `apps/web/src/server/reading.ts`
- Modify: `apps/docs/astro.config.mjs`
- Test: `apps/web/src/__tests__/sync-settings.test.ts`

### Task 1: Lock Down Signup On The Server

**Files:**
- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/routes/api/auth/$.ts`
- Test: `apps/web/src/__tests__/auth-hardening.test.ts`

- [ ] **Step 1: Write the failing tests for server-enforced signup rules**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const authHandler = vi.fn();
const getUserCount = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				get: getUserCount,
			}),
		}),
	},
}));

vi.mock("src/lib/auth", () => ({
	auth: { handler: authHandler },
}));

describe("auth route hardening", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		authHandler.mockResolvedValue(new Response("ok"));
	});

	test("blocks sign-up when a user already exists", async () => {
		getUserCount.mockReturnValue({ count: 1 });
		const { handleAuthPostRequest } = await import("src/routes/api/auth/$");

		const response = await handleAuthPostRequest({
			request: new Request("https://example.com/api/auth/sign-up/email", {
				method: "POST",
			}),
		});

		expect(response.status).toBe(403);
		expect(authHandler).not.toHaveBeenCalled();
	});

	test("allows bootstrap sign-up when no users exist", async () => {
		getUserCount.mockReturnValue({ count: 0 });
		const { handleAuthPostRequest } = await import("src/routes/api/auth/$");

		await handleAuthPostRequest({
			request: new Request("https://example.com/api/auth/sign-up/email", {
				method: "POST",
			}),
		});

		expect(authHandler).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run the auth hardening test to verify it fails**

Run: `cd apps/web && bun run test -- src/__tests__/auth-hardening.test.ts`

Expected: FAIL because the auth route currently forwards all sign-up requests to Better Auth.

- [ ] **Step 3: Implement a route-level signup guard**

```ts
function isSignupRequest(request: Request): boolean {
	const url = new URL(request.url);
	return url.pathname === "/api/auth/sign-up/email";
}

async function hasAnyUsers(): Promise<boolean> {
	const result = db.select({ count: sql<number>`count(*)` }).from(user).get();
	return (result?.count ?? 0) > 0;
}

export async function enforceSignupPolicy(request: Request): Promise<Response | null> {
	if (!isSignupRequest(request)) {
		return null;
	}

	if (await hasAnyUsers()) {
		return Response.json(
			{ message: "Registration is disabled after initial setup." },
			{ status: 403 },
		);
	}

	return null;
}
```

- [ ] **Step 4: Call the guard before delegating to Better Auth**

```ts
POST: async ({ request }: { request: Request }) => {
	const blocked = await enforceSignupPolicy(request);
	if (blocked) {
		return blocked;
	}

	return auth.handler(request);
},
```

- [ ] **Step 5: Run focused tests and the full suite**

Run: `cd apps/web && bun run test -- src/__tests__/auth-hardening.test.ts`

Expected: PASS

Run: `bun run test`

Expected: PASS with no auth-route regressions

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/routes/api/auth/\$.ts apps/web/src/__tests__/auth-hardening.test.ts
git commit -m "fix: enforce signup policy on the server"
```

### Task 2: Replace Request-Derived Internal Auth Fetches

**Files:**
- Modify: `apps/web/src/server/opds.ts`
- Modify: `apps/web/src/server/kosync.ts`
- Modify: `apps/web/src/routes/api/kosync/users.create.ts`
- Test: `apps/web/src/__tests__/opds-auth.test.ts`
- Test: `apps/web/src/__tests__/kosync-auth.test.ts`

- [ ] **Step 1: Write failing tests for credential verification without internal fetch**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchMock = vi.fn();
const signInEmail = vi.fn();

vi.stubGlobal("fetch", fetchMock);

vi.mock("src/lib/auth", () => ({
	auth: {
		api: {
			signInEmail,
		},
	},
}));

describe("authenticateOpds", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("does not call fetch for Basic auth verification", async () => {
		signInEmail.mockResolvedValue({ user: { id: "user-1" } });
		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${Buffer.from("user@example.com:pw").toString("base64")}`,
			},
		});

		await authenticateOpds(request);

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the focused auth tests to verify they fail**

Run: `cd apps/web && bun run test -- src/__tests__/opds-auth.test.ts src/__tests__/kosync-auth.test.ts`

Expected: FAIL because `authenticateOpds` and `authenticateKosync` still call `fetch()`.

- [ ] **Step 3: Introduce a shared server-side credential verifier**

```ts
async function verifyEmailPassword(
	email: string,
	password: string,
): Promise<{ id: string; role: "admin" | "user" } | null> {
	const result = await auth.api.signInEmail({
		body: { email, password },
		asResponse: false,
	});

	if (!result?.user?.id) {
		return null;
	}

	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, result.user.id),
		columns: { id: true, role: true },
	});

	return userRecord
		? { id: userRecord.id, role: userRecord.role }
		: null;
}
```

- [ ] **Step 4: Update OPDS and KOSync to use the shared verifier**

```ts
const verified = await verifyEmailPassword(email, password);
if (!verified) {
	return null;
}

return {
	mode: "opds",
	userId: verified.id,
};
```

```ts
const verified = await verifyEmailPassword(email, password);
if (!verified) {
	return null;
}

return {
	id: verified.id,
	email,
	role: verified.role,
} as typeof user.$inferSelect;
```

- [ ] **Step 5: Remove account enumeration from the KOSync create endpoint**

```ts
return Response.json(
	{
		message: "Account creation is only available in the Excalibre web UI.",
	},
	{ status: 403 },
);
```

- [ ] **Step 6: Run focused tests and the full suite**

Run: `cd apps/web && bun run test -- src/__tests__/opds-auth.test.ts src/__tests__/kosync-auth.test.ts`

Expected: PASS

Run: `bun run test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/server/opds.ts apps/web/src/server/kosync.ts apps/web/src/routes/api/kosync/users.create.ts apps/web/src/__tests__/opds-auth.test.ts apps/web/src/__tests__/kosync-auth.test.ts
git commit -m "fix: verify sync credentials without internal http fetches"
```

### Task 3: Constrain Library Scan Paths To The Data Root

**Files:**
- Create: `apps/web/src/server/path-safety.ts`
- Modify: `apps/web/src/lib/validators.ts`
- Modify: `apps/web/src/server/libraries.ts`
- Modify: `apps/web/src/server/scanner.ts`
- Test: `apps/web/src/__tests__/path-safety.test.ts`

- [ ] **Step 1: Write failing path-safety tests**

```ts
import { describe, expect, test } from "vitest";
import { resolveLibraryScanPath } from "src/server/path-safety";

describe("resolveLibraryScanPath", () => {
	test("rejects absolute scan paths", () => {
		expect(() => resolveLibraryScanPath("data", "/etc")).toThrow(/absolute/i);
	});

	test("rejects parent traversal", () => {
		expect(() => resolveLibraryScanPath("data", "../private")).toThrow(/escape/i);
	});

	test("allows normalized relative paths", () => {
		expect(resolveLibraryScanPath("data", "books/fiction")).toBe("data/books/fiction");
	});
});
```

- [ ] **Step 2: Run the path-safety test to verify it fails**

Run: `cd apps/web && bun run test -- src/__tests__/path-safety.test.ts`

Expected: FAIL because no shared path-safety helper exists.

- [ ] **Step 3: Add a shared path containment helper**

```ts
import path from "node:path";

export function resolveLibraryScanPath(dataDir: string, scanPath: string): string {
	if (path.isAbsolute(scanPath)) {
		throw new Error("Absolute scan paths are not allowed");
	}

	const normalized = path.normalize(scanPath);
	if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
		throw new Error("Scan path cannot escape the data directory");
	}

	return path.join(dataDir, normalized);
}
```

- [ ] **Step 4: Reject invalid scan paths at validation and persistence boundaries**

```ts
scanPaths: z
	.array(
		z
			.string()
			.min(1)
			.refine((value) => !path.isAbsolute(value), "Use paths relative to DATA_DIR")
			.refine((value) => {
				const normalized = path.normalize(value);
				return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
			}, "Scan paths cannot escape DATA_DIR"),
	)
	.min(1, "At least one scan path is required"),
```

- [ ] **Step 5: Make the scanner use the shared helper**

```ts
for (const scanPath of library.scanPaths) {
	const fullScanPath = resolveLibraryScanPath(DATA_DIR, scanPath);
	const files = walkDir(fullScanPath);
	// unchanged loop body
}
```

- [ ] **Step 6: Run focused tests and the full suite**

Run: `cd apps/web && bun run test -- src/__tests__/path-safety.test.ts`

Expected: PASS

Run: `bun run test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/server/path-safety.ts apps/web/src/lib/validators.ts apps/web/src/server/libraries.ts apps/web/src/server/scanner.ts apps/web/src/__tests__/path-safety.test.ts
git commit -m "fix: constrain library scan paths to the data root"
```

### Task 4: Reconcile Metadata Correctly During Rescans

**Files:**
- Modify: `apps/web/src/server/scanner.ts`
- Test: `apps/web/src/__tests__/scanner.test.ts`

- [ ] **Step 1: Write a failing rescan reconciliation test**

```ts
test("rescan updates series, authors, tags, and slug when metadata changes", async () => {
	const existingFile = { id: 1, bookId: 10, fileHash: "old" };

	extractMetadataMock.mockResolvedValue({
		metadata: {
			title: "New Title",
			authors: ["New Author"],
			tags: ["Sci-Fi"],
			series: "Saga",
			seriesIndex: 2,
		},
		cover: null,
	});

	await processUpdatedFileForTest("/library/book.epub", existingFile);

	expect(updateBookMock).toHaveBeenCalledWith(
		expect.objectContaining({
			title: "New Title",
			slug: "new-title",
			seriesIndex: 2,
		}),
	);
	expect(replaceAuthorsMock).toHaveBeenCalled();
	expect(replaceTagsMock).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the scanner test to verify it fails**

Run: `cd apps/web && bun run test -- src/__tests__/scanner.test.ts`

Expected: FAIL because updated scans do not refresh slug, series, author links, or tags.

- [ ] **Step 3: Extract reconciliation helpers for authors, tags, and series**

```ts
async function replaceBookAuthors(bookId: number, names: string[]): Promise<void> {
	await db.delete(booksAuthors).where(eq(booksAuthors.bookId, bookId));

	for (const name of names.length > 0 ? names : ["Unknown"]) {
		const authorId = await getOrCreateAuthor(name);
		await db.insert(booksAuthors).values({ bookId, authorId, role: "author" });
	}
}

async function replaceBookTags(bookId: number, names: string[]): Promise<void> {
	await db.delete(booksTags).where(eq(booksTags.bookId, bookId));

	for (const name of names) {
		const tagId = await getOrCreateTag(name);
		await db.insert(booksTags).values({ bookId, tagId });
	}
}
```

- [ ] **Step 4: Update `processUpdatedFile()` to fully reconcile the book record**

```ts
let seriesId: number | null = null;
if (metadata.series) {
	seriesId = await getOrCreateSeries(metadata.series, book.libraryId);
}

await db.update(books).set({
	title: metadata.title,
	sortTitle: buildSortTitle(metadata.title),
	slug: buildSlug(metadata.title),
	description: metadata.description ?? null,
	language: metadata.language ?? null,
	publisher: metadata.publisher ?? null,
	publishDate: metadata.publishDate ?? null,
	pageCount: metadata.pageCount ?? null,
	seriesId,
	seriesIndex: metadata.seriesIndex ?? null,
	updatedAt: new Date(),
}).where(eq(books.id, bookId));

await replaceBookAuthors(bookId, metadata.authors);
await replaceBookTags(bookId, metadata.tags ?? []);
```

- [ ] **Step 5: Run focused tests and the full suite**

Run: `cd apps/web && bun run test -- src/__tests__/scanner.test.ts`

Expected: PASS

Run: `bun run test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/scanner.ts apps/web/src/__tests__/scanner.test.ts
git commit -m "fix: reconcile metadata correctly during rescans"
```

### Task 5: Stream Hashing And Asset Responses

**Files:**
- Modify: `apps/web/src/server/scanner.ts`
- Modify: `apps/web/src/routes/api/books/$fileId.ts`
- Modify: `apps/web/src/routes/api/covers/$bookId.ts`
- Create: `apps/web/src/__tests__/asset-streaming.test.ts`

- [ ] **Step 1: Write failing tests for stream-based file serving**

```ts
import { describe, expect, test, vi } from "vitest";

const createReadStream = vi.fn();

vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => true),
	createReadStream,
}));

describe("book asset routes", () => {
	test("serves book files via stream", async () => {
		const { handleBookAssetRequest } = await import("src/routes/api/books/$fileId");
		await handleBookAssetRequest({
			request: new Request("https://example.com/api/books/1"),
			params: { fileId: "1" },
		});
		expect(createReadStream).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the asset test to verify it fails**

Run: `cd apps/web && bun run test -- src/__tests__/asset-streaming.test.ts`

Expected: FAIL because the routes still call `readFileSync()`.

- [ ] **Step 3: Replace whole-file hashing with streamed hashing**

```ts
async function computeMd5(filePath: string): Promise<string> {
	return await new Promise((resolve, reject) => {
		const hash = createHash("md5");
		const stream = fs.createReadStream(filePath);

		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
		stream.on("error", reject);
	});
}
```

- [ ] **Step 4: Return streamed `Response` bodies for book and cover assets**

```ts
const stream = createReadStream(file.filePath);
return new Response(stream as unknown as ReadableStream, {
	status: 200,
	headers: {
		"Content-Type": contentType,
		"Cache-Control": "private, max-age=3600",
	},
});
```

- [ ] **Step 5: Run focused tests, then the full suite and build**

Run: `cd apps/web && bun run test -- src/__tests__/asset-streaming.test.ts src/__tests__/access-route-errors.test.ts`

Expected: PASS

Run: `bun run test && bun run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/scanner.ts apps/web/src/routes/api/books/\$fileId.ts apps/web/src/routes/api/covers/\$bookId.ts apps/web/src/__tests__/asset-streaming.test.ts
git commit -m "refactor: stream hashing and asset responses"
```

### Task 6: Make Scheduler Startup And Job Claiming Safe

**Files:**
- Create: `apps/web/src/server/runtime-bootstrap.ts`
- Modify: `apps/web/src/server/middleware.ts`
- Modify: `apps/web/src/server/scheduler.ts`
- Modify: `apps/web/src/server/job-worker.ts`
- Test: `apps/web/src/__tests__/job-worker.test.ts`

- [ ] **Step 1: Write failing tests for single-claim job execution**

```ts
test("claimNextJob returns null when another worker already claimed the row", async () => {
	updateRunMock.mockReturnValue({ changes: 0 });

	const result = await claimNextJob();

	expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the worker test to verify it fails**

Run: `cd apps/web && bun run test -- src/__tests__/job-worker.test.ts`

Expected: FAIL because job selection and job update are separate non-atomic operations.

- [ ] **Step 3: Extract runtime bootstrap and remove scheduler startup from `requireAuth()`**

```ts
let started = false;

export function ensureRuntimeStarted(): void {
	if (started) {
		return;
	}

	started = true;
	ensureSchedulerStarted();
}
```

```ts
export async function requireAuth(): Promise<AuthSession> {
	const session = await getAuthSessionFn();
	if (!session) {
		throw new UnauthorizedError();
	}
	return session;
}
```

- [ ] **Step 4: Claim jobs with a compare-and-swap style update**

```ts
function claimNextJob(): typeof jobs.$inferSelect | null {
	const job = db
		.select()
		.from(jobs)
		.where(and(eq(jobs.status, "pending"), lt(jobs.attempts, jobs.maxAttempts)))
		.orderBy(asc(jobs.priority), asc(jobs.createdAt))
		.limit(1)
		.get();

	if (!job) {
		return null;
	}

	const result = db
		.update(jobs)
		.set({
			status: "running",
			attempts: job.attempts + 1,
			startedAt: new Date(),
		})
		.where(and(eq(jobs.id, job.id), eq(jobs.status, "pending")))
		.run();

	return result.changes === 1 ? job : null;
}
```

- [ ] **Step 5: Run focused tests, then the full suite**

Run: `cd apps/web && bun run test -- src/__tests__/job-worker.test.ts`

Expected: PASS

Run: `bun run test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/runtime-bootstrap.ts apps/web/src/server/middleware.ts apps/web/src/server/scheduler.ts apps/web/src/server/job-worker.ts apps/web/src/__tests__/job-worker.test.ts
git commit -m "fix: harden background scheduler and job claiming"
```

### Task 7: Harden Secrets, Remove Dead Code, And Clean Up Tooling

**Files:**
- Modify: `apps/web/src/db/schema/sync.ts`
- Modify: `apps/web/src/server/sync-settings.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/docs/astro.config.mjs`
- Modify: `apps/web/src/server/reading.ts`
- Delete: `apps/web/src/components/reader/annotation-popover.tsx`
- Delete: `apps/web/src/components/ui/scroll-area.tsx`
- Delete: `apps/web/src/components/ui/tabs.tsx`
- Delete: `apps/web/src/components/ui/textarea.tsx`
- Test: `apps/web/src/__tests__/sync-settings.test.ts`

- [ ] **Step 1: Write failing tests for secret redaction and rotation behavior**

```ts
test("getOpdsKeyFn returns a masked key after initial creation", async () => {
	const result = await getOpdsKeyFn();
	expect(result.apiKey).toMatch(/^.{4}\*+/);
	expect(result.rawApiKey).toBeUndefined();
});

test("regenerateOpdsKeyFn returns the new raw key once", async () => {
	const result = await regenerateOpdsKeyFn();
	expect(result.rawApiKey).toHaveLength(32);
});
```

- [ ] **Step 2: Run the sync-settings test to verify it fails**

Run: `cd apps/web && bun run test -- src/__tests__/sync-settings.test.ts`

Expected: FAIL because keys are currently stored and returned in plaintext.

- [ ] **Step 3: Store hashed secrets and return raw values only at creation time**

```ts
function hashSecret(secret: string): string {
	return createHash("sha256").update(secret).digest("hex");
}

function maskSecret(secret: string): string {
	return `${secret.slice(0, 4)}${"*".repeat(Math.max(0, secret.length - 4))}`;
}
```

```ts
const rawApiKey = randomBytes(16).toString("hex");
const apiKeyHash = hashSecret(rawApiKey);

await db.insert(opdsKeys).values({
	userId: session.user.id,
	apiKeyHash,
});

return {
	id: created.id,
	apiKey: maskSecret(rawApiKey),
	rawApiKey,
	createdAt: created.createdAt,
};
```

- [ ] **Step 4: Remove orphaned annotation code and unused UI primitives**

```ts
// Delete unused annotation server exports and keep reading.ts focused on progress only.
export const getReadingProgressFn = ...
export const saveReadingProgressFn = ...
```

- [ ] **Step 5: Remove unused deps and fix docs build warnings**

```json
{
	"dependencies": {
		// remove "cmdk"
	},
	"devDependencies": {
		// remove "@tanstack/react-query-devtools"
	}
}
```

```js
export default defineConfig({
	site: "https://docs.example.invalid",
	integrations: [starlight({ /* unchanged */ })],
});
```

- [ ] **Step 6: Update dependencies to clear audited advisories**

Run: `bun update`

Expected: lockfile updates for `vite`, `h3`, `srvx`, `defu`, and transitive packages to patched compatible versions

- [ ] **Step 7: Run verification**

Run: `bun install && bun run lint && bun run test && bun run build`

Expected: PASS, with the docs build warning reduced to only any intentionally deferred hostname/site choice

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/db/schema/sync.ts apps/web/src/server/sync-settings.ts apps/web/package.json bun.lock apps/docs/astro.config.mjs apps/web/src/server/reading.ts
git rm apps/web/src/components/reader/annotation-popover.tsx apps/web/src/components/ui/scroll-area.tsx apps/web/src/components/ui/tabs.tsx apps/web/src/components/ui/textarea.tsx
git commit -m "chore: harden secrets and remove dead code"
```

## Self-Review

**Spec coverage**
- Covers server-side signup enforcement.
- Covers OPDS/KOSync request-derived internal auth fetch removal.
- Covers scan path containment and scanner metadata reconciliation.
- Covers memory-heavy hashing/asset serving.
- Covers scheduler/job-worker robustness.
- Covers secret storage/rotation hardening, dead-code cleanup, dependency updates, and docs build warnings.

**Known deliberate deferrals**
- If external clients require plaintext key display after initial creation, add a separate explicit “reveal/regenerate” UX instead of reintroducing plaintext-at-rest.
- If Better Auth lacks a stable `signInEmail` server API in this exact version, adapt Task 2 to the nearest official server-side credential verification hook without using request-derived internal fetches.

**Placeholder scan**
- No `TODO`, `TBD`, or “implement later” placeholders remain.

**Type consistency**
- Plan uses `apiKeyHash`/`tokenHash` naming for hashed secret storage.
- Plan uses `resolveLibraryScanPath()` as the shared path helper across validation and scanning.
- Plan uses `claimNextJob()` as the single atomic claim path for background jobs.
