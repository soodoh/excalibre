import { beforeEach, describe, expect, test, vi } from "vitest";

const mockGetSession = vi.fn();
const mockGetRequest = vi.fn();
const mockUserFindFirst = vi.fn();
const mockAssertUserCanAccessLibrary = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
	}),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: mockGetRequest,
}));

vi.mock("src/lib/auth", () => ({
	auth: {
		api: {
			getSession: mockGetSession,
		},
	},
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			user: { findFirst: mockUserFindFirst },
		},
	},
}));

vi.mock("src/db/schema", () => ({
	user: { id: "user.id", role: "user.role" },
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessLibrary: mockAssertUserCanAccessLibrary,
}));

describe("middleware", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getAuthSessionFn", () => {
		test("returns null when no session exists", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue(null);

			const { getAuthSessionFn } = await import("src/server/middleware");

			const result = await getAuthSessionFn();
			expect(result).toBeNull();
		});

		test("returns session augmented with user role from DB", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers({ cookie: "session=abc" }),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Test User", email: "test@example.com" },
				session: { token: "abc" },
			});
			mockUserFindFirst.mockResolvedValue({ role: "admin" });

			const { getAuthSessionFn } = await import("src/server/middleware");

			const result = await getAuthSessionFn();

			expect(result).toEqual({
				user: {
					id: "user-1",
					name: "Test User",
					email: "test@example.com",
					role: "admin",
				},
				session: { token: "abc" },
			});
		});

		test("defaults role to 'user' when user record not found in DB", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "user-2", name: "Ghost" },
				session: { token: "xyz" },
			});
			mockUserFindFirst.mockResolvedValue(undefined);

			const { getAuthSessionFn } = await import("src/server/middleware");

			const result = await getAuthSessionFn();

			expect(result?.user.role).toBe("user");
		});
	});

	describe("requireAuth", () => {
		test("returns session when authenticated", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Test" },
				session: { token: "abc" },
			});
			mockUserFindFirst.mockResolvedValue({ role: "user" });

			const { requireAuth } = await import("src/server/middleware");

			const result = await requireAuth();
			expect(result.user.id).toBe("user-1");
		});

		test("throws UnauthorizedError when no session", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue(null);

			const { requireAuth } = await import("src/server/middleware");

			await expect(requireAuth()).rejects.toThrow("Unauthorized");
		});
	});

	describe("requireAdmin", () => {
		test("returns session when user is admin", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "admin-1", name: "Admin" },
				session: { token: "abc" },
			});
			mockUserFindFirst.mockResolvedValue({ role: "admin" });

			const { requireAdmin } = await import("src/server/middleware");

			const result = await requireAdmin();
			expect(result.user.role).toBe("admin");
		});

		test("throws ForbiddenError when user is not admin", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Regular" },
				session: { token: "abc" },
			});
			mockUserFindFirst.mockResolvedValue({ role: "user" });

			const { requireAdmin } = await import("src/server/middleware");

			await expect(requireAdmin()).rejects.toThrow(
				"Forbidden: admin access required",
			);
		});

		test("throws UnauthorizedError when no session", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue(null);

			const { requireAdmin } = await import("src/server/middleware");

			await expect(requireAdmin()).rejects.toThrow("Unauthorized");
		});
	});

	describe("requireLibraryAccess", () => {
		test("returns session when user has library access", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Test" },
				session: { token: "abc" },
			});
			mockUserFindFirst.mockResolvedValue({ role: "user" });
			mockAssertUserCanAccessLibrary.mockResolvedValue(undefined);

			const { requireLibraryAccess } = await import("src/server/middleware");

			const result = await requireLibraryAccess(5);
			expect(result.user.id).toBe("user-1");
			expect(mockAssertUserCanAccessLibrary).toHaveBeenCalledWith(
				"user-1",
				5,
				"user",
			);
		});

		test("propagates error from assertUserCanAccessLibrary", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Test" },
				session: { token: "abc" },
			});
			mockUserFindFirst.mockResolvedValue({ role: "user" });
			mockAssertUserCanAccessLibrary.mockRejectedValue(
				new Error("Forbidden: no access to this library"),
			);

			const { requireLibraryAccess } = await import("src/server/middleware");

			await expect(requireLibraryAccess(99)).rejects.toThrow(
				"Forbidden: no access to this library",
			);
		});

		test("throws UnauthorizedError when no session", async () => {
			mockGetRequest.mockReturnValue({
				headers: new Headers(),
			});
			mockGetSession.mockResolvedValue(null);

			const { requireLibraryAccess } = await import("src/server/middleware");

			await expect(requireLibraryAccess(1)).rejects.toThrow("Unauthorized");
		});
	});
});
