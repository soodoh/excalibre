import { beforeEach, describe, expect, test, vi } from "vitest";

const execFileMock = vi.fn();
const mkdirSyncMock = vi.fn();
const existsSyncMock = vi.fn();
const statSyncMock = vi.fn();

const bookFilesFindFirst = vi.fn();
const booksFindFirst = vi.fn();
const dbInsertMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertReturningMock = vi.fn();

vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
	promisify: () => execFileMock,
}));

vi.mock("node:fs", () => ({
	default: {
		mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
		existsSync: (...args: unknown[]) => existsSyncMock(...args),
		statSync: (...args: unknown[]) => statSyncMock(...args),
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			bookFiles: {
				findFirst: (...args: unknown[]) => bookFilesFindFirst(...args),
			},
			books: { findFirst: (...args: unknown[]) => booksFindFirst(...args) },
		},
		insert: (...args: unknown[]) => dbInsertMock(...args),
	},
}));

vi.mock("src/db/schema", () => ({
	bookFiles: { id: "bookFiles.id", bookId: "bookFiles.bookId" },
	books: { id: "books.id" },
}));

const insertChain = {
	values: dbInsertValuesMock,
	returning: dbInsertReturningMock,
};

describe("converter", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		dbInsertMock.mockReturnValue(insertChain);
		dbInsertValuesMock.mockReturnValue(insertChain);
		dbInsertReturningMock.mockResolvedValue([]);
	});

	describe("convertBook", () => {
		const mockBookFile = {
			id: 10,
			bookId: 1,
			filePath: "/app/data/library/dune.epub",
			format: "epub",
		};

		const mockBook = {
			id: 1,
			title: "Dune",
		};

		test("converts epub to pdf via pandoc", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(mockBookFile);
			booksFindFirst.mockResolvedValueOnce(mockBook);
			mkdirSyncMock.mockReturnValueOnce(undefined);
			execFileMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValueOnce(true);
			statSyncMock.mockReturnValueOnce({ size: 12345, mtimeMs: 1700000000000 });

			const newRecord = {
				id: 20,
				bookId: 1,
				filePath: "data/excalibre/conversions/1/Dune.pdf",
				format: "pdf",
				fileSize: 12345,
				source: "converted",
			};
			dbInsertReturningMock.mockResolvedValueOnce([newRecord]);

			const { convertBook } = await import("src/server/converter");

			const result = await convertBook(10, "pdf");

			expect(bookFilesFindFirst).toHaveBeenCalled();
			expect(booksFindFirst).toHaveBeenCalled();
			expect(mkdirSyncMock).toHaveBeenCalledWith(
				expect.stringContaining("conversions/1"),
				{ recursive: true },
			);
			expect(execFileMock).toHaveBeenCalledWith(
				"pandoc",
				expect.arrayContaining([mockBookFile.filePath]),
			);
			expect(existsSyncMock).toHaveBeenCalled();
			expect(dbInsertMock).toHaveBeenCalled();
			expect(result).toEqual(newRecord);
		});

		test("converts epub to kepub via kepubify", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(mockBookFile);
			booksFindFirst.mockResolvedValueOnce(mockBook);
			mkdirSyncMock.mockReturnValueOnce(undefined);
			execFileMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValueOnce(true);
			statSyncMock.mockReturnValueOnce({ size: 54321, mtimeMs: 1700000000000 });

			const newRecord = {
				id: 21,
				bookId: 1,
				filePath: "data/excalibre/conversions/1/dune.kepub.epub",
				format: "kepub",
				fileSize: 54321,
				source: "converted",
			};
			dbInsertReturningMock.mockResolvedValueOnce([newRecord]);

			const { convertBook } = await import("src/server/converter");

			const result = await convertBook(10, "kepub");

			expect(execFileMock).toHaveBeenCalledWith(
				"kepubify",
				expect.arrayContaining([mockBookFile.filePath]),
			);
			expect(result).toEqual(newRecord);
		});

		test("throws when bookFile not found", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(null);

			const { convertBook } = await import("src/server/converter");

			await expect(convertBook(999, "pdf")).rejects.toThrow(
				"BookFile 999 not found",
			);
		});

		test("throws when conversion produces no output", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(mockBookFile);
			booksFindFirst.mockResolvedValueOnce(mockBook);
			mkdirSyncMock.mockReturnValueOnce(undefined);
			execFileMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValueOnce(false);

			const { convertBook } = await import("src/server/converter");

			await expect(convertBook(10, "pdf")).rejects.toThrow(
				"Conversion produced no output",
			);
		});

		test("uses fallback title when book not found", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(mockBookFile);
			booksFindFirst.mockResolvedValueOnce(null);
			mkdirSyncMock.mockReturnValueOnce(undefined);
			execFileMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValueOnce(true);
			statSyncMock.mockReturnValueOnce({ size: 100, mtimeMs: 1700000000000 });
			dbInsertReturningMock.mockResolvedValueOnce([{ id: 22 }]);

			const { convertBook } = await import("src/server/converter");

			await convertBook(10, "pdf");

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					filePath: expect.stringContaining("book_1.pdf"),
				}),
			);
		});

		test("is case-insensitive for target format", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(mockBookFile);
			booksFindFirst.mockResolvedValueOnce(mockBook);
			mkdirSyncMock.mockReturnValueOnce(undefined);
			execFileMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValueOnce(true);
			statSyncMock.mockReturnValueOnce({ size: 100, mtimeMs: 1700000000000 });
			dbInsertReturningMock.mockResolvedValueOnce([{ id: 23 }]);

			const { convertBook } = await import("src/server/converter");

			await convertBook(10, "PDF");

			expect(execFileMock).toHaveBeenCalledWith(
				"pandoc",
				expect.arrayContaining(["-o"]),
			);
		});

		test("inserts correct bookFile record after conversion", async () => {
			bookFilesFindFirst.mockResolvedValueOnce(mockBookFile);
			booksFindFirst.mockResolvedValueOnce(mockBook);
			mkdirSyncMock.mockReturnValueOnce(undefined);
			execFileMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValueOnce(true);
			statSyncMock.mockReturnValueOnce({ size: 5000, mtimeMs: 1700000000000 });
			dbInsertReturningMock.mockResolvedValueOnce([{ id: 24 }]);

			const { convertBook } = await import("src/server/converter");

			await convertBook(10, "pdf");

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					bookId: 1,
					format: "pdf",
					fileSize: 5000,
					source: "converted",
					volumeType: "excalibre",
				}),
			);
		});
	});

	describe("sanitizeFilename (via convertBook)", () => {
		beforeEach(() => {
			mkdirSyncMock.mockReturnValue(undefined);
			execFileMock.mockResolvedValue({ stdout: "", stderr: "" });
			existsSyncMock.mockReturnValue(true);
			statSyncMock.mockReturnValue({ size: 100, mtimeMs: 1700000000000 });
			dbInsertReturningMock.mockResolvedValue([{ id: 30 }]);
		});

		test("replaces special characters with underscores", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 10,
				bookId: 1,
				filePath: "/books/test.epub",
				format: "epub",
			});
			booksFindFirst.mockResolvedValueOnce({
				id: 1,
				title: 'Book: A "Test" <Title>',
			});

			const { convertBook } = await import("src/server/converter");

			await convertBook(10, "pdf");

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					filePath: expect.stringMatching(/Book__A__Test___Title_\.pdf$/),
				}),
			);
		});

		test("replaces whitespace with underscores", async () => {
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 10,
				bookId: 1,
				filePath: "/books/test.epub",
				format: "epub",
			});
			booksFindFirst.mockResolvedValueOnce({
				id: 1,
				title: "Book  With   Spaces",
			});

			const { convertBook } = await import("src/server/converter");

			await convertBook(10, "pdf");

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					filePath: expect.stringMatching(/Book_With_Spaces\.pdf$/),
				}),
			);
		});

		test("truncates long titles to 200 characters", async () => {
			const longTitle = "A".repeat(300);
			bookFilesFindFirst.mockResolvedValueOnce({
				id: 10,
				bookId: 1,
				filePath: "/books/test.epub",
				format: "epub",
			});
			booksFindFirst.mockResolvedValueOnce({
				id: 1,
				title: longTitle,
			});

			const { convertBook } = await import("src/server/converter");

			await convertBook(10, "pdf");

			expect(dbInsertValuesMock).toHaveBeenCalledWith(
				expect.objectContaining({
					filePath: expect.stringMatching(/A{200}\.pdf$/),
				}),
			);
		});
	});
});
