# Access-Control Protocol Regression Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore OPDS auth propagation, file-route access error translation, and Kobo empty-sync token behavior without changing the underlying access-control rules.

**Architecture:** Keep the fix in the current OPDS and Kobo route layer. Export thin named handler functions from the affected route files so Vitest can call them directly with mocked dependencies, add a tiny `HttpError`→`Response` helper for repeated route-boundary handling, and update OPDS feed generation so every followable link preserves request auth.

**Tech Stack:** Bun, Vitest, TanStack file routes, Drizzle ORM, TypeScript

---

## File Map

- Modify: `apps/web/src/server/opds.ts`
  - Keep OPDS XML helpers responsible for auth-aware feed metadata and navigation links.
- Modify: `apps/web/src/server/http-errors.ts`
  - Add one narrow helper for translating `HttpError` instances into `Response` objects.
- Modify: `apps/web/src/routes/api/opds/all.ts`
  - Export a named handler for tests and make pagination links auth-aware.
- Modify: `apps/web/src/routes/api/opds/libraries.$libraryId.ts`
  - Preserve auth on paginated library feed links.
- Modify: `apps/web/src/routes/api/opds/recent.ts`
  - Export a named handler for tests and preserve auth in the zero-library branch.
- Modify: `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.download.ts`
  - Export a named handler and convert `HttpError` failures into HTTP responses.
- Modify: `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.state.ts`
  - Export named GET/PUT handlers and convert `HttpError` failures into HTTP responses.
- Modify: `apps/web/src/routes/api/opds/pse.$bookId.$pageNumber.ts`
  - Export a named handler and convert `HttpError` failures into HTTP responses.
- Modify: `apps/web/src/routes/api/kobo/$token/v1/library.sync.ts`
  - Export a named handler and keep sync token generation active for zero-access users.
- Modify: `apps/web/src/__tests__/request-auth.test.ts`
  - Keep URL helper coverage focused on auth suffix behavior.
- Create: `apps/web/src/__tests__/opds-routes.test.ts`
  - Regression tests for auth-preserving OPDS `self` and pagination links.
- Create: `apps/web/src/__tests__/access-route-errors.test.ts`
  - Regression tests for non-500 access failures in Kobo and OPDS asset routes.
- Create: `apps/web/src/__tests__/kobo-sync.test.ts`
  - Regression test for zero-library sync still emitting `x-kobo-synctoken`.

### Task 1: Add failing OPDS auth-propagation tests

**Files:**
- Modify: `apps/web/src/__tests__/request-auth.test.ts`
- Create: `apps/web/src/__tests__/opds-routes.test.ts`
- Test: `apps/web/src/__tests__/opds-routes.test.ts`

- [ ] **Step 1: Add focused failing tests for OPDS followable links**

```ts
// apps/web/src/__tests__/opds-routes.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateOpds = vi.fn();
const getAccessibleLibraryIds = vi.fn();
const dbSelect = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
	},
}));

vi.mock("src/server/opds", async () => {
	const actual =
		await vi.importActual<typeof import("src/server/opds")>("src/server/opds");
	return {
		...actual,
		authenticateOpds,
		getAccessibleLibraryIds,
	};
});

describe("OPDS route auth propagation", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("recent feed preserves apikey on the self link when no libraries are accessible", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		getAccessibleLibraryIds.mockResolvedValue([]);

		const { handleRecentOpdsRequest } = await import("src/routes/api/opds/recent");
		const response = await handleRecentOpdsRequest(
			new Request("https://example.com/api/opds/recent?apikey=feed-key"),
		);

		expect(response.status).toBe(200);
		const xml = await response.text();
		expect(xml).toContain(
			'href="https://example.com/api/opds/recent?apikey=feed-key"',
		);
	});

	test("all feed preserves apikey on previous and next pagination links", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		getAccessibleLibraryIds.mockResolvedValue([7]);
		dbSelect
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: () => ({
								offset: () => Promise.resolve([]),
							}),
						}),
					}),
				}),
			})
			.mockReturnValueOnce({
				from: () => ({
					where: () => Promise.resolve([{ value: 151 }]),
				}),
			});

		const { handleAllOpdsRequest } = await import("src/routes/api/opds/all");
		const response = await handleAllOpdsRequest(
			new Request("https://example.com/api/opds/all?page=1&apikey=feed-key"),
		);

		expect(response.status).toBe(200);
		const xml = await response.text();
		expect(xml).toContain(
			'rel="previous" href="https://example.com/api/opds/all?page=0&amp;apikey=feed-key"',
		);
		expect(xml).toContain(
			'rel="next" href="https://example.com/api/opds/all?page=2&amp;apikey=feed-key"',
		);
	});
});
```

- [ ] **Step 2: Verify the tests fail before implementation**

Run: `cd apps/web && bun run test -- src/__tests__/opds-routes.test.ts`

Expected: FAIL because the named handler exports do not exist yet or the emitted XML still contains raw `self` or pagination links without `apikey`.

- [ ] **Step 3: Add a companion request-auth helper test**

```ts
// apps/web/src/__tests__/request-auth.test.ts
test("appends auth to OPDS self links that already contain a page query", () => {
	expect(
		appendRequestAuthToUrl("https://example.com/api/opds/libraries/9?page=3", {
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		}),
	).toBe("https://example.com/api/opds/libraries/9?page=3&apikey=feed-key");
});
```

- [ ] **Step 4: Re-run the helper test to confirm the baseline still passes**

Run: `cd apps/web && bun run test -- src/__tests__/request-auth.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the red tests**

```bash
git add apps/web/src/__tests__/request-auth.test.ts apps/web/src/__tests__/opds-routes.test.ts
git commit -m "test: cover opds auth propagation regressions"
```

### Task 2: Implement OPDS auth-preserving feed links

**Files:**
- Modify: `apps/web/src/server/opds.ts`
- Modify: `apps/web/src/routes/api/opds/all.ts`
- Modify: `apps/web/src/routes/api/opds/libraries.$libraryId.ts`
- Modify: `apps/web/src/routes/api/opds/recent.ts`
- Test: `apps/web/src/__tests__/opds-routes.test.ts`

- [ ] **Step 1: Make OPDS `self` links auth-aware in the shared helper**

```ts
// apps/web/src/server/opds.ts
export function opdsHeader(
	id: string,
	title: string,
	selfHref: string,
	baseUrl: string,
	requestAuth?: RequestAuth,
	updated?: Date,
): string {
	const updatedStr = (updated ?? new Date()).toISOString();
	const authorizedSelfHref = requestAuth
		? appendRequestAuthToUrl(selfHref, requestAuth)
		: selfHref;
	const startHref = appendRequestAuthToUrl(
		`${baseUrl}/api/opds`,
		requestAuth ?? { mode: "session", userId: "" },
	);
	const searchHref = appendRequestAuthToUrl(
		`${baseUrl}/api/opds/search/xml`,
		requestAuth ?? { mode: "session", userId: "" },
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pse="http://vaemendis.net/opds-pse/ns">
  <id>${escapeXml(id)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${updatedStr}</updated>
  <author>
    <name>Excalibre</name>
  </author>
  <link rel="self" href="${escapeXml(authorizedSelfHref)}" type="application/atom+xml; profile=opds-catalog; kind=navigation"/>
  <link rel="start" href="${escapeXml(startHref)}" type="application/atom+xml; profile=opds-catalog; kind=navigation"/>
  <link rel="search" href="${escapeXml(searchHref)}" type="application/opensearchdescription+xml"/>
`;
}
```

- [ ] **Step 2: Export a testable named handler and fix pagination links in the all-books feed**

```ts
// apps/web/src/routes/api/opds/all.ts
import { appendRequestAuthToUrl } from "src/server/request-auth";

export async function handleAllOpdsRequest(request: Request): Promise<Response> {
	const auth = await authenticateOpds(request);
	if (!auth) {
		return new Response("Unauthorized", {
			status: 401,
			headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
		});
	}

	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;
	const page = Math.max(0, Number(url.searchParams.get("page") ?? "0"));
	const offset = page * PAGE_SIZE;
	const libraryIds = await getAccessibleLibraryIds(auth.userId);

	if (libraryIds.length === 0) {
		const xml =
			opdsHeader(
				"urn:excalibre:opds:all",
				"All Books",
				`${baseUrl}/api/opds/all`,
				baseUrl,
				auth,
			) + opdsFooter();
		return opdsXmlResponse(xml);
	}
	const [bookRows, totalRows] = await Promise.all([
		db
			.select()
			.from(books)
			.where(inArray(books.libraryId, libraryIds))
			.orderBy(desc(books.createdAt))
			.limit(PAGE_SIZE)
			.offset(offset),
		db
			.select({ value: count() })
			.from(books)
			.where(inArray(books.libraryId, libraryIds)),
	]);

	const total = totalRows[0]?.value ?? 0;
	const hasMore = offset + bookRows.length < total;
	const bookIds = bookRows.map((b) => b.id);
	const [allFiles, allAuthorRows] =
		bookIds.length > 0
			? await Promise.all([
					db.select().from(bookFiles).where(inArray(bookFiles.bookId, bookIds)),
					db
						.select({
							bookId: booksAuthors.bookId,
							id: authors.id,
							name: authors.name,
							role: booksAuthors.role,
						})
						.from(booksAuthors)
						.innerJoin(authors, eq(booksAuthors.authorId, authors.id))
						.where(inArray(booksAuthors.bookId, bookIds)),
				])
			: [[], []];

	let xml = opdsHeader(
		"urn:excalibre:opds:all",
		"All Books",
		`${baseUrl}/api/opds/all?page=${page}`,
		baseUrl,
		auth,
	);

	if (page > 0) {
		const previousHref = appendRequestAuthToUrl(
			`${baseUrl}/api/opds/all?page=${page - 1}`,
			auth,
		);
		xml += `  <link rel="previous" href="${escapeXml(previousHref)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
	}
	if (hasMore) {
		const nextHref = appendRequestAuthToUrl(
			`${baseUrl}/api/opds/all?page=${page + 1}`,
			auth,
		);
		xml += `  <link rel="next" href="${escapeXml(nextHref)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
	}

	for (const book of bookRows) {
		const files = allFiles.filter((f) => f.bookId === book.id);
		const bookAuthors = allAuthorRows.filter((a) => a.bookId === book.id);
		xml += opdsBookEntry(book, files, bookAuthors, baseUrl, auth);
	}

	xml += opdsFooter();
	return opdsXmlResponse(xml);
}

export const Route = createFileRoute("/api/opds/all")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) =>
				handleAllOpdsRequest(request),
		},
	},
});
```

- [ ] **Step 3: Apply the same auth-preserving behavior to adjacent OPDS feeds**

```ts
// apps/web/src/routes/api/opds/libraries.$libraryId.ts
import { appendRequestAuthToUrl } from "src/server/request-auth";

if (page > 0) {
	const previousHref = appendRequestAuthToUrl(
		`${baseUrl}/api/opds/libraries/${libraryId}?page=${page - 1}`,
		auth,
	);
	xml += `  <link rel="previous" href="${escapeXml(previousHref)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
}
if (hasMore) {
	const nextHref = appendRequestAuthToUrl(
		`${baseUrl}/api/opds/libraries/${libraryId}?page=${page + 1}`,
		auth,
	);
	xml += `  <link rel="next" href="${escapeXml(nextHref)}" type="application/atom+xml; profile=opds-catalog; kind=acquisition"/>\n`;
}

// apps/web/src/routes/api/opds/recent.ts
export async function handleRecentOpdsRequest(request: Request): Promise<Response> {
	const auth = await authenticateOpds(request);
	if (!auth) {
		return new Response("Unauthorized", {
			status: 401,
			headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
		});
	}
	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;
	const libraryIds = await getAccessibleLibraryIds(auth.userId);
	if (libraryIds.length === 0) {
		const xml =
			opdsHeader(
				"urn:excalibre:opds:recent",
				"Recently Added",
				`${baseUrl}/api/opds/recent`,
				baseUrl,
				auth,
			) + opdsFooter();
		return opdsXmlResponse(xml);
	}

	const bookRows = await db
		.select()
		.from(books)
		.where(inArray(books.libraryId, libraryIds))
		.orderBy(desc(books.createdAt))
		.limit(RECENT_LIMIT);

	const bookIds = bookRows.map((b) => b.id);
	const [allFiles, allAuthorRows] =
		bookIds.length > 0
			? await Promise.all([
					db.select().from(bookFiles).where(inArray(bookFiles.bookId, bookIds)),
					db
						.select({
							bookId: booksAuthors.bookId,
							id: authors.id,
							name: authors.name,
							role: booksAuthors.role,
						})
						.from(booksAuthors)
						.innerJoin(authors, eq(booksAuthors.authorId, authors.id))
						.where(inArray(booksAuthors.bookId, bookIds)),
				])
			: [[], []];

	let xml = opdsHeader(
		"urn:excalibre:opds:recent",
		"Recently Added",
		`${baseUrl}/api/opds/recent`,
		baseUrl,
		auth,
	);

	for (const book of bookRows) {
		const files = allFiles.filter((f) => f.bookId === book.id);
		const bookAuthors = allAuthorRows.filter((a) => a.bookId === book.id);
		xml += opdsBookEntry(book, files, bookAuthors, baseUrl, auth);
	}

	xml += opdsFooter();
	return opdsXmlResponse(xml);
}
```

- [ ] **Step 4: Run the OPDS regression tests**

Run: `cd apps/web && bun run test -- src/__tests__/request-auth.test.ts src/__tests__/opds-routes.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the OPDS fix**

```bash
git add apps/web/src/server/opds.ts apps/web/src/routes/api/opds/all.ts apps/web/src/routes/api/opds/libraries.\$libraryId.ts apps/web/src/routes/api/opds/recent.ts apps/web/src/__tests__/request-auth.test.ts apps/web/src/__tests__/opds-routes.test.ts
git commit -m "fix: preserve opds auth on followable feed links"
```

### Task 3: Add failing tests for access-control errors in asset routes

**Files:**
- Create: `apps/web/src/__tests__/access-route-errors.test.ts`
- Test: `apps/web/src/__tests__/access-route-errors.test.ts`

- [ ] **Step 1: Add failing tests for Kobo and OPDS asset routes returning 500 on lost access**

```ts
// apps/web/src/__tests__/access-route-errors.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ForbiddenError } from "src/server/http-errors";

const authenticateKobo = vi.fn();
const authenticateOpds = vi.fn();
const assertUserCanAccessBook = vi.fn();

vi.mock("src/db", () => ({ db: {} }));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
}));

vi.mock("src/server/kobo", () => ({
	authenticateKobo,
	buildReadingState: vi.fn(),
}));

vi.mock("src/server/opds", async () => {
	const actual =
		await vi.importActual<typeof import("src/server/opds")>("src/server/opds");
	return {
		...actual,
		authenticateOpds,
	};
});

describe("asset route access failures", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		assertUserCanAccessBook.mockRejectedValue(new ForbiddenError("Forbidden"));
	});

	test("kobo download returns 403 instead of 500", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		const { handleKoboLibraryDownloadRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.$bookId.download"
		);

		const response = await handleKoboLibraryDownloadRequest({
			params: { token: "token-1", bookId: "12" },
		});

		expect(response.status).toBe(403);
	});

	test("kobo state GET returns 403 instead of 500", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		const { handleKoboLibraryStateGetRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.$bookId.state"
		);

		const response = await handleKoboLibraryStateGetRequest({
			params: { token: "token-1", bookId: "12" },
		});

		expect(response.status).toBe(403);
	});

	test("kobo state PUT returns 403 instead of 500", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		const { handleKoboLibraryStatePutRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.$bookId.state"
		);

		const response = await handleKoboLibraryStatePutRequest({
			request: new Request("https://example.com", {
				method: "PUT",
				body: JSON.stringify({ ReadingStates: [] }),
				headers: { "Content-Type": "application/json" },
			}),
			params: { token: "token-1", bookId: "12" },
		});

		expect(response.status).toBe(403);
	});

	test("opds pse returns 403 instead of 500", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		const { handleOpdsPseRequest } = await import(
			"src/routes/api/opds/pse.$bookId.$pageNumber"
		);

		const response = await handleOpdsPseRequest({
			request: new Request(
				"https://example.com/api/opds/pse/12/0?apikey=feed-key",
			),
			params: { bookId: "12", pageNumber: "0" },
		});

		expect(response.status).toBe(403);
	});
});
```

- [ ] **Step 2: Verify the new error-path tests fail**

Run: `cd apps/web && bun run test -- src/__tests__/access-route-errors.test.ts`

Expected: FAIL because the named handler exports do not exist yet and the current route boundaries still leak `HttpError` as `500`.

- [ ] **Step 3: Confirm the helper does not already exist before adding it**

Run: `cd apps/web && rg -n "responseFromHttpError|httpErrorResponse" src/server src/routes`

Expected: no matches

- [ ] **Step 4: Re-run the failing test file to keep the red state visible**

Run: `cd apps/web && bun run test -- src/__tests__/access-route-errors.test.ts`

Expected: still FAIL

- [ ] **Step 5: Commit the red tests**

```bash
git add apps/web/src/__tests__/access-route-errors.test.ts
git commit -m "test: cover asset route access failures"
```

### Task 4: Implement `HttpError` translation in asset routes

**Files:**
- Modify: `apps/web/src/server/http-errors.ts`
- Modify: `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.download.ts`
- Modify: `apps/web/src/routes/api/kobo/$token/v1/library.$bookId.state.ts`
- Modify: `apps/web/src/routes/api/opds/pse.$bookId.$pageNumber.ts`
- Modify: `apps/web/src/routes/api/books/$fileId.ts`
- Modify: `apps/web/src/routes/api/covers/$bookId.ts`
- Test: `apps/web/src/__tests__/access-route-errors.test.ts`

- [ ] **Step 1: Add a narrow shared helper for `HttpError` translation**

```ts
// apps/web/src/server/http-errors.ts
export function responseFromHttpError(error: unknown): Response | null {
	if (error instanceof HttpError) {
		return new Response(error.message, { status: error.status });
	}

	return null;
}
```

- [ ] **Step 2: Wrap the Kobo and OPDS asset handlers with explicit route-boundary error handling**

```ts
// apps/web/src/routes/api/kobo/$token/v1/library.$bookId.download.ts
import {
	responseFromHttpError,
} from "src/server/http-errors";

export async function handleKoboLibraryDownloadRequest({
	params,
}: {
	params: { token: string; bookId: string };
}): Promise<Response> {
	try {
		const auth = await authenticateKobo(params.token);
		if (!auth) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const bookId = Number(params.bookId);
		if (Number.isNaN(bookId)) {
			return Response.json({ error: "Invalid book ID" }, { status: 400 });
		}

		await assertUserCanAccessBook(auth.userId, bookId);

		const files = await db.query.bookFiles.findMany({
			where: eq(bookFiles.bookId, bookId),
		});
		if (files.length === 0) {
			return new Response("Not found", { status: 404 });
		}

		const preferred =
			files.find((f) => f.format.toLowerCase() === "epub") ??
			files.find((f) => f.format.toLowerCase() === "kepub") ??
			files[0];
		if (!preferred) {
			return new Response("Not found", { status: 404 });
		}
		if (!existsSync(preferred.filePath)) {
			return new Response("File not found on disk", { status: 404 });
		}

		const contentType =
			MIME_TYPES[preferred.format.toLowerCase()] ?? "application/octet-stream";
		const data = readFileSync(preferred.filePath);
		return new Response(data, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": `attachment; filename="book-${String(bookId)}.epub"`,
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch (error) {
		return (
			responseFromHttpError(error) ??
			new Response("Internal Server Error", { status: 500 })
		);
	}
}

// apps/web/src/routes/api/kobo/$token/v1/library.$bookId.state.ts
export async function handleKoboLibraryStateGetRequest({
	params,
}: {
	params: { token: string; bookId: string };
}): Promise<Response> {
	try {
		const auth = await authenticateKobo(params.token);
		if (!auth) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const bookId = Number(params.bookId);
		if (Number.isNaN(bookId)) {
			return Response.json({ error: "Invalid book ID" }, { status: 400 });
		}

		await assertUserCanAccessBook(auth.userId, bookId);
		const book = await db.query.books.findFirst({
			where: eq(books.id, bookId),
			columns: { id: true },
		});
		if (!book) {
			return Response.json({ error: "Not found" }, { status: 404 });
		}

		const progress = await db.query.readingProgress.findFirst({
			where: and(
				eq(readingProgress.userId, auth.userId),
				eq(readingProgress.bookId, bookId),
				eq(readingProgress.deviceType, "kobo"),
			),
		});

		return Response.json([buildReadingState(progress, bookId)]);
	} catch (error) {
		return (
			responseFromHttpError(error) ??
			new Response("Internal Server Error", { status: 500 })
		);
	}
}

export async function handleKoboLibraryStatePutRequest({
	request,
	params,
}: {
	request: Request;
	params: { token: string; bookId: string };
}): Promise<Response> {
	try {
		const auth = await authenticateKobo(params.token);
		if (!auth) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const bookId = Number(params.bookId);
		if (Number.isNaN(bookId)) {
			return Response.json({ error: "Invalid book ID" }, { status: 400 });
		}

		await assertUserCanAccessBook(auth.userId, bookId);
		const book = await db.query.books.findFirst({
			where: eq(books.id, bookId),
			columns: { id: true },
		});
		if (!book) {
			return Response.json({ error: "Not found" }, { status: 404 });
		}

		let body: ReadingStateBody;
		try {
			body = (await request.json()) as ReadingStateBody;
		} catch {
			return Response.json({ error: "Invalid request body" }, { status: 400 });
		}

		const readingState = body.ReadingStates?.[0];
		const koboStatus = readingState?.StatusInfo?.Status ?? "ReadyToRead";
		const progressPercent =
			readingState?.CurrentBookmark?.ProgressPercent ?? 0;
		const progressValue =
			koboStatus === "Finished"
				? 1
				: koboStatus === "Reading"
					? progressPercent / 100
					: 0;
		const isFinished = koboStatus === "Finished";
		const now = new Date();
		const existing = await db.query.readingProgress.findFirst({
			where: and(
				eq(readingProgress.userId, auth.userId),
				eq(readingProgress.bookId, bookId),
				eq(readingProgress.deviceType, "kobo"),
			),
		});

		await (existing
			? db
					.update(readingProgress)
					.set({ progress: progressValue, isFinished, updatedAt: now })
					.where(eq(readingProgress.id, existing.id))
			: db.insert(readingProgress).values({
					userId: auth.userId,
					bookId,
					deviceType: "kobo",
					progress: progressValue,
					isFinished,
					updatedAt: now,
				}));

		const entitlementId = readingState?.EntitlementId ?? String(bookId);
		return Response.json({
			RequestResult: "Success",
			UpdateResults: [
				{
					EntitlementId: entitlementId,
					CurrentBookmarkResult: { Result: "Success" },
					StatusInfoResult: { Result: "Success" },
					StatisticsResult: { Result: "Success" },
				},
			],
		});
	} catch (error) {
		return (
			responseFromHttpError(error) ??
			new Response("Internal Server Error", { status: 500 })
		);
	}
}

// apps/web/src/routes/api/opds/pse.$bookId.$pageNumber.ts
export async function handleOpdsPseRequest({
	request,
	params,
}: {
	request: Request;
	params: { bookId: string; pageNumber: string };
}): Promise<Response> {
	try {
		const auth = await authenticateOpds(request);
		if (!auth) {
			return new Response("Unauthorized", {
				status: 401,
				headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
			});
		}

		const bookId = Number(params.bookId);
		const pageNumber = Number(params.pageNumber);
		if (Number.isNaN(bookId) || Number.isNaN(pageNumber)) {
			return new Response("Invalid parameters", { status: 400 });
		}

		await assertUserCanAccessBook(auth.userId, bookId);
		const cbzFile = await db.query.bookFiles.findFirst({
			where: and(eq(bookFiles.bookId, bookId), eq(bookFiles.format, "cbz")),
		});
		if (!cbzFile) {
			return new Response("CBZ file not found for this book", { status: 404 });
		}
		if (!existsSync(cbzFile.filePath)) {
			return new Response("File not found on disk", { status: 404 });
		}

		const zip = new AdmZip(cbzFile.filePath);
		const imageEntries = zip
			.getEntries()
			.filter((entry) => {
				const ext = path.extname(entry.entryName).slice(1).toLowerCase();
				return IMAGE_EXTENSIONS.has(ext) && !entry.isDirectory;
			})
			.toSorted((a, b) => a.entryName.localeCompare(b.entryName));

		if (pageNumber < 0 || pageNumber >= imageEntries.length) {
			return new Response("Page out of range", { status: 404 });
		}

		const entry = imageEntries[pageNumber];
		if (!entry) {
			return new Response("Page not found", { status: 404 });
		}

		const ext = path.extname(entry.entryName).slice(1).toLowerCase();
		const raw = entry.getData();
		const data = raw.buffer.slice(
			raw.byteOffset,
			raw.byteOffset + raw.byteLength,
		) as ArrayBuffer;

		return new Response(data, {
			status: 200,
			headers: {
				"Content-Type": getImageMimeType(ext),
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch (error) {
		return (
			responseFromHttpError(error) ??
			new Response("Internal Server Error", { status: 500 })
		);
	}
}
```

- [ ] **Step 3: Reuse the helper in the already-correct book and cover asset routes**

```ts
// apps/web/src/routes/api/books/$fileId.ts
} catch (error) {
	const httpErrorResponse = responseFromHttpError(error);
	if (httpErrorResponse) {
		return httpErrorResponse;
	}

	return new Response("Internal Server Error", { status: 500 });
}

// apps/web/src/routes/api/covers/$bookId.ts
} catch (error) {
	const httpErrorResponse = responseFromHttpError(error);
	if (httpErrorResponse) {
		return httpErrorResponse;
	}

	return new Response("Internal Server Error", { status: 500 });
}
```

- [ ] **Step 4: Run the access-failure regression tests**

Run: `cd apps/web && bun run test -- src/__tests__/access-route-errors.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the route error fix**

```bash
git add apps/web/src/server/http-errors.ts apps/web/src/routes/api/kobo/\$token/v1/library.\$bookId.download.ts apps/web/src/routes/api/kobo/\$token/v1/library.\$bookId.state.ts apps/web/src/routes/api/opds/pse.\$bookId.\$pageNumber.ts apps/web/src/routes/api/books/\$fileId.ts apps/web/src/routes/api/covers/\$bookId.ts apps/web/src/__tests__/access-route-errors.test.ts
git commit -m "fix: return http errors from asset routes"
```

### Task 5: Add a failing zero-library Kobo sync test, then fix the route

**Files:**
- Create: `apps/web/src/__tests__/kobo-sync.test.ts`
- Modify: `apps/web/src/routes/api/kobo/$token/v1/library.sync.ts`
- Test: `apps/web/src/__tests__/kobo-sync.test.ts`

- [ ] **Step 1: Add a failing test for zero-access sync token behavior**

```ts
// apps/web/src/__tests__/kobo-sync.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateKobo = vi.fn();
const getAccessibleLibraryIds = vi.fn();
const parseSyncToken = vi.fn();
const buildSyncToken = vi.fn();

vi.mock("src/db", () => ({ db: {} }));

vi.mock("src/server/access-control", () => ({
	getAccessibleLibraryIds,
}));

vi.mock("src/server/kobo", () => ({
	authenticateKobo,
	buildNewEntitlement: vi.fn(),
	buildSyncToken,
	parseSyncToken,
}));

describe("kobo sync", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("returns a fresh sync token even when the user has no accessible libraries", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		getAccessibleLibraryIds.mockResolvedValue([]);
		parseSyncToken.mockReturnValue({
			booksLastModified: "2026-04-01T00:00:00.000Z",
			readingStateLastModified: "2026-04-01T00:00:00.000Z",
		});
		buildSyncToken.mockReturnValue("fresh-token");

		const { handleKoboLibrarySyncRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.sync"
		);
		const response = await handleKoboLibrarySyncRequest({
			request: new Request("https://example.com/api/kobo/token/v1/library/sync"),
			params: { token: "token-1" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("x-kobo-synctoken")).toBe("fresh-token");
		expect(response.headers.get("x-kobo-sync")).toBeNull();
		await expect(response.json()).resolves.toEqual([]);
	});
});
```

- [ ] **Step 2: Verify the test fails before the route changes**

Run: `cd apps/web && bun run test -- src/__tests__/kobo-sync.test.ts`

Expected: FAIL because the named handler export does not exist yet and the current zero-library branch returns early without `x-kobo-synctoken`.

- [ ] **Step 3: Keep sync-token generation outside the zero-library early return**

```ts
// apps/web/src/routes/api/kobo/$token/v1/library.sync.ts
export async function handleKoboLibrarySyncRequest({
	request,
	params,
}: {
	request: Request;
	params: { token: string };
}): Promise<Response> {
	const auth = await authenticateKobo(params.token);
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;
	const accessibleLibraryIds = await getAccessibleLibraryIds(auth.userId);
	const rawSyncToken = request.headers.get("x-kobo-synctoken");
	const syncState = parseSyncToken(rawSyncToken);
	const booksAfter = new Date(syncState.booksLastModified);

	let hasMore = false;
	const changes: unknown[] = [];
	const now = new Date();

	if (accessibleLibraryIds.length > 0) {
		const allBooks = await db.query.books.findMany({
			where: and(
				inArray(books.libraryId, accessibleLibraryIds),
				gt(books.updatedAt, booksAfter),
			),
			limit: PAGE_SIZE + 1,
			columns: {
				id: true,
				title: true,
				sortTitle: true,
				description: true,
				language: true,
				publisher: true,
				publishDate: true,
				coverPath: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		hasMore = allBooks.length > PAGE_SIZE;
		const booksPage = hasMore ? allBooks.slice(0, PAGE_SIZE) : allBooks;
		if (booksPage.length > 0) {
			const bookIds = booksPage.map((b) => b.id);
			const allFiles = await db.query.bookFiles.findMany({
				where: inArray(bookFiles.bookId, bookIds),
			});
			const allBooksAuthors = await db.query.booksAuthors.findMany({
				where: inArray(booksAuthors.bookId, bookIds),
			});
			const authorIds = [...new Set(allBooksAuthors.map((ba) => ba.authorId))];
			const allAuthors =
				authorIds.length > 0
					? await db.query.authors.findMany({
							where: inArray(authors.id, authorIds),
						})
					: [];
			const allProgress = await db.query.readingProgress.findMany({
				where: inArray(readingProgress.bookId, bookIds),
			});
			const userProgress = allProgress.filter((progress) => progress.userId === auth.userId);
			const fullBooks = await db.query.books.findMany({
				where: inArray(books.id, bookIds),
			});

			for (const book of fullBooks) {
				const bookFilesList = allFiles.filter((file) => file.bookId === book.id);
				const bookAuthorIds = new Set(
					allBooksAuthors
						.filter((booksAuthor) => booksAuthor.bookId === book.id)
						.map((booksAuthor) => booksAuthor.authorId),
				);
				const bookAuthorsList = allAuthors.filter((author) =>
					bookAuthorIds.has(author.id),
				);
				const progress = userProgress.find((item) => item.bookId === book.id);

				changes.push(
					buildNewEntitlement(
						book,
						bookFilesList,
						bookAuthorsList,
						progress,
						baseUrl,
						params.token,
					),
				);
			}
		}
	}

	const newSyncToken = buildSyncToken({
		booksLastModified: now.toISOString(),
		readingStateLastModified: now.toISOString(),
	});

	const responseHeaders: Record<string, string> = {
		"x-kobo-synctoken": newSyncToken,
	};

	if (hasMore) {
		responseHeaders["x-kobo-sync"] = "continue";
	}

	return Response.json(changes, {
		status: 200,
		headers: responseHeaders,
	});
}
```

- [ ] **Step 4: Run the Kobo sync regression test**

Run: `cd apps/web && bun run test -- src/__tests__/kobo-sync.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the Kobo sync fix**

```bash
git add apps/web/src/routes/api/kobo/\$token/v1/library.sync.ts apps/web/src/__tests__/kobo-sync.test.ts
git commit -m "fix: keep kobo sync tokens advancing on zero access"
```

### Task 6: Run final verification across the changed surface

**Files:**
- Test: `apps/web/src/__tests__/request-auth.test.ts`
- Test: `apps/web/src/__tests__/opds-routes.test.ts`
- Test: `apps/web/src/__tests__/access-route-errors.test.ts`
- Test: `apps/web/src/__tests__/kobo-sync.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run: `cd apps/web && bun run test -- src/__tests__/request-auth.test.ts src/__tests__/opds-routes.test.ts src/__tests__/access-route-errors.test.ts src/__tests__/kobo-sync.test.ts`

Expected: PASS

- [ ] **Step 2: Run Biome on the touched files**

Run: `cd apps/web && bun x biome check src/server/opds.ts src/server/http-errors.ts src/routes/api/opds/all.ts src/routes/api/opds/libraries.$libraryId.ts src/routes/api/opds/recent.ts src/routes/api/opds/search.ts src/routes/api/kobo/$token/v1/library.$bookId.download.ts src/routes/api/kobo/$token/v1/library.$bookId.state.ts src/routes/api/opds/pse.$bookId.$pageNumber.ts src/routes/api/kobo/$token/v1/library.sync.ts src/routes/api/books/$fileId.ts src/routes/api/covers/$bookId.ts src/__tests__/request-auth.test.ts src/__tests__/opds-routes.test.ts src/__tests__/access-route-errors.test.ts src/__tests__/kobo-sync.test.ts`

Expected: Checked with no errors

- [ ] **Step 3: Inspect the final diff for scope control**

Run: `git diff --stat HEAD~4..HEAD`

Expected: only OPDS/Kobo/auth-error route files and the new regression tests are included

- [ ] **Step 4: Run the workspace status check**

Run: `git status --short`

Expected: no unexpected modifications beyond the user’s unrelated pre-existing worktree changes

- [ ] **Step 5: Commit the verified regression fix set**

```bash
git add apps/web/src/server/opds.ts apps/web/src/server/http-errors.ts apps/web/src/routes/api/opds/all.ts apps/web/src/routes/api/opds/libraries.\$libraryId.ts apps/web/src/routes/api/opds/recent.ts apps/web/src/routes/api/opds/search.ts apps/web/src/routes/api/kobo/\$token/v1/library.\$bookId.download.ts apps/web/src/routes/api/kobo/\$token/v1/library.\$bookId.state.ts apps/web/src/routes/api/opds/pse.\$bookId.\$pageNumber.ts apps/web/src/routes/api/kobo/\$token/v1/library.sync.ts apps/web/src/routes/api/books/\$fileId.ts apps/web/src/routes/api/covers/\$bookId.ts apps/web/src/__tests__/request-auth.test.ts apps/web/src/__tests__/opds-routes.test.ts apps/web/src/__tests__/access-route-errors.test.ts apps/web/src/__tests__/kobo-sync.test.ts
git commit -m "test: verify access-control protocol regressions"
```
