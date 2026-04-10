import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const assertUserCanAccessBook = vi.fn();
const getAccessibleLibraryIds = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectLeftJoinMock = vi.fn();
const dbSelectGroupByMock = vi.fn();
const dbSelectInnerJoinMock = vi.fn();
const dbSelectOrderByMock = vi.fn();

const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();
const dbInsertOnConflictDoNothingMock = vi.fn();

const dbUpdateMock = vi.fn();
const dbUpdateSetMock = vi.fn();
const dbUpdateWhereMock = vi.fn();
const dbUpdateReturningMock = vi.fn();

const dbDeleteMock = vi.fn();
const dbDeleteWhereMock = vi.fn();

const readingListsFindFirst = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
		inputValidator: (validator: (raw: unknown) => unknown) => ({
			handler: (handler: (ctx: { data: unknown }) => unknown) => {
				return (ctx: { data: unknown }) => {
					validator(ctx.data);
					return handler(ctx);
				};
			},
		}),
	}),
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...clauses: unknown[]) => ({ clauses })),
	asc: vi.fn((col: unknown) => ({ asc: col })),
	count: vi.fn(() => "count_expr"),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
	max: vi.fn(() => "max_expr"),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		insert: dbInsertMock,
		update: dbUpdateMock,
		delete: dbDeleteMock,
		query: {
			readingLists: { findFirst: readingListsFindFirst },
		},
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
	getAccessibleLibraryIds,
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
	leftJoin: dbSelectLeftJoinMock,
	groupBy: dbSelectGroupByMock,
	innerJoin: dbSelectInnerJoinMock,
	orderBy: dbSelectOrderByMock,
};

const insertChain = {
	values: dbInsertValuesMock,
	returning: dbInsertReturningMock,
	onConflictDoNothing: dbInsertOnConflictDoNothingMock,
};

const updateChain = {
	set: dbUpdateSetMock,
	where: dbUpdateWhereMock,
	returning: dbUpdateReturningMock,
};

const deleteChain = {
	where: dbDeleteWhereMock,
};

const mockSession = {
	user: { id: "user-1", role: "user" },
};

describe("reading-lists server functions", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectLeftJoinMock.mockReturnValue(selectChain);
		dbSelectGroupByMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);
		dbSelectOrderByMock.mockReturnValue(selectChain);

		dbInsertMock.mockReturnValue(insertChain);
		dbInsertValuesMock.mockReturnValue(insertChain);
		dbInsertReturningMock.mockReturnValue(insertChain);
		dbInsertOnConflictDoNothingMock.mockReturnValue(insertChain);

		dbUpdateMock.mockReturnValue(updateChain);
		dbUpdateSetMock.mockReturnValue(updateChain);
		dbUpdateWhereMock.mockReturnValue(updateChain);
		dbUpdateReturningMock.mockReturnValue(updateChain);

		dbDeleteMock.mockReturnValue(deleteChain);
		dbDeleteWhereMock.mockReturnValue(deleteChain);
	});

	describe("getReadingListsFn", () => {
		/**
		 * Query chain: db.select().from().leftJoin().where().groupBy()
		 */
		test("calls requireAuth and returns reading lists with book counts", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const mockLists = [
				{
					id: 1,
					name: "Currently Reading",
					userId: "user-1",
					createdAt: new Date(),
					bookCount: 5,
				},
				{
					id: 2,
					name: "Up Next",
					userId: "user-1",
					createdAt: new Date(),
					bookCount: 0,
				},
			];
			dbSelectGroupByMock.mockResolvedValueOnce(mockLists);

			const { getReadingListsFn } = await import("src/server/reading-lists");
			const result = await getReadingListsFn();

			expect(requireAuth).toHaveBeenCalled();
			expect(dbSelectMock).toHaveBeenCalled();
			expect(result).toEqual(mockLists);
		});

		test("returns empty array when user has no reading lists", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbSelectGroupByMock.mockResolvedValueOnce([]);

			const { getReadingListsFn } = await import("src/server/reading-lists");
			const result = await getReadingListsFn();

			expect(result).toEqual([]);
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { getReadingListsFn } = await import("src/server/reading-lists");

			await expect(getReadingListsFn()).rejects.toThrow("Not authenticated");
		});
	});

	describe("getReadingListBooksFn", () => {
		/**
		 * Query chain:
		 *   1. db.query.readingLists.findFirst() — ownership check
		 *   2. getAccessibleLibraryIds()
		 *   3. db.select().from().innerJoin().where().orderBy() — with asc(sortOrder)
		 */
		test("returns books in reading list ordered by sortOrder", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Currently Reading",
				userId: "user-1",
			});

			const mockBooks = [
				{ id: 10, title: "Book A", libraryId: 1, sortOrder: 0 },
				{ id: 20, title: "Book B", libraryId: 2, sortOrder: 1 },
			];
			dbSelectOrderByMock.mockResolvedValueOnce(mockBooks);

			const { getReadingListBooksFn } = await import(
				"src/server/reading-lists"
			);
			const result = await getReadingListBooksFn({
				data: { readingListId: 1 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
			expect(readingListsFindFirst).toHaveBeenCalled();
			expect(result).toEqual(mockBooks);
		});

		test("throws when reading list not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			readingListsFindFirst.mockResolvedValueOnce(null);

			const { getReadingListBooksFn } = await import(
				"src/server/reading-lists"
			);

			await expect(
				getReadingListBooksFn({ data: { readingListId: 999 } }),
			).rejects.toThrow("Reading list not found");
		});

		test("returns empty array when user has no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Currently Reading",
				userId: "user-1",
			});

			const { getReadingListBooksFn } = await import(
				"src/server/reading-lists"
			);
			const result = await getReadingListBooksFn({
				data: { readingListId: 1 },
			});

			expect(result).toEqual([]);
		});
	});

	describe("createReadingListFn", () => {
		/**
		 * Query chain: db.insert().values().returning()
		 */
		test("creates reading list with user assignment", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const mockList = {
				id: 1,
				name: "New List",
				userId: "user-1",
				createdAt: new Date(),
			};
			dbInsertReturningMock.mockResolvedValueOnce([mockList]);

			const { createReadingListFn } = await import("src/server/reading-lists");
			const result = await createReadingListFn({ data: { name: "New List" } });

			expect(requireAuth).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(dbInsertValuesMock).toHaveBeenCalledWith({
				name: "New List",
				userId: "user-1",
			});
			expect(result).toEqual(mockList);
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { createReadingListFn } = await import("src/server/reading-lists");

			await expect(
				createReadingListFn({ data: { name: "Test" } }),
			).rejects.toThrow("Not authenticated");
		});
	});

	describe("updateReadingListFn", () => {
		/**
		 * Query chain: db.update().set().where().returning()
		 */
		test("updates reading list name with ownership check", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const updated = {
				id: 1,
				name: "Renamed List",
				userId: "user-1",
				createdAt: new Date(),
			};
			dbUpdateReturningMock.mockResolvedValueOnce([updated]);

			const { updateReadingListFn } = await import("src/server/reading-lists");
			const result = await updateReadingListFn({
				data: { id: 1, name: "Renamed List" },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(dbUpdateSetMock).toHaveBeenCalledWith({ name: "Renamed List" });
			expect(result).toEqual(updated);
		});

		test("throws when reading list not found (different user)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbUpdateReturningMock.mockResolvedValueOnce([]);

			const { updateReadingListFn } = await import("src/server/reading-lists");

			await expect(
				updateReadingListFn({ data: { id: 999, name: "Nope" } }),
			).rejects.toThrow("Reading list not found");
		});
	});

	describe("deleteReadingListFn", () => {
		/**
		 * Query chain: db.delete().where()
		 */
		test("deletes reading list with ownership check and returns success", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { deleteReadingListFn } = await import("src/server/reading-lists");
			const result = await deleteReadingListFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { deleteReadingListFn } = await import("src/server/reading-lists");

			await expect(deleteReadingListFn({ data: { id: 1 } })).rejects.toThrow(
				"Not authenticated",
			);
		});
	});

	describe("addBookToReadingListFn", () => {
		/**
		 * Steps:
		 *   1. requireAuth()
		 *   2. assertUserCanAccessBook()
		 *   3. db.query.readingLists.findFirst() — ownership
		 *   4. db.select({maxSort: max()}).from().where() — get max sortOrder
		 *   5. db.insert().values().onConflictDoNothing()
		 */
		test("adds book with auto-incremented sortOrder (max + 1)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "My List",
				userId: "user-1",
			});

			// max sortOrder query: db.select().from().where() resolves
			dbSelectWhereMock.mockResolvedValueOnce([{ maxSort: 4 }]);
			// insert query
			dbInsertOnConflictDoNothingMock.mockResolvedValueOnce(undefined);

			const { addBookToReadingListFn } = await import(
				"src/server/reading-lists"
			);
			const result = await addBookToReadingListFn({
				data: { readingListId: 1, bookId: 10 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(readingListsFindFirst).toHaveBeenCalled();
			expect(dbInsertValuesMock).toHaveBeenCalledWith({
				readingListId: 1,
				bookId: 10,
				sortOrder: 5,
			});
			expect(result).toEqual({ success: true });
		});

		test("uses sortOrder 0 when max is null (empty list)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "My List",
				userId: "user-1",
			});

			// max sortOrder is null when list is empty
			dbSelectWhereMock.mockResolvedValueOnce([{ maxSort: null }]);
			dbInsertOnConflictDoNothingMock.mockResolvedValueOnce(undefined);

			const { addBookToReadingListFn } = await import(
				"src/server/reading-lists"
			);
			await addBookToReadingListFn({ data: { readingListId: 1, bookId: 10 } });

			expect(dbInsertValuesMock).toHaveBeenCalledWith({
				readingListId: 1,
				bookId: 10,
				sortOrder: 0,
			});
		});

		test("throws when user cannot access book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { addBookToReadingListFn } = await import(
				"src/server/reading-lists"
			);

			await expect(
				addBookToReadingListFn({ data: { readingListId: 1, bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});

		test("throws when reading list not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingListsFindFirst.mockResolvedValueOnce(null);

			const { addBookToReadingListFn } = await import(
				"src/server/reading-lists"
			);

			await expect(
				addBookToReadingListFn({ data: { readingListId: 999, bookId: 10 } }),
			).rejects.toThrow("Reading list not found");
		});

		test("uses onConflictDoNothing for duplicate entries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "My List",
				userId: "user-1",
			});
			dbSelectWhereMock.mockResolvedValueOnce([{ maxSort: 2 }]);
			dbInsertOnConflictDoNothingMock.mockResolvedValueOnce(undefined);

			const { addBookToReadingListFn } = await import(
				"src/server/reading-lists"
			);
			await addBookToReadingListFn({ data: { readingListId: 1, bookId: 10 } });

			expect(dbInsertOnConflictDoNothingMock).toHaveBeenCalled();
		});
	});

	describe("removeBookFromReadingListFn", () => {
		/**
		 * Steps:
		 *   1. requireAuth()
		 *   2. assertUserCanAccessBook()
		 *   3. db.query.readingLists.findFirst() — ownership
		 *   4. db.delete().where()
		 */
		test("removes book from reading list after access and ownership checks", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "My List",
				userId: "user-1",
			});
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { removeBookFromReadingListFn } = await import(
				"src/server/reading-lists"
			);
			const result = await removeBookFromReadingListFn({
				data: { readingListId: 1, bookId: 10 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(readingListsFindFirst).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("throws when user cannot access book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { removeBookFromReadingListFn } = await import(
				"src/server/reading-lists"
			);

			await expect(
				removeBookFromReadingListFn({ data: { readingListId: 1, bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});

		test("throws when reading list not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			readingListsFindFirst.mockResolvedValueOnce(null);

			const { removeBookFromReadingListFn } = await import(
				"src/server/reading-lists"
			);

			await expect(
				removeBookFromReadingListFn({
					data: { readingListId: 999, bookId: 10 },
				}),
			).rejects.toThrow("Reading list not found");
		});
	});

	describe("reorderReadingListFn", () => {
		/**
		 * Steps:
		 *   1. requireAuth()
		 *   2. Promise.all(assertUserCanAccessBook for each bookId)
		 *   3. db.query.readingLists.findFirst() — ownership
		 *   4. Promise.all(db.update().set().where() for each bookId with index as sortOrder)
		 */
		test("reorders books with parallel access verification and bulk sortOrder update", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValue(undefined);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "My List",
				userId: "user-1",
			});
			dbUpdateWhereMock.mockResolvedValue(undefined);

			const { reorderReadingListFn } = await import("src/server/reading-lists");
			const result = await reorderReadingListFn({
				data: { readingListId: 1, bookIds: [30, 10, 20] },
			});

			expect(requireAuth).toHaveBeenCalled();
			// Verify access checked for each book
			expect(assertUserCanAccessBook).toHaveBeenCalledTimes(3);
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				30,
				"user",
			);
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				20,
				"user",
			);
			expect(readingListsFindFirst).toHaveBeenCalled();
			// Each book gets a sortOrder update (index-based)
			expect(dbUpdateMock).toHaveBeenCalledTimes(3);
			expect(dbUpdateSetMock).toHaveBeenCalledWith({ sortOrder: 0 });
			expect(dbUpdateSetMock).toHaveBeenCalledWith({ sortOrder: 1 });
			expect(dbUpdateSetMock).toHaveBeenCalledWith({ sortOrder: 2 });
			expect(result).toEqual({ success: true });
		});

		test("throws when any book access check fails", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			const { reorderReadingListFn } = await import("src/server/reading-lists");

			await expect(
				reorderReadingListFn({
					data: { readingListId: 1, bookIds: [10, 20, 30] },
				}),
			).rejects.toThrow("Forbidden");
		});

		test("throws when reading list not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValue(undefined);
			readingListsFindFirst.mockResolvedValueOnce(null);

			const { reorderReadingListFn } = await import("src/server/reading-lists");

			await expect(
				reorderReadingListFn({
					data: { readingListId: 999, bookIds: [10, 20] },
				}),
			).rejects.toThrow("Reading list not found");
		});

		test("handles empty bookIds array", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			readingListsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "My List",
				userId: "user-1",
			});

			const { reorderReadingListFn } = await import("src/server/reading-lists");
			const result = await reorderReadingListFn({
				data: { readingListId: 1, bookIds: [] },
			});

			expect(assertUserCanAccessBook).not.toHaveBeenCalled();
			expect(dbUpdateMock).not.toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});
	});
});
