import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateKobo = vi.fn();
const getAccessibleLibraryIds = vi.fn();
const parseSyncToken = vi.fn();
const buildSyncToken = vi.fn();

vi.mock("src/db", () => ({ db: {} }));

vi.mock("src/server/access-control", () => ({
	getAccessibleLibraryIds,
}));

vi.mock("src/server/kobo", () => ({
	authenticateKobo,
	buildNewEntitlement: vi.fn(),
	buildSyncToken,
	parseSyncToken,
}));

describe("kobo sync", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("returns a fresh sync token even when the user has no accessible libraries", async () => {
		authenticateKobo.mockResolvedValue({ userId: "user-1" });
		getAccessibleLibraryIds.mockResolvedValue([]);
		parseSyncToken.mockReturnValue({
			booksLastModified: "2026-04-01T00:00:00.000Z",
			readingStateLastModified: "2026-04-01T00:00:00.000Z",
		});
		buildSyncToken.mockReturnValue("fresh-token");

		const { handleKoboLibrarySyncRequest } = await import(
			"src/routes/api/kobo/$token/v1/library.sync"
		);
		const response = await handleKoboLibrarySyncRequest({
			request: new Request(
				"https://example.com/api/kobo/token/v1/library/sync",
			),
			params: { token: "token-1" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("x-kobo-synctoken")).toBe("fresh-token");
		expect(response.headers.get("x-kobo-sync")).toBeNull();
		await expect(response.json()).resolves.toEqual([]);
	});
});
