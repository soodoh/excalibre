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

const collectionsFindFirst = vi.fn();

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
	count: vi.fn(() => "count_expr"),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		insert: dbInsertMock,
		update: dbUpdateMock,
		delete: dbDeleteMock,
		query: {
			collections: { findFirst: collectionsFindFirst },
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

describe("collections server functions", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectLeftJoinMock.mockReturnValue(selectChain);
		dbSelectGroupByMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);

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

	describe("getCollectionsFn", () => {
		/**
		 * Query chain: db.select().from().leftJoin().where().groupBy()
		 */
		test("calls requireAuth and returns collections with book counts", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const mockCollections = [
				{
					id: 1,
					name: "Favorites",
					userId: "user-1",
					coverImage: null,
					createdAt: new Date(),
					bookCount: 3,
				},
				{
					id: 2,
					name: "To Read",
					userId: "user-1",
					coverImage: null,
					createdAt: new Date(),
					bookCount: 0,
				},
			];
			dbSelectGroupByMock.mockResolvedValueOnce(mockCollections);

			const { getCollectionsFn } = await import("src/server/collections");
			const result = await getCollectionsFn();

			expect(requireAuth).toHaveBeenCalled();
			expect(dbSelectMock).toHaveBeenCalled();
			expect(result).toEqual(mockCollections);
		});

		test("returns empty array when user has no collections", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbSelectGroupByMock.mockResolvedValueOnce([]);

			const { getCollectionsFn } = await import("src/server/collections");
			const result = await getCollectionsFn();

			expect(result).toEqual([]);
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { getCollectionsFn } = await import("src/server/collections");

			await expect(getCollectionsFn()).rejects.toThrow("Not authenticated");
		});
	});

	describe("getCollectionBooksFn", () => {
		/**
		 * Query chain:
		 *   1. db.query.collections.findFirst() — ownership check
		 *   2. getAccessibleLibraryIds() — library filtering
		 *   3. db.select().from().innerJoin().where() — book query
		 */
		test("returns books in collection filtered by accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);
			collectionsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
			});

			const mockBooks = [
				{ id: 10, title: "Book A", libraryId: 1 },
				{ id: 20, title: "Book B", libraryId: 2 },
			];
			dbSelectWhereMock.mockResolvedValueOnce(mockBooks);

			const { getCollectionBooksFn } = await import("src/server/collections");
			const result = await getCollectionBooksFn({ data: { collectionId: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
			expect(collectionsFindFirst).toHaveBeenCalled();
			expect(result).toEqual(mockBooks);
		});

		test("throws when collection not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			collectionsFindFirst.mockResolvedValueOnce(null);

			const { getCollectionBooksFn } = await import("src/server/collections");

			await expect(
				getCollectionBooksFn({ data: { collectionId: 999 } }),
			).rejects.toThrow("Collection not found");
		});

		test("returns empty array when user has no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);
			collectionsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
			});

			const { getCollectionBooksFn } = await import("src/server/collections");
			const result = await getCollectionBooksFn({ data: { collectionId: 1 } });

			expect(result).toEqual([]);
		});
	});

	describe("createCollectionFn", () => {
		/**
		 * Query chain: db.insert().values().returning()
		 */
		test("creates collection with user assignment", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const mockCollection = {
				id: 1,
				name: "New Collection",
				userId: "user-1",
				coverImage: null,
				createdAt: new Date(),
			};
			dbInsertReturningMock.mockResolvedValueOnce([mockCollection]);

			const { createCollectionFn } = await import("src/server/collections");
			const result = await createCollectionFn({
				data: { name: "New Collection" },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(dbInsertValuesMock).toHaveBeenCalledWith({
				name: "New Collection",
				userId: "user-1",
			});
			expect(result).toEqual(mockCollection);
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { createCollectionFn } = await import("src/server/collections");

			await expect(
				createCollectionFn({ data: { name: "Test" } }),
			).rejects.toThrow("Not authenticated");
		});
	});

	describe("updateCollectionFn", () => {
		/**
		 * Query chain: db.update().set().where().returning()
		 */
		test("updates collection name with ownership check", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const updated = {
				id: 1,
				name: "Renamed",
				userId: "user-1",
				coverImage: null,
				createdAt: new Date(),
			};
			dbUpdateReturningMock.mockResolvedValueOnce([updated]);

			const { updateCollectionFn } = await import("src/server/collections");
			const result = await updateCollectionFn({
				data: { id: 1, name: "Renamed" },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(dbUpdateSetMock).toHaveBeenCalledWith({ name: "Renamed" });
			expect(result).toEqual(updated);
		});

		test("updates collection coverImage", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const updated = {
				id: 1,
				name: "My Collection",
				userId: "user-1",
				coverImage: "/covers/new.jpg",
				createdAt: new Date(),
			};
			dbUpdateReturningMock.mockResolvedValueOnce([updated]);

			const { updateCollectionFn } = await import("src/server/collections");
			const result = await updateCollectionFn({
				data: { id: 1, coverImage: "/covers/new.jpg" },
			});

			expect(dbUpdateSetMock).toHaveBeenCalledWith({
				coverImage: "/covers/new.jpg",
			});
			expect(result).toEqual(updated);
		});

		test("throws when collection not found (different user)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbUpdateReturningMock.mockResolvedValueOnce([]);

			const { updateCollectionFn } = await import("src/server/collections");

			await expect(
				updateCollectionFn({ data: { id: 999, name: "Nope" } }),
			).rejects.toThrow("Collection not found");
		});
	});

	describe("deleteCollectionFn", () => {
		/**
		 * Query chain: db.delete().where()
		 */
		test("deletes collection with ownership check and returns success", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { deleteCollectionFn } = await import("src/server/collections");
			const result = await deleteCollectionFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { deleteCollectionFn } = await import("src/server/collections");

			await expect(deleteCollectionFn({ data: { id: 1 } })).rejects.toThrow(
				"Not authenticated",
			);
		});
	});

	describe("addBookToCollectionFn", () => {
		/**
		 * Steps:
		 *   1. requireAuth()
		 *   2. assertUserCanAccessBook()
		 *   3. db.query.collections.findFirst() — ownership
		 *   4. db.insert().values().onConflictDoNothing()
		 */
		test("adds book to collection after access and ownership checks", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			collectionsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
			});
			dbInsertOnConflictDoNothingMock.mockResolvedValueOnce(undefined);

			const { addBookToCollectionFn } = await import("src/server/collections");
			const result = await addBookToCollectionFn({
				data: { collectionId: 1, bookId: 10 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(collectionsFindFirst).toHaveBeenCalled();
			expect(dbInsertValuesMock).toHaveBeenCalledWith({
				collectionId: 1,
				bookId: 10,
			});
			expect(result).toEqual({ success: true });
		});

		test("throws when user cannot access book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { addBookToCollectionFn } = await import("src/server/collections");

			await expect(
				addBookToCollectionFn({ data: { collectionId: 1, bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});

		test("throws when collection not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			collectionsFindFirst.mockResolvedValueOnce(null);

			const { addBookToCollectionFn } = await import("src/server/collections");

			await expect(
				addBookToCollectionFn({ data: { collectionId: 999, bookId: 10 } }),
			).rejects.toThrow("Collection not found");
		});

		test("uses onConflictDoNothing for duplicate book-collection pair", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			collectionsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
			});
			dbInsertOnConflictDoNothingMock.mockResolvedValueOnce(undefined);

			const { addBookToCollectionFn } = await import("src/server/collections");
			await addBookToCollectionFn({ data: { collectionId: 1, bookId: 10 } });

			expect(dbInsertOnConflictDoNothingMock).toHaveBeenCalled();
		});
	});

	describe("removeBookFromCollectionFn", () => {
		/**
		 * Steps:
		 *   1. requireAuth()
		 *   2. assertUserCanAccessBook()
		 *   3. db.query.collections.findFirst() — ownership
		 *   4. db.delete().where()
		 */
		test("removes book from collection after access and ownership checks", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			collectionsFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
			});
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { removeBookFromCollectionFn } = await import(
				"src/server/collections"
			);
			const result = await removeBookFromCollectionFn({
				data: { collectionId: 1, bookId: 10 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(collectionsFindFirst).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("throws when user cannot access book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { removeBookFromCollectionFn } = await import(
				"src/server/collections"
			);

			await expect(
				removeBookFromCollectionFn({ data: { collectionId: 1, bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});

		test("throws when collection not found (ownership check)", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			collectionsFindFirst.mockResolvedValueOnce(null);

			const { removeBookFromCollectionFn } = await import(
				"src/server/collections"
			);

			await expect(
				removeBookFromCollectionFn({ data: { collectionId: 999, bookId: 10 } }),
			).rejects.toThrow("Collection not found");
		});
	});
});
