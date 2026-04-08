import { beforeEach, describe, expect, test, vi } from "vitest";

const opdsApiKeyFindFirst = vi.fn();
const signInEmail = vi.fn();
const fetchMock = vi.fn(() => Promise.reject(new Error("unexpected fetch")));

vi.mock("src/db", () => ({
	db: {
		query: {
			opdsKeys: {
				findFirst: opdsApiKeyFindFirst,
			},
		},
	},
}));

vi.mock("src/lib/auth", async () => {
	const actual =
		await vi.importActual<typeof import("src/lib/auth")>("src/lib/auth");

	return {
		...actual,
		auth: {
			...actual.auth,
			api: {
				...actual.auth.api,
				signInEmail,
			},
		},
	};
});

describe("authenticateOpds", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	test("uses Better Auth signInEmail for basic auth without calling fetch", async () => {
		signInEmail.mockResolvedValueOnce({
			redirect: false,
			token: "session-token",
			url: undefined,
			user: {
				id: "user-1",
				email: "reader@example.com",
			},
		});

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("reader@example.com:correct-horse")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toEqual({
			mode: "opds",
			userId: "user-1",
		});
		expect(signInEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				body: {
					email: "reader@example.com",
					password: "correct-horse",
				},
			}),
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null for invalid basic auth without calling fetch", async () => {
		signInEmail.mockRejectedValueOnce(new Error("invalid credentials"));

		const { authenticateOpds } = await import("src/server/opds");
		const request = new Request("https://example.com/api/opds", {
			headers: {
				Authorization: `Basic ${btoa("reader@example.com:wrong-password")}`,
			},
		});

		await expect(authenticateOpds(request)).resolves.toBeNull();
		expect(signInEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				body: {
					email: "reader@example.com",
					password: "wrong-password",
				},
			}),
		);
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
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
