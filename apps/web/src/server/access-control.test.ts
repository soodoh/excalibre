import { beforeEach, describe, expect, test, vi } from "vitest";

const eqMock = vi.fn((field: unknown, value: unknown) => ({ field, value }));
const andMock = vi.fn((...clauses: unknown[]) => ({ clauses }));
const inArrayMock = vi.fn((field: unknown, values: unknown) => ({
	field,
	values,
}));

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectInnerJoinMock = vi.fn();
const dbSelectLimitMock = vi.fn();

const userFindFirst = vi.fn();
const librariesFindFirst = vi.fn();
const libraryAccessFindFirst = vi.fn();
const booksFindFirst = vi.fn();
const bookFilesFindFirst = vi.fn();
const authorsFindFirst = vi.fn();
const seriesFindFirst = vi.fn();

vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
	inArray: inArrayMock,
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		query: {
			user: { findFirst: userFindFirst },
			libraries: { findFirst: librariesFindFirst },
			libraryAccess: { findFirst: libraryAccessFindFirst },
			books: { findFirst: booksFindFirst },
			bookFiles: { findFirst: bookFilesFindFirst },
			authors: { findFirst: authorsFindFirst },
			series: { findFirst: seriesFindFirst },
		},
	},
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
	innerJoin: dbSelectInnerJoinMock,
	limit: dbSelectLimitMock,
};

describe("access-control", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);
		dbSelectLimitMock.mockReturnValue(selectChain);
	});

	describe("getAccessibleLibraryIds", () => {
		test("returns all library IDs for admin users (role provided)", async () => {
			dbSelectFromMock.mockReturnValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

			const { getAccessibleLibraryIds } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraryIds("user-1", "admin");

			expect(result).toEqual([1, 2, 3]);
			expect(userFindFirst).not.toHaveBeenCalled();
		});

		test("returns all library IDs for admin users (role resolved from DB)", async () => {
			userFindFirst.mockResolvedValueOnce({ role: "admin" });
			dbSelectFromMock.mockReturnValueOnce([{ id: 10 }, { id: 20 }]);

			const { getAccessibleLibraryIds } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraryIds("admin-user");

			expect(result).toEqual([10, 20]);
			expect(userFindFirst).toHaveBeenCalledTimes(1);
		});

		test("returns only accessible library IDs for regular users", async () => {
			dbSelectWhereMock.mockReturnValueOnce([
				{ libraryId: 5 },
				{ libraryId: 7 },
			]);

			const { getAccessibleLibraryIds } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraryIds("user-1", "user");

			expect(result).toEqual([5, 7]);
		});

		test("returns empty array for regular user with no library access", async () => {
			dbSelectWhereMock.mockReturnValueOnce([]);

			const { getAccessibleLibraryIds } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraryIds("user-1", "user");

			expect(result).toEqual([]);
		});

		test("defaults to user role when user record is not found", async () => {
			userFindFirst.mockResolvedValueOnce(null);
			dbSelectWhereMock.mockReturnValueOnce([{ libraryId: 1 }]);

			const { getAccessibleLibraryIds } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraryIds("unknown-user");

			expect(result).toEqual([1]);
		});
	});

	describe("getAccessibleLibraries", () => {
		test("returns all libraries for admin users", async () => {
			const allLibraries = [
				{ id: 1, name: "Fiction" },
				{ id: 2, name: "Non-fiction" },
			];
			dbSelectFromMock.mockReturnValueOnce(allLibraries);

			const { getAccessibleLibraries } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraries("user-1", "admin");

			expect(result).toEqual(allLibraries);
		});

		test("returns empty array for regular user with no library access", async () => {
			// getAccessibleLibraryIds call for role resolution returns []
			dbSelectWhereMock.mockReturnValueOnce([]);

			const { getAccessibleLibraries } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraries("user-1", "user");

			expect(result).toEqual([]);
		});

		test("returns filtered libraries for regular user with access", async () => {
			// getAccessibleLibraryIds returns libraryIds
			dbSelectWhereMock.mockReturnValueOnce([
				{ libraryId: 2 },
				{ libraryId: 5 },
			]);
			// Then the filtered libraries query
			const filteredLibraries = [
				{ id: 2, name: "Sci-Fi" },
				{ id: 5, name: "Comics" },
			];
			dbSelectWhereMock.mockReturnValueOnce(filteredLibraries);

			const { getAccessibleLibraries } = await import(
				"src/server/access-control"
			);
			const result = await getAccessibleLibraries("user-1", "user");

			expect(result).toEqual(filteredLibraries);
		});
	});

	describe("assertUserCanAccessLibrary", () => {
		test("throws NotFoundError when library does not exist", async () => {
			librariesFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessLibrary } = await import(
				"src/server/access-control"
			);

			await expect(assertUserCanAccessLibrary("user-1", 999)).rejects.toThrow(
				/library not found/i,
			);
		});

		test("returns library for admin without checking access rows", async () => {
			const library = { id: 1, name: "Fiction" };
			librariesFindFirst.mockResolvedValueOnce(library);

			const { assertUserCanAccessLibrary } = await import(
				"src/server/access-control"
			);
			const result = await assertUserCanAccessLibrary("user-1", 1, "admin");

			expect(result).toEqual(library);
			expect(libraryAccessFindFirst).not.toHaveBeenCalled();
		});

		test("returns library for regular user with access", async () => {
			const library = { id: 1, name: "Fiction" };
			librariesFindFirst.mockResolvedValueOnce(library);
			libraryAccessFindFirst.mockResolvedValueOnce({
				userId: "user-1",
				libraryId: 1,
			});

			const { assertUserCanAccessLibrary } = await import(
				"src/server/access-control"
			);
			const result = await assertUserCanAccessLibrary("user-1", 1, "user");

			expect(result).toEqual(library);
		});

		test("throws ForbiddenError for regular user without access", async () => {
			const library = { id: 1, name: "Fiction" };
			librariesFindFirst.mockResolvedValueOnce(library);
			libraryAccessFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessLibrary } = await import(
				"src/server/access-control"
			);

			await expect(
				assertUserCanAccessLibrary("user-1", 1, "user"),
			).rejects.toThrow(/forbidden.*no access to this library/i);
		});
	});

	describe("assertUserCanAccessBook", () => {
		test("throws NotFoundError when book does not exist", async () => {
			booksFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessBook } = await import(
				"src/server/access-control"
			);

			await expect(assertUserCanAccessBook("user-1", 999)).rejects.toThrow(
				/book not found/i,
			);
		});

		test("returns book when user has access to its library", async () => {
			const book = { id: 1, libraryId: 2, title: "Dune" };
			booksFindFirst.mockResolvedValueOnce(book);
			// assertUserCanAccessLibrary internals
			librariesFindFirst.mockResolvedValueOnce({ id: 2, name: "Sci-Fi" });

			const { assertUserCanAccessBook } = await import(
				"src/server/access-control"
			);
			const result = await assertUserCanAccessBook("user-1", 1, "admin");

			expect(result).toEqual(book);
		});

		test("throws ForbiddenError when user lacks access to book's library", async () => {
			const book = { id: 1, libraryId: 2, title: "Dune" };
			booksFindFirst.mockResolvedValueOnce(book);
			librariesFindFirst.mockResolvedValueOnce({ id: 2, name: "Sci-Fi" });
			libraryAccessFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessBook } = await import(
				"src/server/access-control"
			);

			await expect(
				assertUserCanAccessBook("user-1", 1, "user"),
			).rejects.toThrow(/forbidden.*no access to this library/i);
		});
	});

	describe("assertUserCanAccessBookFile", () => {
		test("throws NotFoundError when file does not exist", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessBookFile } = await import(
				"src/server/access-control"
			);

			await expect(assertUserCanAccessBookFile("user-1", 999)).rejects.toThrow(
				/book file not found/i,
			);
		});

		test("returns file when user has access to the book's library", async () => {
			const file = { id: 10, bookId: 1, format: "epub" };
			bookFilesFindFirst.mockResolvedValueOnce(file);
			// assertUserCanAccessBook internals
			const book = { id: 1, libraryId: 2, title: "Dune" };
			booksFindFirst.mockResolvedValueOnce(book);
			// assertUserCanAccessLibrary internals
			librariesFindFirst.mockResolvedValueOnce({ id: 2, name: "Sci-Fi" });

			const { assertUserCanAccessBookFile } = await import(
				"src/server/access-control"
			);
			const result = await assertUserCanAccessBookFile("user-1", 10, "admin");

			expect(result).toEqual(file);
		});

		test("throws ForbiddenError when user lacks access to file's book library", async () => {
			const file = { id: 10, bookId: 1, format: "epub" };
			bookFilesFindFirst.mockResolvedValueOnce(file);
			const book = { id: 1, libraryId: 2, title: "Dune" };
			booksFindFirst.mockResolvedValueOnce(book);
			librariesFindFirst.mockResolvedValueOnce({ id: 2, name: "Sci-Fi" });
			libraryAccessFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessBookFile } = await import(
				"src/server/access-control"
			);

			await expect(
				assertUserCanAccessBookFile("user-1", 10, "user"),
			).rejects.toThrow(/forbidden.*no access to this library/i);
		});
	});

	describe("assertUserCanAccessAuthor", () => {
		test("throws NotFoundError when author does not exist", async () => {
			authorsFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessAuthor } = await import(
				"src/server/access-control"
			);

			await expect(assertUserCanAccessAuthor("user-1", 999)).rejects.toThrow(
				/author not found/i,
			);
		});

		test("throws ForbiddenError when user has no accessible libraries", async () => {
			authorsFindFirst.mockResolvedValueOnce({ id: 1, name: "Asimov" });
			// getAccessibleLibraryIds for "user" role returns []
			dbSelectWhereMock.mockReturnValueOnce([]);

			const { assertUserCanAccessAuthor } = await import(
				"src/server/access-control"
			);

			await expect(
				assertUserCanAccessAuthor("user-1", 1, "user"),
			).rejects.toThrow(/forbidden.*no access to this author/i);
		});

		test("throws ForbiddenError when author has no books in accessible libraries", async () => {
			authorsFindFirst.mockResolvedValueOnce({ id: 1, name: "Asimov" });
			// getAccessibleLibraryIds for admin returns all libraries
			dbSelectFromMock.mockReturnValueOnce([{ id: 1 }, { id: 2 }]);
			// The joined query for author's books returns empty
			dbSelectLimitMock.mockReturnValueOnce([]);

			const { assertUserCanAccessAuthor } = await import(
				"src/server/access-control"
			);

			await expect(
				assertUserCanAccessAuthor("user-1", 1, "admin"),
			).rejects.toThrow(/forbidden.*no access to this author/i);
		});

		test("returns author when they have books in accessible libraries", async () => {
			const author = { id: 1, name: "Asimov" };
			authorsFindFirst.mockResolvedValueOnce(author);
			// getAccessibleLibraryIds for admin returns all libraries
			dbSelectFromMock.mockReturnValueOnce([{ id: 1 }, { id: 2 }]);
			// The joined query returns a book row
			dbSelectLimitMock.mockReturnValueOnce([{ id: 42 }]);

			const { assertUserCanAccessAuthor } = await import(
				"src/server/access-control"
			);
			const result = await assertUserCanAccessAuthor("user-1", 1, "admin");

			expect(result).toEqual(author);
		});
	});

	describe("assertUserCanAccessSeries", () => {
		test("throws NotFoundError when series does not exist", async () => {
			seriesFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessSeries } = await import(
				"src/server/access-control"
			);

			await expect(assertUserCanAccessSeries("user-1", 999)).rejects.toThrow(
				/series not found/i,
			);
		});

		test("returns series for admin user", async () => {
			const seriesRecord = { id: 1, name: "Foundation", libraryId: 2 };
			seriesFindFirst.mockResolvedValueOnce(seriesRecord);
			// assertUserCanAccessLibrary internals
			librariesFindFirst.mockResolvedValueOnce({ id: 2, name: "Sci-Fi" });

			const { assertUserCanAccessSeries } = await import(
				"src/server/access-control"
			);
			const result = await assertUserCanAccessSeries("user-1", 1, "admin");

			expect(result).toEqual(seriesRecord);
		});

		test("throws ForbiddenError when user lacks access to series library", async () => {
			const seriesRecord = { id: 1, name: "Foundation", libraryId: 2 };
			seriesFindFirst.mockResolvedValueOnce(seriesRecord);
			librariesFindFirst.mockResolvedValueOnce({ id: 2, name: "Sci-Fi" });
			libraryAccessFindFirst.mockResolvedValueOnce(null);

			const { assertUserCanAccessSeries } = await import(
				"src/server/access-control"
			);

			await expect(
				assertUserCanAccessSeries("user-1", 1, "user"),
			).rejects.toThrow(/forbidden.*no access to this library/i);
		});
	});
});
