import { createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
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
const opdsApiKeyFindFirst = vi.fn();
const dbUpdate = vi.fn();
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

vi.mock("src/db", () => ({
	db: {
		select: selectMock,
		update: dbUpdate,
		query: {
			user: {
				findFirst: userFindFirst,
			},
			account: {
				findFirst: accountFindFirst,
			},
			opdsKeys: {
				findFirst: opdsApiKeyFindFirst,
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

describe("authenticateOpds", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
		selectMock.mockReturnValue(selectChain);
		fromMock.mockReturnValue(selectChain);
		leftJoinMock.mockReturnValue(selectChain);
		whereMock.mockReturnValue(selectChain);
	});

	test("uses one stateless query for basic auth without calling fetch", async () => {
		const passwordHash = await hashPassword("correct-horse");
		getMock.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
			credentialPassword: passwordHash,
		});

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("Reader@Example.com:correct-horse")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toEqual({
			mode: "opds",
			userId: "user-1",
		});
		expect(eqMock).toHaveBeenCalledWith(
			expect.anything(),
			"reader@example.com",
		);
		expect(selectMock).toHaveBeenCalledTimes(1);
		expect(leftJoinMock).toHaveBeenCalledTimes(1);
		expect(andMock).toHaveBeenCalledTimes(1);
		expect(signInEmail).not.toHaveBeenCalled();
		expect(userFindFirst).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null for invalid basic auth without calling fetch", async () => {
		const passwordHash = await hashPassword("correct-horse");
		getMock.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
			credentialPassword: passwordHash,
		});

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("reader@example.com:wrong-password")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
		expect(eqMock).toHaveBeenCalledWith(
			expect.anything(),
			"reader@example.com",
		);
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "credential");
		expect(selectMock).toHaveBeenCalledTimes(1);
		expect(leftJoinMock).toHaveBeenCalledTimes(1);
		expect(andMock).toHaveBeenCalledTimes(1);
		expect(signInEmail).not.toHaveBeenCalled();
		expect(userFindFirst).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("still authenticates OPDS api key requests", async () => {
		opdsApiKeyFindFirst.mockResolvedValueOnce({
			userId: "user-1",
			apiKeyHash: createHash("sha256").update("opds-secret").digest("hex"),
		});

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request(
			"https://example.com/api/opds?apikey=opds-secret",
		);

		await expect(authenticateOpds(request)).resolves.toEqual({
			mode: "opds",
			userId: "user-1",
			apiKey: "opds-secret",
		});
		expect(eqMock).toHaveBeenCalledWith(
			expect.anything(),
			createHash("sha256").update("opds-secret").digest("hex"),
		);
		expect(signInEmail).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null when apikey is not found in either hash or plaintext lookup", async () => {
		opdsApiKeyFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request(
			"https://example.com/api/opds?apikey=unknown-key",
		);

		await expect(authenticateOpds(request)).resolves.toBeNull();
		expect(opdsApiKeyFindFirst).toHaveBeenCalledTimes(2);
	});

	test("returns null for invalid base64 in Basic auth", async () => {
		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: "Basic !!!invalid-base64!!!",
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
	});

	test("returns null when Basic auth has no colon separator", async () => {
		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("nocolonhere")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
	});

	test("returns null when Basic auth has empty email", async () => {
		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa(":password")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
	});

	test("returns null when Basic auth has empty password", async () => {
		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("user@example.com:")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
	});

	test("returns null when no auth credentials are provided at all", async () => {
		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds");

		await expect(authenticateOpds(request)).resolves.toBeNull();
	});

	test("upgrades a legacy plaintext OPDS key to a hash after authenticating", async () => {
		const setMock = vi.fn(() => ({
			where: vi.fn(() => Promise.resolve()),
		}));
		dbUpdate.mockReturnValue({
			set: setMock,
		});
		opdsApiKeyFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 3,
			userId: "user-1",
		});

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request(
			"https://example.com/api/opds?apikey=legacy-secret",
		);

		await expect(authenticateOpds(request)).resolves.toEqual({
			mode: "opds",
			userId: "user-1",
			apiKey: "legacy-secret",
		});
		expect(opdsApiKeyFindFirst).toHaveBeenCalledTimes(2);
		expect(setMock).toHaveBeenCalledWith({
			apiKeyHash: createHash("sha256").update("legacy-secret").digest("hex"),
			apiKeyPreview: "lega*********",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
