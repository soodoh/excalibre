import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAuth = vi.fn();
const requireAdmin = vi.fn();
const assertUserCanAccessLibrary = vi.fn();

const dbSelectMock = vi.fn();
const dbSelectFromMock = vi.fn();
const dbSelectWhereMock = vi.fn();

const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();

const dbUpdateMock = vi.fn();
const dbUpdateSetMock = vi.fn();
const dbUpdateWhereMock = vi.fn();
const dbUpdateReturningMock = vi.fn();

const dbDeleteMock = vi.fn();
const dbDeleteWhereMock = vi.fn();

const librariesFindFirst = vi.fn();

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
			libraries: { findFirst: librariesFindFirst },
		},
	},
}));

vi.mock("src/server/middleware", () => ({
	requireAuth,
	requireAdmin,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessLibrary,
}));

vi.mock("src/lib/validators", () => ({
	createLibrarySchema: {
		parse: (raw: unknown) => raw,
	},
	updateLibrarySchema: {
		parse: (raw: unknown) => raw,
	},
}));

const selectChain = {
	from: dbSelectFromMock,
	where: dbSelectWhereMock,
};

const insertChain = {
	values: dbInsertValuesMock,
	returning: dbInsertReturningMock,
};

const updateChain = {
	set: dbUpdateSetMock,
	where: dbUpdateWhereMock,
	returning: dbUpdateReturningMock,
};

const deleteChain = {
	where: dbDeleteWhereMock,
};

describe("libraries server functions", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		dbSelectMock.mockReturnValue(selectChain);
		dbSelectFromMock.mockReturnValue(selectChain);
		dbSelectWhereMock.mockReturnValue(selectChain);

		dbInsertMock.mockReturnValue(insertChain);
		dbInsertValuesMock.mockReturnValue(insertChain);
		dbInsertReturningMock.mockReturnValue(insertChain);

		dbUpdateMock.mockReturnValue(updateChain);
		dbUpdateSetMock.mockReturnValue(updateChain);
		dbUpdateWhereMock.mockReturnValue(updateChain);
		dbUpdateReturningMock.mockReturnValue(updateChain);

		dbDeleteMock.mockReturnValue(deleteChain);
		dbDeleteWhereMock.mockReturnValue(deleteChain);
	});

	describe("getLibrariesFn", () => {
		test("returns all libraries for admin users", async () => {
			const adminSession = { user: { id: "admin-1", role: "admin" } };
			requireAuth.mockResolvedValueOnce(adminSession);
			const mockLibraries = [
				{ id: 1, name: "Library A" },
				{ id: 2, name: "Library B" },
			];
			dbSelectFromMock.mockResolvedValueOnce(mockLibraries);

			const { getLibrariesFn } = await import("src/server/libraries");
			const result = await getLibrariesFn();

			expect(requireAuth).toHaveBeenCalled();
			expect(result).toEqual(mockLibraries);
		});

		test("returns only accessible libraries for non-admin users", async () => {
			const userSession = { user: { id: "user-1", role: "user" } };
			requireAuth.mockResolvedValueOnce(userSession);

			// First select: libraryAccess query
			dbSelectWhereMock.mockResolvedValueOnce([
				{ libraryId: 1 },
				{ libraryId: 3 },
			]);
			// Second select: libraries filtered by IDs
			const mockLibraries = [
				{ id: 1, name: "Library A" },
				{ id: 3, name: "Library C" },
			];
			dbSelectWhereMock.mockResolvedValueOnce(mockLibraries);

			const { getLibrariesFn } = await import("src/server/libraries");
			const result = await getLibrariesFn();

			expect(result).toEqual(mockLibraries);
		});

		test("returns empty array when non-admin user has no library access", async () => {
			const userSession = { user: { id: "user-1", role: "user" } };
			requireAuth.mockResolvedValueOnce(userSession);

			// libraryAccess returns empty
			dbSelectWhereMock.mockResolvedValueOnce([]);

			const { getLibrariesFn } = await import("src/server/libraries");
			const result = await getLibrariesFn();

			expect(result).toEqual([]);
		});

		test("propagates error from requireAuth", async () => {
			requireAuth.mockRejectedValueOnce(new Error("Not authenticated"));

			const { getLibrariesFn } = await import("src/server/libraries");
			await expect(getLibrariesFn()).rejects.toThrow("Not authenticated");
		});
	});

	describe("getLibraryFn", () => {
		test("returns library when user has access", async () => {
			const session = { user: { id: "user-1", role: "user" } };
			requireAuth.mockResolvedValueOnce(session);
			assertUserCanAccessLibrary.mockResolvedValueOnce(undefined);
			const mockLibrary = { id: 1, name: "Library A" };
			librariesFindFirst.mockResolvedValueOnce(mockLibrary);

			const { getLibraryFn } = await import("src/server/libraries");
			const result = await getLibraryFn({ data: { id: 1 } });

			expect(requireAuth).toHaveBeenCalled();
			expect(assertUserCanAccessLibrary).toHaveBeenCalledWith(
				"user-1",
				1,
				"user",
			);
			expect(result).toEqual(mockLibrary);
		});

		test("throws when library is not found", async () => {
			const session = { user: { id: "user-1", role: "user" } };
			requireAuth.mockResolvedValueOnce(session);
			assertUserCanAccessLibrary.mockResolvedValueOnce(undefined);
			librariesFindFirst.mockResolvedValueOnce(null);

			const { getLibraryFn } = await import("src/server/libraries");
			await expect(getLibraryFn({ data: { id: 999 } })).rejects.toThrow(
				"Library not found",
			);
		});

		test("propagates error from assertUserCanAccessLibrary", async () => {
			const session = { user: { id: "user-1", role: "user" } };
			requireAuth.mockResolvedValueOnce(session);
			assertUserCanAccessLibrary.mockRejectedValueOnce(new Error("Forbidden"));

			const { getLibraryFn } = await import("src/server/libraries");
			await expect(getLibraryFn({ data: { id: 1 } })).rejects.toThrow(
				"Forbidden",
			);
		});
	});

	describe("createLibraryFn", () => {
		test("creates a library as admin", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			const mockLibrary = { id: 1, name: "New Library", type: "book" };
			dbInsertReturningMock.mockResolvedValueOnce([mockLibrary]);

			const { createLibraryFn } = await import("src/server/libraries");
			const result = await createLibraryFn({
				data: {
					name: "New Library",
					type: "book",
					scanPaths: ["books"],
					scanInterval: 30,
				},
			});

			expect(requireAdmin).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(result).toEqual(mockLibrary);
		});

		test("propagates error from requireAdmin", async () => {
			requireAdmin.mockRejectedValueOnce(
				new Error("Forbidden: admin access required"),
			);

			const { createLibraryFn } = await import("src/server/libraries");
			await expect(
				createLibraryFn({
					data: { name: "Test", type: "book", scanPaths: [], scanInterval: 30 },
				}),
			).rejects.toThrow("Forbidden: admin access required");
		});
	});

	describe("updateLibraryFn", () => {
		test("updates a library as admin", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			const updated = { id: 1, name: "Renamed", type: "book" };
			dbUpdateReturningMock.mockResolvedValueOnce([updated]);

			const { updateLibraryFn } = await import("src/server/libraries");
			const result = await updateLibraryFn({
				data: { id: 1, name: "Renamed" },
			});

			expect(requireAdmin).toHaveBeenCalled();
			expect(result).toEqual(updated);
		});

		test("throws when library is not found", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			dbUpdateReturningMock.mockResolvedValueOnce([]);

			const { updateLibraryFn } = await import("src/server/libraries");
			await expect(
				updateLibraryFn({ data: { id: 999, name: "Nope" } }),
			).rejects.toThrow("Library not found");
		});
	});

	describe("deleteLibraryFn", () => {
		test("deletes a library as admin", async () => {
			requireAdmin.mockResolvedValueOnce(undefined);
			dbDeleteWhereMock.mockResolvedValueOnce(undefined);

			const { deleteLibraryFn } = await import("src/server/libraries");
			const result = await deleteLibraryFn({ data: { id: 1 } });

			expect(requireAdmin).toHaveBeenCalled();
			expect(dbDeleteMock).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
		});

		test("propagates error from requireAdmin", async () => {
			requireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

			const { deleteLibraryFn } = await import("src/server/libraries");
			await expect(deleteLibraryFn({ data: { id: 1 } })).rejects.toThrow(
				"Forbidden",
			);
		});
	});
});
