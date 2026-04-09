import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const getAccessibleLibraryIds = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectOrderByMock = vi.fn();
const dbSelectLimitMock = vi.fn();
const dbSelectInnerJoinMock = vi.fn();
const dbSelectGroupByMock = vi.fn();

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
	desc: vi.fn((col: unknown) => ({ desc: col })),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	gt: vi.fn((field: unknown, value: unknown) => ({ gt: field, value })),
	inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
	like: vi.fn((field: unknown, pattern: unknown) => ({ field, pattern })),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
}));

vi.mock("src/server/access-control", () => ({
	getAccessibleLibraryIds,
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
	orderBy: dbSelectOrderByMock,
	limit: dbSelectLimitMock,
	innerJoin: dbSelectInnerJoinMock,
	groupBy: dbSelectGroupByMock,
};

describe("search server functions", () => {
	const mockSession = {
		user: { id: "user-1", role: "user" },
	};

	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectOrderByMock.mockReturnValue(selectChain);
		dbSelectLimitMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);
		dbSelectGroupByMock.mockReturnValue(selectChain);
	});

	describe("searchFn", () => {
		test("returns empty results when user has no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);

			const { searchFn } = await import("src/server/search");

			const result = await searchFn({ data: { query: "Dune", limit: 20 } });

			expect(result).toEqual({ books: [], authors: [], series: [] });
		});

		test("calls requireAuth and getAccessibleLibraryIds", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);

			// searchFn runs Promise.all for books and series queries,
			// then an author-books join, then conditionally an authors query.
			//
			// Query flow:
			// 1. db.select().from(books).where(...).limit() — books query
			// 2. db.select().from(series).where(...).limit() — series query
			//    These two run in Promise.all, so JS evaluates them left-to-right:
			//    - select() #1 -> from() -> where() -> limit() resolves books
			//    - select() #2 -> from() -> where() -> limit() resolves series
			// 3. db.select({}).from(booksAuthors).innerJoin().where().groupBy() — author book IDs
			// 4. db.select().from(authors).where().limit() — authors query (if accessible IDs exist)

			// Books: where returns chain, limit resolves
			dbSelectWhereMock.mockReturnValueOnce(selectChain);
			dbSelectLimitMock.mockResolvedValueOnce([
				{ id: 1, title: "Dune", libraryId: 1 },
			]);

			// Series: where returns chain, limit resolves
			dbSelectWhereMock.mockReturnValueOnce(selectChain);
			dbSelectLimitMock.mockResolvedValueOnce([]);

			// Author-books join: groupBy resolves with author IDs
			dbSelectGroupByMock.mockResolvedValueOnce([{ authorId: 10 }]);

			// Authors query: where returns chain, limit resolves
			dbSelectWhereMock.mockReturnValueOnce(selectChain);
			dbSelectLimitMock.mockResolvedValueOnce([
				{ id: 10, name: "Frank Herbert" },
			]);

			const { searchFn } = await import("src/server/search");

			const result = await searchFn({ data: { query: "Dune", limit: 20 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
			expect(result).toEqual({
				books: [{ id: 1, title: "Dune", libraryId: 1 }],
				authors: [{ id: 10, name: "Frank Herbert" }],
				series: [],
			});
		});

		test("returns empty authors when no accessible author IDs found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);

			// Books query
			dbSelectWhereMock.mockReturnValueOnce(selectChain);
			dbSelectLimitMock.mockResolvedValueOnce([]);

			// Series query
			dbSelectWhereMock.mockReturnValueOnce(selectChain);
			dbSelectLimitMock.mockResolvedValueOnce([]);

			// Author-books join returns empty — no accessible authors
			dbSelectGroupByMock.mockResolvedValueOnce([]);

			const { searchFn } = await import("src/server/search");

			const result = await searchFn({
				data: { query: "nonexistent", limit: 20 },
			});

			expect(result.authors).toEqual([]);
		});

		test("propagates auth errors", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Unauthorized"));

			const { searchFn } = await import("src/server/search");

			await expect(
				searchFn({ data: { query: "test", limit: 20 } }),
			).rejects.toThrow("Unauthorized");
		});
	});

	describe("getContinueReadingFn", () => {
		test("calls requireAuth and getAccessibleLibraryIds", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectLimitMock.mockResolvedValueOnce([]);

			const { getContinueReadingFn } = await import("src/server/search");

			await getContinueReadingFn({ data: { limit: 12 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
		});

		test("returns empty array when user has no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);

			const { getContinueReadingFn } = await import("src/server/search");

			const result = await getContinueReadingFn({ data: { limit: 12 } });

			expect(result).toEqual([]);
		});

		test("returns in-progress books ordered by updatedAt desc", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);

			const mockRows = [
				{
					id: 2,
					title: "Book Two",
					progress: 0.7,
					progressUpdatedAt: new Date("2026-04-08"),
				},
				{
					id: 1,
					title: "Book One",
					progress: 0.3,
					progressUpdatedAt: new Date("2026-04-07"),
				},
			];

			dbSelectLimitMock.mockResolvedValueOnce(mockRows);

			const { getContinueReadingFn } = await import("src/server/search");

			const result = await getContinueReadingFn({ data: { limit: 12 } });

			expect(result).toEqual(mockRows);
		});

		test("respects limit parameter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectLimitMock.mockResolvedValueOnce([
				{ id: 1, title: "Only One", progress: 0.5 },
			]);

			const { getContinueReadingFn } = await import("src/server/search");

			await getContinueReadingFn({ data: { limit: 5 } });

			expect(dbSelectLimitMock).toHaveBeenCalledWith(5);
		});
	});
});
