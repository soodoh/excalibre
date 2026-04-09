import { UnauthorizedError } from "src/server/http-errors";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockGetSession = vi.fn();
const mockAuthenticateOpds = vi.fn();
const mockAuthenticateKobo = vi.fn();

vi.mock("src/lib/auth", () => ({
	auth: {
		api: {
			getSession: mockGetSession,
		},
	},
}));

vi.mock("src/server/opds", () => ({
	authenticateOpds: mockAuthenticateOpds,
}));

vi.mock("src/server/kobo", () => ({
	authenticateKobo: mockAuthenticateKobo,
}));

describe("request-auth-resolver", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function makeRequest(url = "https://example.com/api/test"): Request {
		return new Request(url, {
			headers: new Headers({ cookie: "session=abc" }),
		});
	}

	describe("resolveRequestAuth", () => {
		test("returns mode 'session' when session auth succeeds", async () => {
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Test" },
				session: { token: "abc" },
			});

			const { resolveRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);
			const result = await resolveRequestAuth(makeRequest());

			expect(result).toEqual({
				mode: "session",
				userId: "user-1",
			});
			expect(mockAuthenticateOpds).not.toHaveBeenCalled();
			expect(mockAuthenticateKobo).not.toHaveBeenCalled();
		});

		test("falls back to OPDS when session fails", async () => {
			mockGetSession.mockResolvedValue(null);
			mockAuthenticateOpds.mockResolvedValue({
				mode: "opds",
				userId: "opds-user-1",
				apiKey: "key123",
			});

			const { resolveRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);
			const result = await resolveRequestAuth(makeRequest());

			expect(result).toEqual({
				mode: "opds",
				userId: "opds-user-1",
				apiKey: "key123",
			});
			expect(mockAuthenticateKobo).not.toHaveBeenCalled();
		});

		test("falls back to Kobo when session and OPDS fail and koboToken is in query", async () => {
			mockGetSession.mockResolvedValue(null);
			mockAuthenticateOpds.mockResolvedValue(null);
			mockAuthenticateKobo.mockResolvedValue({ userId: "kobo-user-1" });

			const { resolveRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);
			const result = await resolveRequestAuth(
				makeRequest("https://example.com/api/test?koboToken=my-token-123"),
			);

			expect(result).toEqual({
				mode: "kobo",
				userId: "kobo-user-1",
				koboToken: "my-token-123",
			});
			expect(mockAuthenticateKobo).toHaveBeenCalledWith("my-token-123");
		});

		test("returns null when all auth methods fail", async () => {
			mockGetSession.mockResolvedValue(null);
			mockAuthenticateOpds.mockResolvedValue(null);
			mockAuthenticateKobo.mockResolvedValue(null);

			const { resolveRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);
			const result = await resolveRequestAuth(
				makeRequest("https://example.com/api/test?koboToken=bad-token"),
			);

			expect(result).toBeNull();
		});

		test("returns null when no koboToken query param and session/OPDS fail", async () => {
			mockGetSession.mockResolvedValue(null);
			mockAuthenticateOpds.mockResolvedValue(null);

			const { resolveRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);
			const result = await resolveRequestAuth(makeRequest());

			expect(result).toBeNull();
			expect(mockAuthenticateKobo).not.toHaveBeenCalled();
		});
	});

	describe("requireRequestAuth", () => {
		test("throws UnauthorizedError when all auth methods fail", async () => {
			mockGetSession.mockResolvedValue(null);
			mockAuthenticateOpds.mockResolvedValue(null);

			const { requireRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);

			await expect(requireRequestAuth(makeRequest())).rejects.toThrow(
				UnauthorizedError,
			);
			await expect(requireRequestAuth(makeRequest())).rejects.toThrow(
				"Unauthorized",
			);
		});

		test("returns auth result when session succeeds", async () => {
			mockGetSession.mockResolvedValue({
				user: { id: "user-1", name: "Test" },
				session: { token: "abc" },
			});

			const { requireRequestAuth } = await import(
				"src/server/request-auth-resolver"
			);
			const result = await requireRequestAuth(makeRequest());

			expect(result).toEqual({
				mode: "session",
				userId: "user-1",
			});
		});
	});
});
