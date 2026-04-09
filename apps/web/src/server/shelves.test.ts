import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const assertUserCanAccessBook = vi.fn();
const getAccessibleLibraryIds = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();
const dbSelectOrderByMock = vi.fn();
const dbSelectInnerJoinMock = vi.fn();

const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();
const dbInsertOnConflictMock = vi.fn();

const dbUpdateMock = vi.fn();
const dbUpdateSetMock = vi.fn();
const dbUpdateWhereMock = vi.fn();
const dbUpdateReturningMock = vi.fn();

const dbDeleteMock = vi.fn();
const dbDeleteWhereMock = vi.fn();

const shelvesFindFirst = vi.fn();

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
	asc: vi.fn((col: unknown) => ({ asc: col })),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	exists: vi.fn((subquery: unknown) => ({ exists: subquery })),
	gt: vi.fn((field: unknown, value: unknown) => ({ gt: field, value })),
	inArray: vi.fn((field: unknown, values: unknown) => ({ field, values })),
	like: vi.fn((field: unknown, pattern: unknown) => ({ field, pattern })),
	lt: vi.fn((field: unknown, value: unknown) => ({ lt: field, value })),
	or: vi.fn((...clauses: unknown[]) => ({ or: clauses })),
}));

vi.mock("src/db", () => ({
	db: {
		select: dbSelectMock,
		insert: dbInsertMock,
		update: dbUpdateMock,
		delete: dbDeleteMock,
		query: {
			shelves: { findFirst: shelvesFindFirst },
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
	orderBy: dbSelectOrderByMock,
	innerJoin: dbSelectInnerJoinMock,
};

const insertChain = {
	values: dbInsertValuesMock,
	returning: dbInsertReturningMock,
	onConflictDoNothing: dbInsertOnConflictMock,
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

describe("shelves server functions", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		// select chain
		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);
		dbSelectOrderByMock.mockReturnValue(selectChain);
		dbSelectInnerJoinMock.mockReturnValue(selectChain);

		// insert chain
		dbInsertMock.mockReturnValue(insertChain);
		dbInsertValuesMock.mockReturnValue(insertChain);
		dbInsertReturningMock.mockReturnValue(insertChain);
		dbInsertOnConflictMock.mockReturnValue(insertChain);

		// update chain
		dbUpdateMock.mockReturnValue(updateChain);
		dbUpdateSetMock.mockReturnValue(updateChain);
		dbUpdateWhereMock.mockReturnValue(updateChain);
		dbUpdateReturningMock.mockReturnValue(updateChain);

		// delete chain
		dbDeleteMock.mockReturnValue(deleteChain);
		dbDeleteWhereMock.mockReturnValue(deleteChain);
	});

	// ─── getShelvesFn ────────────────────────────────────────────────────

	describe("getShelvesFn", () => {
		test("returns shelves for the current user, ordered by sortOrder", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const mockShelves = [
				{ id: 1, name: "Favorites", userId: "user-1", sortOrder: 0 },
				{ id: 2, name: "To Read", userId: "user-1", sortOrder: 1 },
			];
			dbSelectOrderByMock.mockResolvedValueOnce(mockShelves);

			const { getShelvesFn } = await import("src/server/shelves");
			const result = await getShelvesFn({} as never);

			expect(requireAuth).toHaveBeenCalled();
			expect(dbSelectMock).toHaveBeenCalled();
			expect(result).toEqual(mockShelves);
		});

		test("returns empty array when user has no shelves", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbSelectOrderByMock.mockResolvedValueOnce([]);

			const { getShelvesFn } = await import("src/server/shelves");
			const result = await getShelvesFn({} as never);

			expect(result).toEqual([]);
		});
	});

	// ─── getShelfFn ──────────────────────────────────────────────────────

	describe("getShelfFn", () => {
		test("returns the shelf when it belongs to the user", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const shelf = { id: 1, name: "Favorites", userId: "user-1" };
			shelvesFindFirst.mockResolvedValueOnce(shelf);

			const { getShelfFn } = await import("src/server/shelves");
			const result = await getShelfFn({ data: { shelfId: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(shelvesFindFirst).toHaveBeenCalled();
			expect(result).toEqual(shelf);
		});

		test("throws when shelf is not found or not owned by user", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce(null);

			const { getShelfFn } = await import("src/server/shelves");

			await expect(getShelfFn({ data: { shelfId: 999 } })).rejects.toThrow(
				"Shelf not found",
			);
		});
	});

	// ─── getShelfBooksFn ─────────────────────────────────────────────────

	describe("getShelfBooksFn", () => {
		test("returns books for a manual shelf via shelvesBooks join", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const manualShelf = {
				id: 1,
				name: "Favorites",
				userId: "user-1",
				type: "manual",
				filterRules: null,
			};
			shelvesFindFirst.mockResolvedValueOnce(manualShelf);
			getAccessibleLibraryIds.mockResolvedValueOnce([1, 2]);

			const mockBooks = [
				{ id: 10, title: "Book A", libraryId: 1 },
				{ id: 20, title: "Book B", libraryId: 2 },
			];
			dbSelectWhereMock.mockResolvedValueOnce(mockBooks);

			const { getShelfBooksFn } = await import("src/server/shelves");
			const result = await getShelfBooksFn({ data: { shelfId: 1 } });

			expect(shelvesFindFirst).toHaveBeenCalled();
			expect(getAccessibleLibraryIds).toHaveBeenCalledWith("user-1", "user");
			expect(result).toEqual(mockBooks);
		});

		test("returns empty array for manual shelf when no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const manualShelf = {
				id: 1,
				name: "Favorites",
				userId: "user-1",
				type: "manual",
				filterRules: null,
			};
			shelvesFindFirst.mockResolvedValueOnce(manualShelf);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			const result = await getShelfBooksFn({ data: { shelfId: 1 } });

			expect(result).toEqual([]);
		});

		test("evaluates smart shelf filter rules when type is smart", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const smartShelf = {
				id: 2,
				name: "Sci-Fi",
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "title", op: "contains", value: "Dune" }],
				},
			};
			shelvesFindFirst.mockResolvedValueOnce(smartShelf);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);

			const smartBooks = [{ id: 5, title: "Dune", libraryId: 1 }];
			dbSelectWhereMock.mockResolvedValueOnce(smartBooks);

			const { getShelfBooksFn } = await import("src/server/shelves");
			const result = await getShelfBooksFn({ data: { shelfId: 2 } });

			expect(result).toEqual(smartBooks);
		});

		test("returns empty array for smart shelf when no accessible libraries", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const smartShelf = {
				id: 2,
				name: "Smart Empty",
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "title", op: "contains", value: "X" }],
				},
			};
			shelvesFindFirst.mockResolvedValueOnce(smartShelf);
			getAccessibleLibraryIds.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			const result = await getShelfBooksFn({ data: { shelfId: 2 } });

			expect(result).toEqual([]);
		});

		test("returns all accessible books for smart shelf with no conditions", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const smartShelf = {
				id: 3,
				name: "All Books",
				userId: "user-1",
				type: "smart",
				filterRules: { operator: "and", conditions: [] },
			};
			shelvesFindFirst.mockResolvedValueOnce(smartShelf);
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);

			const allBooks = [
				{ id: 1, title: "Book 1", libraryId: 1 },
				{ id: 2, title: "Book 2", libraryId: 1 },
			];
			dbSelectWhereMock.mockResolvedValueOnce(allBooks);

			const { getShelfBooksFn } = await import("src/server/shelves");
			const result = await getShelfBooksFn({ data: { shelfId: 3 } });

			expect(result).toEqual(allBooks);
		});

		test("throws when shelf is not found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce(null);

			const { getShelfBooksFn } = await import("src/server/shelves");

			await expect(getShelfBooksFn({ data: { shelfId: 999 } })).rejects.toThrow(
				"Shelf not found",
			);
		});
	});

	// ─── createShelfFn ───────────────────────────────────────────────────

	describe("createShelfFn", () => {
		test("creates a manual shelf and returns it", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const newShelf = {
				id: 1,
				name: "My Shelf",
				type: "manual",
				userId: "user-1",
			};
			dbInsertReturningMock.mockResolvedValueOnce([newShelf]);

			const { createShelfFn } = await import("src/server/shelves");
			const result = await createShelfFn({
				data: { name: "My Shelf", type: "manual" },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(result).toEqual(newShelf);
		});

		test("creates a smart shelf with filter rules", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const filterRules = {
				operator: "and",
				conditions: [{ field: "title", op: "contains", value: "Sci" }],
			};
			const newShelf = {
				id: 2,
				name: "Smart Shelf",
				type: "smart",
				filterRules,
				userId: "user-1",
			};
			dbInsertReturningMock.mockResolvedValueOnce([newShelf]);

			const { createShelfFn } = await import("src/server/shelves");
			const result = await createShelfFn({
				data: { name: "Smart Shelf", type: "smart", filterRules },
			});

			expect(result).toEqual(newShelf);
		});
	});

	// ─── updateShelfFn ───────────────────────────────────────────────────

	describe("updateShelfFn", () => {
		test("updates shelf name and returns updated shelf", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const updated = {
				id: 1,
				name: "Renamed",
				userId: "user-1",
				sortOrder: 0,
			};
			dbUpdateReturningMock.mockResolvedValueOnce([updated]);

			const { updateShelfFn } = await import("src/server/shelves");
			const result = await updateShelfFn({
				data: { id: 1, name: "Renamed" },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(dbUpdateMock).toHaveBeenCalled();
			expect(result).toEqual(updated);
		});

		test("updates sortOrder", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			const updated = {
				id: 1,
				name: "Shelf",
				userId: "user-1",
				sortOrder: 5,
			};
			dbUpdateReturningMock.mockResolvedValueOnce([updated]);

			const { updateShelfFn } = await import("src/server/shelves");
			const result = await updateShelfFn({
				data: { id: 1, sortOrder: 5 },
			});

			expect(result).toEqual(updated);
		});

		test("throws when shelf is not found or not owned by user", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbUpdateReturningMock.mockResolvedValueOnce([]);

			const { updateShelfFn } = await import("src/server/shelves");

			await expect(
				updateShelfFn({ data: { id: 999, name: "Nope" } }),
			).rejects.toThrow("Shelf not found");
		});
	});

	// ─── deleteShelfFn ───────────────────────────────────────────────────

	describe("deleteShelfFn", () => {
		test("deletes shelf and returns success", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { deleteShelfFn } = await import("src/server/shelves");
			const result = await deleteShelfFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});
	});

	// ─── addBookToShelfFn ────────────────────────────────────────────────

	describe("addBookToShelfFn", () => {
		test("adds book to a manual shelf", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
				type: "manual",
			});
			dbInsertOnConflictMock.mockResolvedValueOnce(undefined);

			const { addBookToShelfFn } = await import("src/server/shelves");
			const result = await addBookToShelfFn({
				data: { shelfId: 1, bookId: 10 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(shelvesFindFirst).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("throws when shelf is not found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			shelvesFindFirst.mockResolvedValueOnce(null);

			const { addBookToShelfFn } = await import("src/server/shelves");

			await expect(
				addBookToShelfFn({ data: { shelfId: 999, bookId: 10 } }),
			).rejects.toThrow("Shelf not found");
		});

		test("throws when adding to a smart shelf", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 2,
				name: "Smart Shelf",
				userId: "user-1",
				type: "smart",
			});

			const { addBookToShelfFn } = await import("src/server/shelves");

			await expect(
				addBookToShelfFn({ data: { shelfId: 2, bookId: 10 } }),
			).rejects.toThrow("Cannot manually add books to a smart shelf");
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { addBookToShelfFn } = await import("src/server/shelves");

			await expect(
				addBookToShelfFn({ data: { shelfId: 1, bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});
	});

	// ─── removeBookFromShelfFn ───────────────────────────────────────────

	describe("removeBookFromShelfFn", () => {
		test("removes book from shelf", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				name: "Favorites",
				userId: "user-1",
				type: "manual",
			});
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { removeBookFromShelfFn } = await import("src/server/shelves");
			const result = await removeBookFromShelfFn({
				data: { shelfId: 1, bookId: 10 },
			});

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(shelvesFindFirst).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("throws when shelf is not found", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);
			shelvesFindFirst.mockResolvedValueOnce(null);

			const { removeBookFromShelfFn } = await import("src/server/shelves");

			await expect(
				removeBookFromShelfFn({ data: { shelfId: 999, bookId: 10 } }),
			).rejects.toThrow("Shelf not found");
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { removeBookFromShelfFn } = await import("src/server/shelves");

			await expect(
				removeBookFromShelfFn({ data: { shelfId: 1, bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});
	});

	// ─── getBookMembershipFn ─────────────────────────────────────────────

	describe("getBookMembershipFn", () => {
		test("returns shelf, collection, and reading list IDs for a book", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			// The function calls Promise.all with 3 queries that each end with where()
			// shelf query: select -> from -> innerJoin -> where
			dbSelectWhereMock.mockResolvedValueOnce([{ shelfId: 1 }, { shelfId: 3 }]);
			// collection query: select -> from -> innerJoin -> where
			dbSelectWhereMock.mockResolvedValueOnce([{ collectionId: 5 }]);
			// reading list query: select -> from -> innerJoin -> where
			dbSelectWhereMock.mockResolvedValueOnce([{ readingListId: 7 }]);

			const { getBookMembershipFn } = await import("src/server/shelves");
			const result = await getBookMembershipFn({ data: { bookId: 10 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessBook).toHaveBeenCalledWith(
				"user-1",
				10,
				"user",
			);
			expect(result).toEqual({
				shelfIds: [1, 3],
				collectionIds: [5],
				readingListIds: [7],
			});
		});

		test("returns empty arrays when book has no memberships", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockResolvedValueOnce(undefined);

			dbSelectWhereMock.mockResolvedValueOnce([]);
			dbSelectWhereMock.mockResolvedValueOnce([]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getBookMembershipFn } = await import("src/server/shelves");
			const result = await getBookMembershipFn({ data: { bookId: 10 } });

			expect(result).toEqual({
				shelfIds: [],
				collectionIds: [],
				readingListIds: [],
			});
		});

		test("propagates error from assertUserCanAccessBook", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			assertUserCanAccessBook.mockRejectedValueOnce(new Error("Forbidden"));

			const { getBookMembershipFn } = await import("src/server/shelves");

			await expect(
				getBookMembershipFn({ data: { bookId: 10 } }),
			).rejects.toThrow("Forbidden");
		});
	});

	// ─── buildFilterCondition (tested via evaluateSmartShelf) ────────────

	describe("smart shelf filter logic (via getShelfBooksFn)", () => {
		test("builds title 'contains' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "title", op: "contains", value: "Dune" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			// The like mock was called with the contains pattern
			const { like } = await import("drizzle-orm");
			expect(like).toHaveBeenCalledWith(expect.anything(), "%Dune%");
		});

		test("builds title 'equals' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "title", op: "equals", value: "Dune" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { eq } = await import("drizzle-orm");
			expect(eq).toHaveBeenCalledWith(expect.anything(), "Dune");
		});

		test("builds title 'startsWith' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "title", op: "startsWith", value: "The" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { like } = await import("drizzle-orm");
			expect(like).toHaveBeenCalledWith(expect.anything(), "The%");
		});

		test("builds rating 'greaterThan' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "rating", op: "greaterThan", value: 4 }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { gt } = await import("drizzle-orm");
			expect(gt).toHaveBeenCalledWith(expect.anything(), 4);
		});

		test("builds rating 'lessThan' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "rating", op: "lessThan", value: 3 }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { lt } = await import("drizzle-orm");
			expect(lt).toHaveBeenCalledWith(expect.anything(), 3);
		});

		test("builds rating 'equals' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "rating", op: "equals", value: 5 }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { eq } = await import("drizzle-orm");
			expect(eq).toHaveBeenCalledWith(expect.anything(), 5);
		});

		test("builds language 'equals' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "language", op: "equals", value: "en" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { eq } = await import("drizzle-orm");
			expect(eq).toHaveBeenCalledWith(expect.anything(), "en");
		});

		test("builds language 'contains' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "language", op: "contains", value: "en" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { like } = await import("drizzle-orm");
			expect(like).toHaveBeenCalledWith(expect.anything(), "%en%");
		});

		test("builds publisher 'contains' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [
						{ field: "publisher", op: "contains", value: "Penguin" },
					],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { like } = await import("drizzle-orm");
			expect(like).toHaveBeenCalledWith(expect.anything(), "%Penguin%");
		});

		test("builds publisher 'equals' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "publisher", op: "equals", value: "Penguin" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { eq } = await import("drizzle-orm");
			expect(eq).toHaveBeenCalledWith(expect.anything(), "Penguin");
		});

		test("builds publisher 'startsWith' filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "publisher", op: "startsWith", value: "Pen" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { like } = await import("drizzle-orm");
			expect(like).toHaveBeenCalledWith(expect.anything(), "Pen%");
		});

		test("builds tag filter with exists subquery", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "tag", op: "contains", value: "fiction" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { exists } = await import("drizzle-orm");
			expect(exists).toHaveBeenCalled();
		});

		test("builds author filter with exists subquery", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [{ field: "author", op: "equals", value: "Tolkien" }],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { exists } = await import("drizzle-orm");
			expect(exists).toHaveBeenCalled();
		});

		test("uses OR logic when operator is 'or'", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "or",
					conditions: [
						{ field: "title", op: "contains", value: "Dune" },
						{ field: "title", op: "contains", value: "Ring" },
					],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { or } = await import("drizzle-orm");
			expect(or).toHaveBeenCalled();
		});

		test("uses AND logic when operator is 'and' with multiple conditions", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [
						{ field: "title", op: "contains", value: "Dune" },
						{ field: "rating", op: "greaterThan", value: 3 },
					],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			const { and, or } = await import("drizzle-orm");
			expect(and).toHaveBeenCalled();
			// or should not be called for AND logic
			// (and is called for the library condition combo, but or should not be)
			expect(or).not.toHaveBeenCalled();
		});

		test("skips unsupported field gracefully and applies only library filter", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [
						// 'hasProgress' is in the type but returns undefined from buildFilterCondition
						{ field: "hasProgress", op: "exists", value: true },
					],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			// Should not throw — unsupported fields are filtered out
			await getShelfBooksFn({ data: { shelfId: 1 } });

			// Query should still be executed (with just library filter)
			expect(dbSelectWhereMock).toHaveBeenCalled();
		});

		test("skips unsupported op for a known field", async () => {
			requireAuth.mockResolvedValueOnce(mockSession);
			shelvesFindFirst.mockResolvedValueOnce({
				id: 1,
				userId: "user-1",
				type: "smart",
				filterRules: {
					operator: "and",
					conditions: [
						// 'title' with 'greaterThan' is not handled
						{ field: "title", op: "greaterThan", value: 5 },
					],
				},
			});
			getAccessibleLibraryIds.mockResolvedValueOnce([1]);
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getShelfBooksFn } = await import("src/server/shelves");
			await getShelfBooksFn({ data: { shelfId: 1 } });

			expect(dbSelectWhereMock).toHaveBeenCalled();
		});
	});
});
