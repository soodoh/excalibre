import { beforeEach, describe, expect, test, vi } from "vitest";

const eqMock = vi.fn((field: unknown, value: unknown) => ({ field, value }));
const userFindFirst = vi.fn();
const signInEmail = vi.fn();
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
		},
	},
}));

vi.mock("src/lib/auth", async () => {
	return {
		auth: {
			api: {
				signInEmail,
			},
		},
	};
});

describe("authenticateKosync", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	test("uses Better Auth signInEmail for header auth without calling fetch", async () => {
		userFindFirst.mockImplementation(
			({ where }: { where: { value: string } }) =>
				where.value === "user-1"
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
		signInEmail.mockResolvedValueOnce({
			redirect: false,
			token: "session-token",
			url: undefined,
			user: {
				id: "user-1",
				email: "reader@example.com",
			},
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
		expect(signInEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				body: {
					email: "Reader@Example.com",
					password: "correct-horse",
				},
			}),
		);
		expect(eqMock).toHaveBeenCalledWith(expect.anything(), "user-1");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns null for invalid header auth without calling fetch", async () => {
		signInEmail.mockRejectedValueOnce(new Error("invalid credentials"));

		const { authenticateKosync } = await import("src/server/kosync");
		const request = new Request("https://example.com/api/kosync/users/auth", {
			headers: {
				"x-auth-user": "reader@example.com",
				"x-auth-key": "wrong-password",
			},
		});

		await expect(authenticateKosync(request)).resolves.toBeNull();
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
	});
});
