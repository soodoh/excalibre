import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			koboTokens: { findFirst: vi.fn() },
		},
	},
}));

describe("buildSyncToken / parseSyncToken", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	test("round-trips a sync state through build and parse", async () => {
		const { buildSyncToken, parseSyncToken } = await import("src/server/kobo");

		const state = {
			booksLastModified: "2026-04-01T00:00:00.000Z",
			readingStateLastModified: "2026-04-02T00:00:00.000Z",
		};

		const token = buildSyncToken(state);
		const parsed = parseSyncToken(token);

		expect(parsed).toEqual(state);
	});

	test("parseSyncToken returns default state for null token", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const result = parseSyncToken(null);

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
		expect(result.readingStateLastModified).toBe("1970-01-01T00:00:00.000Z");
	});

	test("parseSyncToken returns default state for undefined token", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const result = parseSyncToken(undefined);

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
	});

	test("parseSyncToken returns default state for empty string", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const result = parseSyncToken("");

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
	});

	test("parseSyncToken returns default state for invalid base64", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const result = parseSyncToken("not-valid-base64!!!");

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
	});

	test("parseSyncToken returns default state for valid base64 with bad JSON", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const token = Buffer.from("not-json").toString("base64");
		const result = parseSyncToken(token);

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
	});

	test("parseSyncToken returns default state when JSON is missing expected fields", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const token = Buffer.from(JSON.stringify({ foo: "bar" })).toString(
			"base64",
		);
		const result = parseSyncToken(token);

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
	});

	test("parseSyncToken returns default state when fields are not strings", async () => {
		const { parseSyncToken } = await import("src/server/kobo");

		const token = Buffer.from(
			JSON.stringify({
				booksLastModified: 12345,
				readingStateLastModified: true,
			}),
		).toString("base64");
		const result = parseSyncToken(token);

		expect(result.booksLastModified).toBe("1970-01-01T00:00:00.000Z");
	});
});

describe("buildBookMetadata", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	test("builds metadata with epub file preferred", async () => {
		const { buildBookMetadata } = await import("src/server/kobo");

		const book = {
			id: 1,
			title: "Test Book",
			description: "A description",
			language: "en",
			publisher: "Test Publisher",
			publishDate: "2026-01-01",
			coverPath: "/covers/1.jpg",
			seriesId: null,
			seriesIndex: null,
			sortTitle: "Test Book",
			slug: "test-book",
			libraryId: 1,
			isbn10: null,
			isbn13: null,
			pageCount: null,
			hardcoverId: null,
			googleBooksId: null,
			rating: null,
			createdAt: new Date("2026-01-01"),
			updatedAt: new Date("2026-01-01"),
		};

		const files = [
			{
				id: 10,
				bookId: 1,
				format: "pdf",
				filePath: "/books/test.pdf",
				fileSize: 5000,
				fileHash: "hash1",
				md5Hash: "md5_1",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
			{
				id: 11,
				bookId: 1,
				format: "epub",
				filePath: "/books/test.epub",
				fileSize: 3000,
				fileHash: "hash2",
				md5Hash: "md5_2",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
		];

		const bookAuthors = [
			{
				id: 1,
				name: "Author One",
				sortName: "One, Author",
				slug: "author-one",
				createdAt: new Date(),
			},
		];

		const result = buildBookMetadata(
			book as never,
			files as never,
			bookAuthors as never,
			"https://example.com",
			"tok-123",
		);

		expect(result.Title).toBe("Test Book");
		expect(result.Contributors).toEqual({ Author: "Author One" });
		expect(result.Description).toBe("A description");
		expect(result.Language).toBe("en");
		expect(result.Publisher).toBe("Test Publisher");
		expect(result.PublicationDate).toBe("2026-01-01");
		expect(result.DownloadUrls).toHaveLength(1);
		expect(result.DownloadUrls[0].Size).toBe(3000);
		expect(result.DownloadUrls[0].Url).toContain(
			"/api/kobo/tok-123/v1/library/1/download",
		);
	});

	test("builds metadata with no files", async () => {
		const { buildBookMetadata } = await import("src/server/kobo");

		const book = {
			id: 2,
			title: "No Files",
			description: null,
			language: null,
			publisher: null,
			publishDate: null,
			coverPath: null,
			seriesId: null,
			seriesIndex: null,
			sortTitle: "No Files",
			slug: "no-files",
			libraryId: 1,
			isbn10: null,
			isbn13: null,
			pageCount: null,
			hardcoverId: null,
			googleBooksId: null,
			rating: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const result = buildBookMetadata(
			book as never,
			[],
			[],
			"https://example.com",
			"tok-456",
		);

		expect(result.Title).toBe("No Files");
		expect(result.Contributors).toBeUndefined();
		expect(result.Description).toBeUndefined();
		expect(result.Language).toBe("en");
		expect(result.Publisher).toBeUndefined();
		expect(result.PublicationDate).toBeUndefined();
		expect(result.DownloadUrls).toEqual([]);
	});

	test("prefers kepub over non-epub formats when no epub", async () => {
		const { buildBookMetadata } = await import("src/server/kobo");

		const book = {
			id: 3,
			title: "Kepub Book",
			description: null,
			language: null,
			publisher: null,
			publishDate: null,
			coverPath: null,
			seriesId: null,
			seriesIndex: null,
			sortTitle: "Kepub Book",
			slug: "kepub-book",
			libraryId: 1,
			isbn10: null,
			isbn13: null,
			pageCount: null,
			hardcoverId: null,
			googleBooksId: null,
			rating: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const files = [
			{
				id: 20,
				bookId: 3,
				format: "pdf",
				filePath: "/books/test.pdf",
				fileSize: 5000,
				fileHash: "h1",
				md5Hash: "m1",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
			{
				id: 21,
				bookId: 3,
				format: "kepub",
				filePath: "/books/test.kepub",
				fileSize: 4000,
				fileHash: "h2",
				md5Hash: "m2",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
		];

		const result = buildBookMetadata(
			book as never,
			files as never,
			[],
			"https://example.com",
			"tok",
		);

		expect(result.DownloadUrls[0].Size).toBe(4000);
	});

	test("falls back to first file when no epub or kepub", async () => {
		const { buildBookMetadata } = await import("src/server/kobo");

		const book = {
			id: 4,
			title: "PDF Only",
			description: null,
			language: null,
			publisher: null,
			publishDate: null,
			coverPath: null,
			seriesId: null,
			seriesIndex: null,
			sortTitle: "PDF Only",
			slug: "pdf-only",
			libraryId: 1,
			isbn10: null,
			isbn13: null,
			pageCount: null,
			hardcoverId: null,
			googleBooksId: null,
			rating: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const files = [
			{
				id: 30,
				bookId: 4,
				format: "pdf",
				filePath: "/books/test.pdf",
				fileSize: 7000,
				fileHash: "h3",
				md5Hash: "m3",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
		];

		const result = buildBookMetadata(
			book as never,
			files as never,
			[],
			"https://example.com",
			"tok",
		);

		expect(result.DownloadUrls[0].Size).toBe(7000);
	});

	test("handles fileSize being null", async () => {
		const { buildBookMetadata } = await import("src/server/kobo");

		const book = {
			id: 5,
			title: "Null Size",
			description: null,
			language: null,
			publisher: null,
			publishDate: null,
			coverPath: null,
			seriesId: null,
			seriesIndex: null,
			sortTitle: "Null Size",
			slug: "null-size",
			libraryId: 1,
			isbn10: null,
			isbn13: null,
			pageCount: null,
			hardcoverId: null,
			googleBooksId: null,
			rating: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const files = [
			{
				id: 40,
				bookId: 5,
				format: "epub",
				filePath: "/books/test.epub",
				fileSize: null,
				fileHash: "h4",
				md5Hash: "m4",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
		];

		const result = buildBookMetadata(
			book as never,
			files as never,
			[],
			"https://example.com",
			"tok",
		);

		expect(result.DownloadUrls[0].Size).toBe(0);
	});
});

describe("buildReadingState", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	test("returns ReadyToRead when progress is null", async () => {
		const { buildReadingState } = await import("src/server/kobo");

		const result = buildReadingState(null, 1);

		expect(result.StatusInfo.Status).toBe("ReadyToRead");
		expect(result.CurrentBookmark.ProgressPercent).toBe(0);
	});

	test("returns ReadyToRead when progress is 0", async () => {
		const { buildReadingState } = await import("src/server/kobo");

		const progress = {
			id: 1,
			userId: "u1",
			bookId: 1,
			deviceType: "web" as const,
			deviceId: null,
			progress: 0,
			position: null,
			isFinished: false,
			updatedAt: new Date("2026-04-01"),
			createdAt: new Date("2026-04-01"),
		};

		const result = buildReadingState(progress as never, 1);

		expect(result.StatusInfo.Status).toBe("ReadyToRead");
		expect(result.CurrentBookmark.ProgressPercent).toBe(0);
	});

	test("returns Reading when progress > 0 and not finished", async () => {
		const { buildReadingState } = await import("src/server/kobo");

		const progress = {
			id: 1,
			userId: "u1",
			bookId: 1,
			deviceType: "web" as const,
			deviceId: null,
			progress: 0.5,
			position: null,
			isFinished: false,
			updatedAt: new Date("2026-04-01"),
			createdAt: new Date("2026-04-01"),
		};

		const result = buildReadingState(progress as never, 1);

		expect(result.StatusInfo.Status).toBe("Reading");
		expect(result.CurrentBookmark.ProgressPercent).toBe(50);
	});

	test("returns Finished when isFinished is true", async () => {
		const { buildReadingState } = await import("src/server/kobo");

		const progress = {
			id: 1,
			userId: "u1",
			bookId: 1,
			deviceType: "web" as const,
			deviceId: null,
			progress: 1.0,
			position: null,
			isFinished: true,
			updatedAt: new Date("2026-04-01"),
			createdAt: new Date("2026-04-01"),
		};

		const result = buildReadingState(progress as never, 1);

		expect(result.StatusInfo.Status).toBe("Finished");
		expect(result.CurrentBookmark.ProgressPercent).toBe(100);
	});

	test("returns ReadyToRead for undefined progress", async () => {
		const { buildReadingState } = await import("src/server/kobo");

		const result = buildReadingState(undefined, 1);

		expect(result.StatusInfo.Status).toBe("ReadyToRead");
	});
});

describe("buildNewEntitlement", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	test("builds a complete new entitlement structure", async () => {
		const { buildNewEntitlement } = await import("src/server/kobo");

		const book = {
			id: 1,
			title: "Test Book",
			description: "Desc",
			language: "en",
			publisher: "Publisher",
			publishDate: "2026-01-01",
			coverPath: "/covers/1.jpg",
			seriesId: null,
			seriesIndex: null,
			sortTitle: "Test Book",
			slug: "test-book",
			libraryId: 1,
			isbn10: null,
			isbn13: null,
			pageCount: null,
			hardcoverId: null,
			googleBooksId: null,
			rating: null,
			createdAt: new Date("2026-01-01"),
			updatedAt: new Date("2026-01-01"),
		};

		const files = [
			{
				id: 10,
				bookId: 1,
				format: "epub",
				filePath: "/books/test.epub",
				fileSize: 3000,
				fileHash: "hash",
				md5Hash: "md5",
				source: "scanned",
				volumeType: "data",
				modifiedAt: new Date(),
				createdAt: new Date(),
			},
		];

		const bookAuthors = [
			{
				id: 1,
				name: "Author",
				sortName: "Author",
				slug: "author",
				createdAt: new Date(),
			},
		];

		const result = buildNewEntitlement(
			book as never,
			files as never,
			bookAuthors as never,
			null,
			"https://example.com",
			"tok",
		);

		expect(result.NewEntitlement).toBeDefined();
		expect(result.NewEntitlement.BookEntitlement.Accessibility).toBe("Full");
		expect(result.NewEntitlement.BookEntitlement.IsRemovable).toBe(true);
		expect(result.NewEntitlement.BookEntitlement.IsVisible).toBe(true);
		expect(result.NewEntitlement.BookMetadata.Title).toBe("Test Book");
		expect(result.NewEntitlement.ReadingState).toBeDefined();
		expect(result.NewEntitlement.ReadingState?.StatusInfo.Status).toBe(
			"ReadyToRead",
		);
	});
});
