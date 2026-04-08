import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const existsSync = vi.fn();
const createReadStream = vi.fn();
const assertUserCanAccessBookFile = vi.fn();
const assertUserCanAccessBook = vi.fn();
const requireRequestAuth = vi.fn();

vi.mock("node:fs", () => ({
	createReadStream,
	existsSync,
}));

vi.mock("src/server/access-control", () => ({
	assertUserCanAccessBook,
	assertUserCanAccessBookFile,
}));

vi.mock("src/server/request-auth-resolver", () => ({
	requireRequestAuth,
}));

describe("asset streaming routes", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		existsSync.mockReturnValue(true);
		requireRequestAuth.mockResolvedValue({ userId: "user-1" });
	});

	afterEach(() => {
		vi.resetModules();
	});

	test("book downloads stream the file contents", async () => {
		assertUserCanAccessBookFile.mockResolvedValue({
			filePath: "/tmp/book.epub",
			format: "epub",
		});
		createReadStream.mockReturnValue(Readable.from(["book-content"]));

		const { handleBookAssetRequest } = await import(
			"src/routes/api/books/$fileId"
		);
		const response = await handleBookAssetRequest({
			request: new Request("https://example.com/api/books/12"),
			params: { fileId: "12" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/epub+zip");
		expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
		await expect(response.text()).resolves.toBe("book-content");
		expect(createReadStream).toHaveBeenCalledWith("/tmp/book.epub");
	});

	test("cover responses stream the image contents", async () => {
		assertUserCanAccessBook.mockResolvedValue({
			coverPath: "/tmp/cover.webp",
		});
		createReadStream.mockReturnValue(Readable.from(["cover-content"]));

		const { handleCoverAssetRequest } = await import(
			"src/routes/api/covers/$bookId"
		);
		const response = await handleCoverAssetRequest({
			request: new Request("https://example.com/api/covers/12"),
			params: { bookId: "12" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/webp");
		expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
		await expect(response.text()).resolves.toBe("cover-content");
		expect(createReadStream).toHaveBeenCalledWith("/tmp/cover.webp");
	});
});
