import { hashPassword, verifyPassword } from "better-auth/crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

const eqMock = vi.fn((field: unknown, value: unknown) => ({ field, value }));
const andMock = vi.fn((...clauses: unknown[]) => ({ clauses }));
const userFindFirst = vi.fn();
const accountFindFirst = vi.fn();
const signInEmail = vi.fn();
const fetchMock = vi.fn(() => Promise.reject(new Error("unexpected fetch")));

vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
}));

vi.mock("better-auth/crypto", async (importOriginal) => {
	const actual = await importOriginal<typeof import("better-auth/crypto")>();

	return {
		...actual,
		verifyPassword: vi.fn(actual.verifyPassword),
	};
});

vi.mock("src/db", () => ({
	db: {
		query: {
			user: {
				findFirst: userFindFirst,
			},
			account: {
				findFirst: accountFindFirst,
			},
		},
	},
}));

vi.mock("src/lib/auth", () => ({
	auth: {
		api: {
			signInEmail,
		},
	},
}));

describe("authenticateKosync", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	test("uses stateless password verification for header auth without calling fetch", async () => {
		const passwordHash = await hashPassword("correct-horse");
		userFindFirst.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		accountFindFirst.mockResolvedValueOnce({
			id: "account-1",
			accountId: "user-1",
			providerId: "credential",
			userId: "user-1",
			password: passwordHash,
		});

		const { authenticateKosync } = await import("src/server/kosync");
		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "Reader@Example.com",
				"x-auth-key": "correct-horse",
			},
		});

		await expect(authenticateKosync(request)).resolves.toEqual({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		expect(eqMock).toHaveBeenCalledWith(
			expect.anything(),
			"reader@example.com",
		);
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "user-1");
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "credential");
		expect(signInEmail).not.toHaveBeenCalled();
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: passwordHash,
			password: "correct-horse",
		});
		expect(accountFindFirst).toHaveBeenCalledTimes(1);
		expect(userFindFirst).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("burns password verification work when the user does not exist", async () => {
		const { authenticateKosync, DUMMY_PASSWORD_HASH } = await import(
			"src/server/kosync"
		);
		userFindFirst.mockResolvedValueOnce(null);

		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "Missing@Example.com",
				"x-auth-key": "wrong-password",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: DUMMY_PASSWORD_HASH,
			password: "wrong-password",
		});
		expect(signInEmail).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("burns password verification work when the credential account is missing", async () => {
		const { authenticateKosync, DUMMY_PASSWORD_HASH } = await import(
			"src/server/kosync"
		);
		userFindFirst.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		accountFindFirst.mockResolvedValueOnce(null);

		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "Reader@Example.com",
				"x-auth-key": "wrong-password",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
		expect(eqMock).toHaveBeenCalledWith(
			expect.anything(),
			"reader@example.com",
		);
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "user-1");
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "credential");
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: DUMMY_PASSWORD_HASH,
			password: "wrong-password",
		});
		expect(signInEmail).not.toHaveBeenCalled();
		expect(accountFindFirst).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null for invalid header auth without calling fetch", async () => {
		const passwordHash = await hashPassword("correct-horse");
		userFindFirst.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		accountFindFirst.mockResolvedValueOnce({
			id: "account-1",
			accountId: "user-1",
			providerId: "credential",
			userId: "user-1",
			password: passwordHash,
		});

		const { authenticateKosync } = await import("src/server/kosync");
		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "reader@example.com",
				"x-auth-key": "wrong-password",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: passwordHash,
			password: "wrong-password",
		});
		expect(signInEmail).not.toHaveBeenCalled();
		expect(accountFindFirst).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("/api/kosync/users/create", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("returns the same generic success response whether the user exists or not", async () => {
		const { Route } = await import("src/routes/api/kosync/users.create");
		const existingUserResponse = await Route.options.server.handlers.POST({
			request: new Request("https://example.com/api/kosync/users/create", {
				method: "POST",
				body: JSON.stringify({
					username: "reader@example.com",
					password: "correct-horse",
				}),
			}),
		});

		const missingUserResponse = await Route.options.server.handlers.POST({
			request: new Request("https://example.com/api/kosync/users/create", {
				method: "POST",
				body: JSON.stringify({
					username: "reader@example.com",
					password: "correct-horse",
				}),
			}),
		});

		expect(existingUserResponse.status).toBe(missingUserResponse.status);
		await expect(existingUserResponse.json()).resolves.toEqual({
			username: "reader@example.com",
		});
		await expect(missingUserResponse.json()).resolves.toEqual({
			username: "reader@example.com",
		});
		expect(existingUserResponse.status).toBe(201);
		expect(userFindFirst).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
	});
});
