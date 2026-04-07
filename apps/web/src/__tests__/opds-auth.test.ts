import { beforeEach, describe, expect, test, vi } from "vitest";

const eqMock = vi.fn((field: unknown, value: unknown) => ({ field, value }));
const userFindFirst = vi.fn();
const accountFindMany = vi.fn();
const opdsApiKeyFindFirst = vi.fn();
const signInEmail = vi.fn();
const verifyPassword = vi.fn();
const fetchMock = vi.fn(() => Promise.reject(new Error("unexpected fetch")));

vi.mock("drizzle-orm", () => ({
	eq: eqMock,
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			user: {
				findFirst: userFindFirst,
			},
			account: {
				findMany: accountFindMany,
			},
			opdsKeys: {
				findFirst: opdsApiKeyFindFirst,
			},
		},
	},
}));

vi.mock("better-auth/crypto", () => ({
	verifyPassword,
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
	});

	test("uses stateless password verification for basic auth without calling fetch", async () => {
		userFindFirst.mockImplementation(
			({ where }: { where: { value: string } }) =>
				where.value === "reader@example.com"
					? {
							id: "user-1",
							email: "reader@example.com",
							name: "Reader",
							image: null,
							role: "reader",
							createdAt: new Date("2026-04-07T00:00:00.000Z"),
							updatedAt: new Date("2026-04-07T00:00:00.000Z"),
						}
					: null,
		);
		accountFindMany.mockImplementation(
			({ where }: { where: { value: string } }) =>
				where.value === "user-1"
					? [
							{
								id: "account-1",
								accountId: "user-1",
								providerId: "credential",
								userId: "user-1",
								password: "hashed-password",
							},
						]
					: [],
		);
		verifyPassword.mockResolvedValueOnce(true);

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
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "user-1");
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: "hashed-password",
			password: "correct-horse",
		});
		expect(signInEmail).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null for invalid basic auth without calling fetch", async () => {
		userFindFirst.mockResolvedValueOnce({
			id: "user-1",
			email: "reader@example.com",
			name: "Reader",
			image: null,
			role: "reader",
			createdAt: new Date("2026-04-07T00:00:00.000Z"),
			updatedAt: new Date("2026-04-07T00:00:00.000Z"),
		});
		accountFindMany.mockResolvedValueOnce([
			{
				id: "account-1",
				accountId: "user-1",
				providerId: "credential",
				userId: "user-1",
				password: "hashed-password",
			},
		]);
		verifyPassword.mockResolvedValueOnce(false);

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("reader@example.com:wrong-password")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: "hashed-password",
			password: "wrong-password",
		});
		expect(signInEmail).not.toHaveBeenCalled();
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
		expect(verifyPassword).not.toHaveBeenCalled();
		expect(signInEmail).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
