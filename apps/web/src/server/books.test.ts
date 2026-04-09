import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const requireLibraryAccess = vi.fn();
const assertUserCanAccessBook = vi.fn();
const getAccessibleLibraryIds = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectOrderByMock = vi.fn();
const dbSelectLimitMock = vi.fn();
const dbSelectOffsetMock = vi.fn();
const dbSelectInnerJoinMock = vi.fn();

const booksFindFirst = vi.fn();
const seriesFindFirst = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: () => ({
			handler: (handler: unknown) => handler,
		}),
	}),
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...clauses: unknown[]) => ({ clauses })),
	count: vi.fn(() => "count_expr"),
	desc: vi.fn((col: unknown) => ({ desc: col })),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
	like: vi.fn((field: unknown, pattern: unknown) => ({ field, pattern })),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		query: {
			books: { findFirst: booksFindFirst },
			series: { findFirst: seriesFindFirst },
		},
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
	requireLibraryAccess,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
	getAccessibleLibraryIds,
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
	orderBy: dbSelectOrderByMock,
	limit: dbSelectLimitMock,
	offset: dbSelectOffsetMock,
	innerJoin: dbSelectInnerJoinMock,
};

describe("books server functions", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectOrderByMock.mockReturnValue(selectChain);
		dbSelectLimitMock.mockReturnValue(selectChain);
		dbSelectOffsetMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);
	});

	describe("getBooksByLibraryFn", () => {
		/**
		 * getBooksByLibraryFn does Promise.all with two queries:
		 *   query1: db.select().from().where().orderBy().limit().offset()
		 *   query2: db.select({value: count()}).from().where()
		 *
		 * JS evaluates array elements left-to-right, so call order is:
		 *   1. where() for query1 -> must return chain (continues to orderBy)
		 *   2. offset() terminates query1 -> must resolve to rows
		 *   3. where() for query2 -> must resolve to count array
		 */
		function setupLibraryQuery(
			rows: unknown[],
			total: number | undefined,
		): void {
			// First where() call: query1 chain continues
			dbSelectWhereMock.mockReturnValueOnce(selectChain);
			// query1 terminates at offset()
			dbSelectOffsetMock.mockResolvedValueOnce(rows);
			// Second where() call: query2 terminates here
			const countRows =
				total !== undefined ? [{ value: total }] : ([] as unknown[]);
			dbSelectWhereMock.mockResolvedValueOnce(countRows);
		}

		test("calls requireLibraryAccess with the given libraryId", async () => {
			requireLibraryAccess.mockResolvedValueOnce(undefined);
			setupLibraryQuery([], 0);

			const { getBooksByLibraryFn } = await import("src/server/books");

			await getBooksByLibraryFn({
				data: { libraryId: 1, limit: 50, offset: 0 },
			});

			expect(requireLibraryAccess).toHaveBeenCalledWith(1);
		});

		test("returns paginated books with total count", async () => {
			requireLibraryAccess.mockResolvedValueOnce(undefined);

			const mockBooks = [
				{ id: 1, title: "Book One", libraryId: 1 },
				{ id: 2, title: "Book Two", libraryId: 1 },
			];
			setupLibraryQuery(mockBooks, 42);

			const { getBooksByLibraryFn } = await import("src/server/books");

			const result = await getBooksByLibraryFn({
				data: { libraryId: 1, limit: 10, offset: 0 },
			});

			expect(result).toEqual({ books: mockBooks, total: 42 });
		});

		test("returns total 0 when count row is missing", async () => {
			requireLibraryAccess.mockResolvedValueOnce(undefined);
			setupLibraryQuery([], undefined);

			const { getBooksByLibraryFn } = await import("src/server/books");

			const result = await getBooksByLibraryFn({
				data: { libraryId: 1, limit: 50, offset: 0 },
			});

			expect(result).toEqual({ books: [], total: 0 });
		});

		test("applies search filter when search is provided", async () => {
			requireLibraryAccess.mockResolvedValueOnce(undefined);
			setupLibraryQuery([{ id: 3, title: "Dune", libraryId: 1 }], 1);

			const { getBooksByLibraryFn } = await import("src/server/books");

			const result = await getBooksByLibraryFn({
				data: { libraryId: 1, search: "Dune", limit: 50, offset: 0 },
			});

			expect(result).toEqual({
				books: [{ id: 3, title: "Dune", libraryId: 1 }],
				total: 1,
			});
		});

		test("propagates error from requireLibraryAccess", async () => {
			requireLibraryAccess.mockRejectedValueOnce(new Error("Forbidden"));

			const { getBooksByLibraryFn } = await import("src/server/books");

			await expect(
				getBooksByLibraryFn({
					data: { libraryId: 999, limit: 50, offset: 0 },
				}),
			).rejects.toThrow("Forbidden");
		});
	});

	describe("getBookDetailFn", () => {
		const mockSession = {
			user: { id: "user-1", role: "user" },
		};

		test("calls requireAuth and assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			booksFindFirst.mockResolvedValueOnce({
				id: 1,
				title: "Dune",
				seriesId: null,
			});
			// files query
			dbSelectWhereMock.mockResolvedValueOnce([]);
			// authors query
			dbSelectWhereMock.mockResolvedValueOnce([]);
			// tags query
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getBookDetailFn } = await import("src/server/books");

			await getBookDetailFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith("user-1", 1, "user");
		});

		test("returns book with files, authors, series, and tags", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			const mockBook = {
				id: 1,
				title: "Dune",
				seriesId: 5,
				libraryId: 1,
			};

			booksFindFirst.mockResolvedValueOnce(mockBook);
			// files query
			dbSelectWhereMock.mockResolvedValueOnce([
				{ id: 10, bookId: 1, format: "epub", filePath: "/books/dune.epub" },
			]);
			// authors query (innerJoin -> where)
			dbSelectWhereMock.mockResolvedValueOnce([
				{ id: 2, name: "Frank Herbert", role: "author" },
			]);
			// series query
			seriesFindFirst.mockResolvedValueOnce({ id: 5, name: "Dune Series" });
			// tags query (innerJoin -> where)
			dbSelectWhereMock.mockResolvedValueOnce([
				{ id: 3, name: "Science Fiction" },
			]);

			const { getBookDetailFn } = await import("src/server/books");

			const result = await getBookDetailFn({ data: { id: 1 } });

			expect(result).toEqual({
				id: 1,
				title: "Dune",
				seriesId: 5,
				libraryId: 1,
				files: [
					{ id: 10, bookId: 1, format: "epub", filePath: "/books/dune.epub" },
				],
				authors: [{ id: 2, name: "Frank Herbert", role: "author" }],
				series: { id: 5, name: "Dune Series" },
				tags: [{ id: 3, name: "Science Fiction" }],
			});
		});

		test("returns null series when book has no seriesId", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			booksFindFirst.mockResolvedValueOnce({
				id: 2,
				title: "Standalone Book",
				seriesId: null,
			});
			dbSelectWhereMock.mockResolvedValueOnce([]); // files
			dbSelectWhereMock.mockResolvedValueOnce([]); // authors
			dbSelectWhereMock.mockResolvedValueOnce([]); // tags

			const { getBookDetailFn } = await import("src/server/books");

			const result = await getBookDetailFn({ data: { id: 2 } });

			expect(result.series).toBeNull();
		});

		test("returns null series when seriesId exists but series record not found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			booksFindFirst.mockResolvedValueOnce({
				id: 3,
				title: "Orphan Book",
				seriesId: 99,
			});
			dbSelectWhereMock.mockResolvedValueOnce([]); // files
			dbSelectWhereMock.mockResolvedValueOnce([]); // authors
			seriesFindFirst.mockResolvedValueOnce(null); // series not found
			dbSelectWhereMock.mockResolvedValueOnce([]); // tags

			const { getBookDetailFn } = await import("src/server/books");

			const result = await getBookDetailFn({ data: { id: 3 } });

			expect(result.series).toBeNull();
		});

		test("throws when book is not found in DB", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			booksFindFirst.mockResolvedValueOnce(null);

			const { getBookDetailFn } = await import("src/server/books");

			await expect(getBookDetailFn({ data: { id: 999 } })).rejects.toThrow(
				"Book not found",
			);
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { getBookDetailFn } = await import("src/server/books");

			await expect(getBookDetailFn({ data: { id: 1 } })).rejects.toThrow(
				"Forbidden",
			);
		});
	});

	describe("getRecentBooksFn", () => {
		const mockSession = {
			user: { id: "user-1", role: "user" },
		};

		test("calls requireAuth and getAccessibleLibraryIds", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);
			dbSelectLimitMock.mockResolvedValueOnce([]);

			const { getRecentBooksFn } = await import("src/server/books");

			await getRecentBooksFn({ data: { limit: 12 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
		});

		test("returns empty array when user has no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);

			const { getRecentBooksFn } = await import("src/server/books");

			const result = await getRecentBooksFn({ data: { limit: 12 } });

			expect(result).toEqual([]);
		});

		test("returns recent books from accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);

			const mockBooks = [
				{ id: 1, title: "Recent Book 1", libraryId: 1 },
				{ id: 2, title: "Recent Book 2", libraryId: 2 },
			];

			dbSelectLimitMock.mockResolvedValueOnce(mockBooks);

			const { getRecentBooksFn } = await import("src/server/books");

			const result = await getRecentBooksFn({ data: { limit: 12 } });

			expect(result).toEqual(mockBooks);
		});

		test("respects limit parameter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectLimitMock.mockResolvedValueOnce([
				{ id: 1, title: "Only One", libraryId: 1 },
			]);

			const { getRecentBooksFn } = await import("src/server/books");

			await getRecentBooksFn({ data: { limit: 1 } });

			expect(dbSelectLimitMock).toHaveBeenCalledWith(1);
		});
	});
});
