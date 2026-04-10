import { beforeEach, describe, expect, test, vi } from "vitest";

const authHandler = vi.fn();
const dbSelect = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
	},
}));

vi.mock("src/lib/auth", async () => {
	const actual =
		await vi.importActual<typeof import("src/lib/auth")>("src/lib/auth");
	return {
		...actual,
		auth: {
			...actual.auth,
			handler: authHandler,
		},
	};
});

describe("auth hardening", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("blocks sign-up when a user already exists", async () => {
		dbSelect.mockReturnValueOnce({
			from: () => ({
				get: () => ({ count: 1 }),
			}),
		});

		const { handleAuthRequest } = await import("src/routes/api/auth/$");
		const request = new Request("https://example.com/api/auth/sign-up/email", {
			method: "POST",
		});

		const response = await handleAuthRequest(request);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			message: "Registration is disabled after initial setup.",
		});
		expect(authHandler).not.toHaveBeenCalled();
	});

	test("Route handlers forward GET and POST requests to handleAuthRequest", async () => {
		dbSelect.mockReturnValue({
			from: () => ({
				get: () => ({ count: 0 }),
			}),
		});
		authHandler.mockResolvedValue(Response.json({ ok: true }, { status: 200 }));

		const mod = await import("src/routes/api/auth/$");
		const { Route } = mod;
		// Access the route's server handlers
		const handlers = (
			Route as unknown as {
				options: {
					server: {
						handlers: {
							GET: (args: { request: Request }) => Promise<Response>;
							POST: (args: { request: Request }) => Promise<Response>;
						};
					};
				};
			}
		).options.server.handlers;
		const getResponse = await handlers.GET({
			request: new Request("https://example.com/api/auth/session"),
		});
		expect(getResponse.status).toBe(200);
		const postResponse = await handlers.POST({
			request: new Request("https://example.com/api/auth/sign-in/email", {
				method: "POST",
			}),
		});
		expect(postResponse.status).toBe(200);
	});

	test("allows bootstrap sign-up when no users exist", async () => {
		dbSelect.mockReturnValueOnce({
			from: () => ({
				get: () => ({ count: 0 }),
			}),
		});
		authHandler.mockResolvedValueOnce(
			Response.json({ ok: true }, { status: 200 }),
		);

		const { handleAuthRequest } = await import("src/routes/api/auth/$");
		const request = new Request("https://example.com/api/auth/sign-up/email", {
			method: "POST",
		});

		const response = await handleAuthRequest(request);

		expect(authHandler).toHaveBeenCalledTimes(1);
		expect(authHandler).toHaveBeenCalledWith(request);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ ok: true });
	});
});
