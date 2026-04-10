import { ForbiddenError } from "src/server/http-errors";
import { beforeEach, describe, expect, test, vi } from "vitest";

const authenticateKobo = vi.fn();
const authenticateOpds = vi.fn();
const assertUserCanAccessBook = vi.fn();
const findManyBookFiles = vi.fn();
const findFirstBookFile = vi.fn();
const findFirstBook = vi.fn();
const findFirstReadingProgress = vi.fn();
const existsSync = vi.fn();
const readFileSync = vi.fn();
const admZipCtor = vi.fn();

vi.mock("node:fs", () => ({
	existsSync,
	readFileSync,
}));

vi.mock("adm-zip", () => ({
	default: admZipCtor,
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			bookFiles: {
				findMany: findManyBookFiles,
				findFirst: findFirstBookFile,
			},
			books: {
				findFirst: findFirstBook,
			},
			readingProgress: {
				findFirst: findFirstReadingProgress,
			},
		},
	},
}));

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
		await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
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
		await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
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
		await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
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

	test("opds pse preserves specific 500 message when CBZ open fails", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		assertUserCanAccessBook.mockResolvedValue({ id: 12, libraryId: 1 });
		findFirstBookFile.mockResolvedValue({
			id: 1,
			bookId: 12,
			format: "cbz",
			filePath: "/tmp/book.cbz",
		});
		existsSync.mockReturnValue(true);
		admZipCtor.mockImplementation(function MockAdmZip() {
			throw new Error("zip open failed");
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

		expect(response.status).toBe(500);
		await expect(response.text()).resolves.toBe("Failed to open CBZ file");
	});

	test("opds pse preserves specific 500 message when page extraction fails", async () => {
		authenticateOpds.mockResolvedValue({
			mode: "opds",
			userId: "user-1",
			apiKey: "feed-key",
		});
		assertUserCanAccessBook.mockResolvedValue({ id: 12, libraryId: 1 });
		findFirstBookFile.mockResolvedValue({
			id: 1,
			bookId: 12,
			format: "cbz",
			filePath: "/tmp/book.cbz",
		});
		existsSync.mockReturnValue(true);
		admZipCtor.mockImplementation(function MockAdmZip() {
			return {
				getEntries: () => [
					{
						entryName: "0001.jpg",
						isDirectory: false,
						getData: () => {
							throw new Error("extract failed");
						},
					},
				],
			};
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

		expect(response.status).toBe(500);
		await expect(response.text()).resolves.toBe("Failed to extract page");
	});
});
