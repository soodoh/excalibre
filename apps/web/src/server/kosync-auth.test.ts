import { hashPassword, verifyPassword } from "better-auth/crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

const eqMock = vi.fn((field: unknown, value: unknown) => ({ field, value }));
const andMock = vi.fn((...clauses: unknown[]) => ({ clauses }));
const selectMock = vi.fn();
const fromMock = vi.fn();
const leftJoinMock = vi.fn();
const whereMock = vi.fn();
const getMock = vi.fn();
const userFindFirst = vi.fn();
const accountFindFirst = vi.fn();
const signInEmail = vi.fn();
const fetchMock = vi.fn(() => Promise.reject(new Error("unexpected fetch")));
const selectChain = {
	from: fromMock,
	leftJoin: leftJoinMock,
	where: whereMock,
	get: getMock,
};

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
		select: selectMock,
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
		selectMock.mockReturnValue(selectChain);
		fromMock.mockReturnValue(selectChain);
		leftJoinMock.mockReturnValue(selectChain);
		whereMock.mockReturnValue(selectChain);
	});

	test("uses one stateless query for header auth without calling fetch", async () => {
		const passwordHash = await hashPassword("correct-horse");
		getMock.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			emailVerified: false,
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
			credentialPassword: passwordHash,
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
			emailVerified: false,
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
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "credential");
		expect(selectMock).toHaveBeenCalledTimes(1);
		expect(leftJoinMock).toHaveBeenCalledTimes(1);
		expect(andMock).toHaveBeenCalledTimes(1);
		expect(signInEmail).not.toHaveBeenCalled();
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: passwordHash,
			password: "correct-horse",
		});
		expect(userFindFirst).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("burns password verification work when the user does not exist", async () => {
		const { authenticateKosync, DUMMY_PASSWORD_HASH } = await import(
			"src/server/kosync"
		);
		getMock.mockResolvedValueOnce(null);

		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "Missing@Example.com",
				"x-auth-key": "wrong-password",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
		expect(selectMock).toHaveBeenCalledTimes(1);
		expect(leftJoinMock).toHaveBeenCalledTimes(1);
		expect(andMock).toHaveBeenCalledTimes(1);
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
		getMock.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			emailVerified: false,
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
			credentialPassword: null,
		});

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
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "credential");
		expect(selectMock).toHaveBeenCalledTimes(1);
		expect(leftJoinMock).toHaveBeenCalledTimes(1);
		expect(andMock).toHaveBeenCalledTimes(1);
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: DUMMY_PASSWORD_HASH,
			password: "wrong-password",
		});
		expect(signInEmail).not.toHaveBeenCalled();
		expect(userFindFirst).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null for invalid header auth without calling fetch", async () => {
		const passwordHash = await hashPassword("correct-horse");
		getMock.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			emailVerified: false,
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
			credentialPassword: passwordHash,
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
		expect(selectMock).toHaveBeenCalledTimes(1);
		expect(leftJoinMock).toHaveBeenCalledTimes(1);
		expect(userFindFirst).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("authenticateKosync missing headers", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
		selectMock.mockReturnValue(selectChain);
		fromMock.mockReturnValue(selectChain);
		leftJoinMock.mockReturnValue(selectChain);
		whereMock.mockReturnValue(selectChain);
	});

	test("returns null when x-auth-user header is missing", async () => {
		const { authenticateKosync } = await import("src/server/kosync");
		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-key": "some-password",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
		expect(selectMock).not.toHaveBeenCalled();
	});

	test("returns null when x-auth-key header is missing", async () => {
		const { authenticateKosync } = await import("src/server/kosync");
		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "reader@example.com",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
		expect(selectMock).not.toHaveBeenCalled();
	});

	test("returns null when both headers are missing", async () => {
		const { authenticateKosync } = await import("src/server/kosync");
		const request = new Request("https://example.com/api/kosync/users/auth");

		await expect(authenticateKosync(request)).resolves.toBeNull();
	});
});

describe("findBookByMd5", () => {
	const bookFilesFindFirst = vi.fn();

	beforeEach(async () => {
		vi.resetAllMocks();
		// Re-mock db to include bookFiles query
		const mod = await import("src/db");
		const db = vi.mocked(mod).db as unknown as Record<
			string,
			Record<string, Record<string, unknown>>
		>;
		if (!db.query.bookFiles) {
			db.query.bookFiles = {};
		}
		db.query.bookFiles.findFirst = bookFilesFindFirst;
	});

	test("returns book file when MD5 matches", async () => {
		const mockFile = { id: 10, bookId: 1, md5Hash: "abc123" };
		bookFilesFindFirst.mockResolvedValueOnce(mockFile);

		const { findBookByMd5 } = await import("src/server/kosync");
		const result = await findBookByMd5("abc123");

		expect(result).toEqual(mockFile);
	});

	test("returns null when no match found", async () => {
		bookFilesFindFirst.mockResolvedValueOnce(undefined);

		const { findBookByMd5 } = await import("src/server/kosync");
		const result = await findBookByMd5("nonexistent");

		expect(result).toBeNull();
	});
});

describe("/api/kosync/users/create", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("returns the same generic success response whether the user exists or not", async () => {
		const { handleKosyncUsersCreatePost } = await import(
			"src/routes/api/kosync/users.create"
		);
		const existingUserResponse = await handleKosyncUsersCreatePost({
			request: new Request("https://example.com/api/kosync/users/create", {
				method: "POST",
				body: JSON.stringify({
					username: "reader@example.com",
					password: "correct-horse",
				}),
			}),
		});

		const missingUserResponse = await handleKosyncUsersCreatePost({
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
