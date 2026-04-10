import { beforeEach, describe, expect, test, vi } from "vitest";

// --- Mock setup ---
const bookFilesFindFirst = vi.fn();
const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			bookFiles: { findFirst: bookFilesFindFirst },
		},
		insert: dbInsertMock,
	},
}));

vi.mock("src/db/schema", () => ({
	bookFiles: { id: "bookFiles.id" },
}));

const mockGetEntries = vi.fn();
const mockUpdateFile = vi.fn();
const mockWriteZip = vi.fn();

vi.mock("adm-zip", () => {
	const MockAdmZip = vi.fn(function (this: Record<string, unknown>) {
		this.getEntries = mockGetEntries;
		this.updateFile = mockUpdateFile;
		this.writeZip = mockWriteZip;
	});
	return { default: MockAdmZip };
});

vi.mock("node:fs", () => ({
	default: {
		mkdirSync: vi.fn(),
		statSync: vi.fn(() => ({ size: 12345, mtimeMs: 1700000000000 })),
	},
}));

vi.mock("node:path", async () => {
	const actual = await vi.importActual<typeof import("node:path")>("node:path");
	return {
		default: actual,
		...actual,
	};
});

describe("epub-fixer", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		dbInsertMock.mockReturnValue({ values: dbInsertValuesMock });
		dbInsertValuesMock.mockReturnValue({ returning: dbInsertReturningMock });
	});

	describe("fixEpub", () => {
		test("throws when bookFile not found", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(undefined);

			const { fixEpub } = await import("src/server/epub-fixer");

			await expect(fixEpub(999)).rejects.toThrow("BookFile 999 not found");
		});

		test("throws when bookFile is not an EPUB", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "pdf",
				filePath: "/books/test.pdf",
				bookId: 10,
			});

			const { fixEpub } = await import("src/server/epub-fixer");

			await expect(fixEpub(1)).rejects.toThrow(
				"BookFile 1 is not an EPUB (format: pdf)",
			);
		});

		test("returns null when no changes are needed", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "epub",
				filePath: "/books/test.epub",
				bookId: 10,
			});

			mockGetEntries.mockReturnValue([
				{
					isDirectory: false,
					entryName: "content.xhtml",
					getData: () =>
						Buffer.from(
							'<?xml version="1.0" encoding="UTF-8"?>\n<html xml:lang="en"><body>Hello</body></html>',
						),
				},
			]);

			const { fixEpub } = await import("src/server/epub-fixer");

			const result = await fixEpub(1);

			expect(result).toBeNull();
			expect(mockUpdateFile).not.toHaveBeenCalled();
			expect(mockWriteZip).not.toHaveBeenCalled();
		});

		test("skips directory entries", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "epub",
				filePath: "/books/test.epub",
				bookId: 10,
			});

			mockGetEntries.mockReturnValue([
				{ isDirectory: true, entryName: "META-INF/" },
			]);

			const { fixEpub } = await import("src/server/epub-fixer");

			const result = await fixEpub(1);

			expect(result).toBeNull();
		});

		test("skips non-content files", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "epub",
				filePath: "/books/test.epub",
				bookId: 10,
			});

			mockGetEntries.mockReturnValue([
				{
					isDirectory: false,
					entryName: "style.css",
					getData: () => Buffer.from("body { color: red; }"),
				},
				{
					isDirectory: false,
					entryName: "image.png",
					getData: () => Buffer.from("PNG data"),
				},
			]);

			const { fixEpub } = await import("src/server/epub-fixer");

			const result = await fixEpub(1);

			expect(result).toBeNull();
		});

		test("fixes XHTML content and creates new book file record", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "epub",
				filePath: "/books/test.epub",
				bookId: 10,
			});

			// Content missing XML declaration and xml:lang
			mockGetEntries.mockReturnValue([
				{
					isDirectory: false,
					entryName: "chapter1.xhtml",
					getData: () => Buffer.from("<html><body>Chapter 1</body></html>"),
				},
			]);

			const newRecord = {
				id: 2,
				bookId: 10,
				filePath: "data/excalibre/fixed/10/test.epub",
				format: "epub",
				fileSize: 12345,
				source: "converted",
				volumeType: "excalibre",
			};
			dbInsertReturningMock.mockResolvedValueOnce([newRecord]);

			const { fixEpub } = await import("src/server/epub-fixer");

			const result = await fixEpub(1);

			expect(mockUpdateFile).toHaveBeenCalledWith(
				"chapter1.xhtml",
				expect.any(Buffer),
			);
			expect(mockWriteZip).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(result).toEqual(newRecord);
		});

		test("strips null bytes from content", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "epub",
				filePath: "/books/test.epub",
				bookId: 10,
			});

			mockGetEntries.mockReturnValue([
				{
					isDirectory: false,
					entryName: "chapter1.html",
					getData: () =>
						Buffer.from(
							'<?xml version="1.0" encoding="UTF-8"?>\n<html xml:lang="en"><body>Hello\0World</body></html>',
						),
				},
			]);

			const newRecord = { id: 2 };
			dbInsertReturningMock.mockResolvedValueOnce([newRecord]);

			const { fixEpub } = await import("src/server/epub-fixer");

			const result = await fixEpub(1);

			// Null byte was stripped, so content changed
			expect(mockUpdateFile).toHaveBeenCalledWith(
				"chapter1.html",
				expect.any(Buffer),
			);
			const updatedBuffer = mockUpdateFile.mock.calls[0][1] as Buffer;
			expect(updatedBuffer.toString("utf8")).not.toContain("\0");
			expect(result).toEqual(newRecord);
		});

		test("processes .htm files as EPUB content", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 1,
				format: "epub",
				filePath: "/books/test.epub",
				bookId: 10,
			});

			mockGetEntries.mockReturnValue([
				{
					isDirectory: false,
					entryName: "chapter.htm",
					getData: () => Buffer.from("<html><body>Content</body></html>"),
				},
			]);

			const newRecord = { id: 3 };
			dbInsertReturningMock.mockResolvedValueOnce([newRecord]);

			const { fixEpub } = await import("src/server/epub-fixer");

			const result = await fixEpub(1);

			expect(mockUpdateFile).toHaveBeenCalled();
			expect(result).toEqual(newRecord);
		});
	});
});
