import { ForbiddenError } from "src/server/http-errors";
import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateKobo = vi.fn();
const authenticateOpds = vi.fn();
const assertUserCanAccessBook = vi.fn();

vi.mock("src/db", () => ({ db: {} }));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
}));

vi.mock("src/server/kobo", () => ({
	authenticateKobo,
	buildReadingState: vi.fn(),
}));

vi.mock("src/server/opds", async () => {
	const actual =
		await vi.importActual<typeof import("src/server/opds")>("src/server/opds");
	return {
		...actual,
		authenticateOpds,
	};
});

describe("asset route access failures", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		assertUserCanAccessBook.mockRejectedValue(new ForbiddenError("Forbidden"));
	});

	test("kobo download returns 403 instead of 500", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		const { handleKoboLibraryDownloadRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.$bookId.download"
		);

		const response = await handleKoboLibraryDownloadRequest({
			params: { token: "token-1", bookId: "12" },
		});

		expect(response.status).toBe(403);
	});

	test("kobo state GET returns 403 instead of 500", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		const { handleKoboLibraryStateGetRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.$bookId.state"
		);

		const response = await handleKoboLibraryStateGetRequest({
			params: { token: "token-1", bookId: "12" },
		});

		expect(response.status).toBe(403);
	});

	test("kobo state PUT returns 403 instead of 500", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		const { handleKoboLibraryStatePutRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.$bookId.state"
		);

		const response = await handleKoboLibraryStatePutRequest({
			request: new Request("https://example.com", {
				method: "PUT",
				body: JSON.stringify({ ReadingStates: [] }),
				headers: { "Content-Type": "application/json" },
			}),
			params: { token: "token-1", bookId: "12" },
		});

		expect(response.status).toBe(403);
	});

	test("opds pse returns 403 instead of 500", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		const { handleOpdsPseRequest } = await import(
			"src/routes/api/opds/pse.$bookId.$pageNumber"
		);

		const response = await handleOpdsPseRequest({
			request: new Request(
				"https://example.com/api/opds/pse/12/0?apikey=feed-key",
			),
			params: { bookId: "12", pageNumber: "0" },
		});

		expect(response.status).toBe(403);
	});
});
