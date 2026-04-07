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
			apiKey: "opds-secret",
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
		expect(signInEmail).not.toHaveBeenCalled();
		expect(accountFindFirst).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
