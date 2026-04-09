import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const assertUserCanAccessAuthor = vi.fn();
const assertUserCanAccessSeries = vi.fn();
const getAccessibleLibraryIds = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectOrderByMock = vi.fn();
const dbSelectInnerJoinMock = vi.fn();

const authorsFindFirst = vi.fn();
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
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		query: {
			authors: { findFirst: authorsFindFirst },
			series: { findFirst: seriesFindFirst },
		},
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessAuthor,
	assertUserCanAccessSeries,
	getAccessibleLibraryIds,
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
	orderBy: dbSelectOrderByMock,
	innerJoin: dbSelectInnerJoinMock,
};

describe("authors server functions", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectOrderByMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);
	});

	describe("getAuthorDetailFn", () => {
		const mockSession = {
			user: { id: "user-1", role: "user" },
		};

		test("calls requireAuth, assertUserCanAccessAuthor, and getAccessibleLibraryIds", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessAuthor.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);
			authorsFindFirst.mockResolvedValueOnce({ id: 1, name: "Asimov" });
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getAuthorDetailFn } = await import("src/server/authors");

			await getAuthorDetailFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessAuthor).toHaveBeenCalledWith(
				"user-1",
				1,
				"user",
			);
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
		});

		test("returns author with books from accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessAuthor.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);

			const mockAuthor = { id: 1, name: "Isaac Asimov", libraryId: 1 };
			authorsFindFirst.mockResolvedValueOnce(mockAuthor);

			const mockBooks = [
				{
					id: 10,
					title: "Foundation",
					coverPath: "/covers/foundation.jpg",
					seriesIndex: 1,
					createdAt: "2026-01-01",
				},
				{
					id: 11,
					title: "Foundation and Empire",
					coverPath: "/covers/fae.jpg",
					seriesIndex: 2,
					createdAt: "2026-01-02",
				},
			];
			dbSelectWhereMock.mockResolvedValueOnce(mockBooks);

			const { getAuthorDetailFn } = await import("src/server/authors");

			const result = await getAuthorDetailFn({ data: { id: 1 } });

			expect(result).toEqual({
				...mockAuthor,
				books: mockBooks,
			});
		});

		test("throws when author is not found in DB", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessAuthor.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			authorsFindFirst.mockResolvedValueOnce(null);

			const { getAuthorDetailFn } = await import("src/server/authors");

			await expect(getAuthorDetailFn({ data: { id: 999 } })).rejects.toThrow(
				"Author not found",
			);
		});

		test("propagates error from assertUserCanAccessAuthor", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessAuthor.mockRejectedValueOnce(new Error("Forbidden"));

			const { getAuthorDetailFn } = await import("src/server/authors");

			await expect(getAuthorDetailFn({ data: { id: 1 } })).rejects.toThrow(
				"Forbidden",
			);
		});

		test("returns author with empty books array when no books in accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessAuthor.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			authorsFindFirst.mockResolvedValueOnce({ id: 1, name: "Unknown Author" });
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getAuthorDetailFn } = await import("src/server/authors");

			const result = await getAuthorDetailFn({ data: { id: 1 } });

			expect(result.books).toEqual([]);
		});
	});

	describe("getSeriesDetailFn", () => {
		const mockSession = {
			user: { id: "user-1", role: "admin" },
		};

		test("calls requireAuth, assertUserCanAccessSeries, and getAccessibleLibraryIds", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessSeries.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);
			seriesFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Foundation",
				libraryId: 1,
			});
			dbSelectOrderByMock.mockResolvedValueOnce([]);

			const { getSeriesDetailFn } = await import("src/server/authors");

			await getSeriesDetailFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessSeries).toHaveBeenCalledWith(
				"user-1",
				1,
				"admin",
			);
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "admin");
		});

		test("returns series with books ordered by seriesIndex", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessSeries.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);

			const mockSeries = { id: 1, name: "Dune Series", libraryId: 1 };
			seriesFindFirst.mockResolvedValueOnce(mockSeries);

			const mockBooks = [
				{
					id: 20,
					title: "Dune",
					coverPath: "/covers/dune.jpg",
					seriesIndex: 1,
					createdAt: "2026-01-01",
				},
				{
					id: 21,
					title: "Dune Messiah",
					coverPath: "/covers/dune-messiah.jpg",
					seriesIndex: 2,
					createdAt: "2026-01-02",
				},
			];
			dbSelectOrderByMock.mockResolvedValueOnce(mockBooks);

			const { getSeriesDetailFn } = await import("src/server/authors");

			const result = await getSeriesDetailFn({ data: { id: 1 } });

			expect(result).toEqual({
				...mockSeries,
				books: mockBooks,
			});
		});

		test("throws when series is not found in DB", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessSeries.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			seriesFindFirst.mockResolvedValueOnce(null);

			const { getSeriesDetailFn } = await import("src/server/authors");

			await expect(getSeriesDetailFn({ data: { id: 999 } })).rejects.toThrow(
				"Series not found",
			);
		});

		test("propagates error from assertUserCanAccessSeries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessSeries.mockRejectedValueOnce(new Error("Forbidden"));

			const { getSeriesDetailFn } = await import("src/server/authors");

			await expect(getSeriesDetailFn({ data: { id: 1 } })).rejects.toThrow(
				"Forbidden",
			);
		});

		test("returns series with empty books array when no books in accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessSeries.mockResolvedValueOnce(undefined);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			seriesFindFirst.mockResolvedValueOnce({
				id: 5,
				name: "Empty Series",
				libraryId: 1,
			});
			dbSelectOrderByMock.mockResolvedValueOnce([]);

			const { getSeriesDetailFn } = await import("src/server/authors");

			const result = await getSeriesDetailFn({ data: { id: 5 } });

			expect(result.books).toEqual([]);
		});
	});
});
