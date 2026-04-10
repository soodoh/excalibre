import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
	authors,
	books,
	booksAuthors,
	booksTags,
	series,
	tags,
} from "src/db/schema";
import { afterEach, describe, expect, test, vi } from "vitest";

const librariesFindFirst = vi.fn();
const bookFilesFindFirst = vi.fn();
const booksFindFirst = vi.fn();
const authorsFindFirst = vi.fn();
const seriesFindFirst = vi.fn();
const tagsFindFirst = vi.fn();
const dbSelect = vi.fn();
const dbUpdate = vi.fn();
const dbInsert = vi.fn();
const dbDelete = vi.fn();
const dbTransaction = vi.fn();

const extractMetadataMock = vi.fn();
const isSupportedFormatMock = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
		update: dbUpdate,
		insert: dbInsert,
		delete: dbDelete,
		transaction: dbTransaction,
		query: {
			libraries: {
				findFirst: librariesFindFirst,
			},
			bookFiles: {
				findFirst: bookFilesFindFirst,
			},
			books: {
				findFirst: booksFindFirst,
			},
			authors: {
				findFirst: authorsFindFirst,
			},
			series: {
				findFirst: seriesFindFirst,
			},
			tags: {
				findFirst: tagsFindFirst,
			},
		},
	},
}));

vi.mock("src/server/extractors", () => ({
	extractMetadata: extractMetadataMock,
	getFileFormat: vi.fn((filePath: string) => {
		const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
		return ext;
	}),
	isSupportedFormat: isSupportedFormatMock,
}));

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetAllMocks();
});

describe("scanLibrary rescans", () => {
	test("updates series, authors, tags, and slug when metadata changes", async () => {
		const filePath = path.join("data", "library", "book.epub");
		const updateCalls: Array<{ table: unknown; values: unknown }> = [];
		const insertCalls: Array<{ table: unknown; values: unknown }> = [];
		const deleteCalls: unknown[] = [];
		const transactionalDb = {
			update: (table: unknown) => ({
				set: (values: unknown) => {
					updateCalls.push({ table, values });
					return {
						where: () => Promise.resolve(),
					};
				},
			}),
			insert: (table: unknown) => ({
				values: (values: unknown) => {
					insertCalls.push({ table, values });
					if (table === booksAuthors || table === booksTags) {
						return Promise.resolve();
					}
					throw new Error("unexpected transactional insert");
				},
			}),
			delete: (table: unknown) => {
				deleteCalls.push(table);
				return {
					where: () => Promise.resolve(),
				};
			},
		};

		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue({
			id: 1,
			bookId: 10,
			filePath,
			fileHash: "old-hash",
		});
		booksFindFirst.mockResolvedValue({
			id: 10,
			libraryId: 1,
		});
		seriesFindFirst.mockResolvedValue(null);
		authorsFindFirst.mockResolvedValue(null);
		tagsFindFirst.mockResolvedValue(null);

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ filePath }]),
				}),
			}),
		});
		dbUpdate.mockImplementation((table) => ({
			set: (values: unknown) => {
				updateCalls.push({ table, values });
				return {
					where: () => Promise.resolve(),
				};
			},
		}));
		dbDelete.mockImplementation((table) => {
			deleteCalls.push(table);
			return {
				where: () => Promise.resolve(),
			};
		});
		dbInsert.mockImplementation((table) => ({
			values: (values: unknown) => {
				insertCalls.push({ table, values });
				if (table === series) {
					return {
						returning: () => Promise.resolve([{ id: 41 }]),
					};
				}
				if (table === authors) {
					return {
						returning: () => Promise.resolve([{ id: 42 }]),
					};
				}
				if (table === tags) {
					return {
						returning: () => Promise.resolve([{ id: 43 }]),
					};
				}
				return Promise.resolve();
			},
		}));
		dbTransaction.mockImplementation(async (callback) =>
			callback(transactionalDb),
		);

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "New Title",
				authors: ["New Author"],
				tags: ["Sci-Fi"],
				series: "Saga",
				seriesIndex: 2,
			},
			cover: null,
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);
		const createReadStreamSpy = vi
			.spyOn(fs, "createReadStream")
			.mockReturnValue(Readable.from(["content"]) as fs.ReadStream);

		const { scanLibrary } = await import("src/server/scanner");

		await scanLibrary(1);

		expect(updateCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					table: books,
					values: expect.objectContaining({
						title: "New Title",
						slug: "new-title",
						seriesId: 41,
						seriesIndex: 2,
					}),
				}),
				expect.objectContaining({
					values: expect.objectContaining({
						md5Hash: "9a0364b9e99bb480dd25e1f0284c8555",
					}),
				}),
			]),
		);
		expect(createReadStreamSpy).toHaveBeenCalledWith(filePath);
		expect(booksFindFirst).toHaveBeenCalled();
		expect(deleteCalls).toEqual(
			expect.arrayContaining([booksAuthors, booksTags]),
		);
		expect(dbTransaction).toHaveBeenCalledTimes(1);
		expect(insertCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					table: booksAuthors,
					values: { bookId: 10, authorId: 42, role: "author" },
				}),
				expect.objectContaining({
					table: booksTags,
					values: { bookId: 10, tagId: 43 },
				}),
			]),
		);
	});

	test("updates cover image on rescan when metadata includes a new cover", async () => {
		const filePath = path.join("data", "library", "book.epub");
		const updateCalls: Array<{ table: unknown; values: unknown }> = [];
		const transactionalDb = {
			update: (table: unknown) => ({
				set: (values: unknown) => {
					updateCalls.push({ table, values });
					return { where: () => Promise.resolve() };
				},
			}),
			insert: (table: unknown) => ({
				values: () => {
					if (table === booksAuthors || table === booksTags) {
						return Promise.resolve();
					}
					throw new Error("unexpected transactional insert");
				},
			}),
			delete: () => ({ where: () => Promise.resolve() }),
		};

		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue({
			id: 1,
			bookId: 10,
			filePath,
			fileHash: "old-hash",
		});
		booksFindFirst.mockResolvedValue({ id: 10, libraryId: 1 });
		seriesFindFirst.mockResolvedValue(null);
		authorsFindFirst.mockResolvedValue({ id: 1 });
		tagsFindFirst.mockResolvedValue(null);

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ filePath }]),
				}),
			}),
		});
		dbUpdate.mockImplementation(() => ({
			set: (values: unknown) => {
				updateCalls.push({ table: "books_or_files", values });
				return { where: () => Promise.resolve() };
			},
		}));
		dbInsert.mockImplementation((table) => ({
			values: () => {
				if (table === tags) {
					return { returning: () => Promise.resolve([{ id: 43 }]) };
				}
				return Promise.resolve();
			},
		}));
		dbTransaction.mockImplementation(async (callback) =>
			callback(transactionalDb),
		);

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "Updated Book",
				authors: ["Author"],
				tags: [],
				series: null,
				seriesIndex: null,
			},
			cover: {
				data: Buffer.from("newcoverdata"),
				extension: "jpg",
				mimeType: "image/jpeg",
			},
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["content"]) as fs.ReadStream,
		);
		const mkdirSpy = vi.spyOn(fs, "mkdirSync").mockReturnValue(undefined);
		const writeFileSpy = vi
			.spyOn(fs, "writeFileSync")
			.mockReturnValue(undefined);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.updated).toBe(1);
		expect(mkdirSpy).toHaveBeenCalled();
		expect(writeFileSpy).toHaveBeenCalled();
	});

	test("rescans tolerate duplicate authors and tags in metadata", async () => {
		const filePath = path.join("data", "library", "book.epub");
		const insertCalls: Array<{ table: unknown; values: unknown }> = [];
		const seenAuthorLinks = new Set<string>();
		const seenTagLinks = new Set<string>();
		const transactionalDb = {
			update: () => ({
				set: () => ({
					where: () => Promise.resolve(),
				}),
			}),
			insert: (table: unknown) => ({
				values: (values: unknown) => {
					insertCalls.push({ table, values });
					if (table === booksAuthors) {
						const key = JSON.stringify(values);
						if (seenAuthorLinks.has(key)) {
							return Promise.reject(new Error("duplicate author link"));
						}
						seenAuthorLinks.add(key);
						return Promise.resolve();
					}
					if (table === booksTags) {
						const key = JSON.stringify(values);
						if (seenTagLinks.has(key)) {
							return Promise.reject(new Error("duplicate tag link"));
						}
						seenTagLinks.add(key);
						return Promise.resolve();
					}
					throw new Error("unexpected transactional insert");
				},
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
		};

		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue({
			id: 1,
			bookId: 10,
			filePath,
			fileHash: "old-hash",
		});
		booksFindFirst.mockResolvedValue({
			id: 10,
			libraryId: 1,
		});
		seriesFindFirst.mockResolvedValue(null);
		authorsFindFirst.mockImplementation(async () => null);
		tagsFindFirst.mockImplementation(async () => null);

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ filePath }]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});
		dbInsert.mockImplementation((table) => ({
			values: () => {
				if (table === authors) {
					return {
						returning: () => Promise.resolve([{ id: 42 }]),
					};
				}
				if (table === tags) {
					return {
						returning: () => Promise.resolve([{ id: 43 }]),
					};
				}
				throw new Error("unexpected insert");
			},
		}));
		dbTransaction.mockImplementation(async (callback) =>
			callback(transactionalDb),
		);

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "New Title",
				authors: ["New Author", "New Author"],
				tags: ["Sci-Fi", "Sci-Fi"],
				series: null,
				seriesIndex: null,
			},
			cover: null,
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["content"]) as fs.ReadStream,
		);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(dbTransaction).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			added: 0,
			updated: 1,
			missing: 0,
		});
		expect(
			insertCalls.filter((call) => call.table === booksAuthors),
		).toHaveLength(1);
		expect(insertCalls.filter((call) => call.table === booksTags)).toHaveLength(
			1,
		);
	});
});

describe("scanLibrary new files", () => {
	test("adds a new book file when it is not in the database", async () => {
		const insertCalls: Array<{ table: unknown; values: unknown }> = [];

		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		// File not found in DB → new file
		bookFilesFindFirst.mockResolvedValue(null);
		authorsFindFirst.mockResolvedValue(null);
		seriesFindFirst.mockResolvedValue(null);
		tagsFindFirst.mockResolvedValue(null);

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockImplementation(() => ({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		}));
		dbInsert.mockImplementation((table) => ({
			values: (values: unknown) => {
				insertCalls.push({ table, values });
				if (table === books) {
					return {
						returning: () => Promise.resolve([{ id: 100 }]),
					};
				}
				if (table === authors) {
					return {
						returning: () => Promise.resolve([{ id: 200 }]),
					};
				}
				if (table === tags) {
					return {
						returning: () => Promise.resolve([{ id: 300 }]),
					};
				}
				// bookFiles
				return {
					returning: () => Promise.resolve([{ id: 50 }]),
					run: () => undefined,
				};
			},
			run: () => undefined,
		}));

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "The New Book",
				authors: ["Author One"],
				tags: ["Fantasy"],
				series: null,
				seriesIndex: null,
				description: "A description",
				language: "en",
				publisher: "Publisher",
				publishDate: "2026-01-01",
				pageCount: 200,
			},
			cover: {
				data: Buffer.from("fakeimage"),
				extension: "jpg",
				mimeType: "image/jpeg",
			},
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "newbook.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 5000,
			mtimeMs: 1000,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["content"]) as fs.ReadStream,
		);
		vi.spyOn(fs, "mkdirSync").mockReturnValue(undefined);
		vi.spyOn(fs, "writeFileSync").mockReturnValue(undefined);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.added).toBe(1);
		expect(result.updated).toBe(0);
		// Cover was saved
		expect(fs.mkdirSync).toHaveBeenCalled();
		expect(fs.writeFileSync).toHaveBeenCalled();
		// Book insert includes sort title and slug
		const bookInsert = insertCalls.find((c) => c.table === books);
		expect(bookInsert).toBeDefined();
		expect((bookInsert?.values as Record<string, unknown>).sortTitle).toBe(
			"New Book",
		);
		expect((bookInsert?.values as Record<string, unknown>).slug).toBe(
			"the-new-book",
		);
	});

	test("counts missing files (in DB but not on disk)", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () =>
						Promise.resolve([
							{ filePath: "data/library/exists.epub" },
							{ filePath: "data/library/missing.epub" },
						]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		isSupportedFormatMock.mockReturnValue(true);
		bookFilesFindFirst.mockResolvedValue({
			id: 1,
			bookId: 1,
			fileHash: "same",
		});

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "exists.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.missing).toBe(1);
	});

	test("throws when library is not found", async () => {
		librariesFindFirst.mockResolvedValue(null);

		const { scanLibrary } = await import("src/server/scanner");

		await expect(scanLibrary(999)).rejects.toThrow("Library 999 not found");
	});

	test("skips unsupported file formats during scanning", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		isSupportedFormatMock.mockReturnValue(false);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "readme.txt",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.added).toBe(0);
		expect(result.updated).toBe(0);
		expect(extractMetadataMock).not.toHaveBeenCalled();
	});

	test("continues scanning after processNewFile errors", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue(null);

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		isSupportedFormatMock.mockReturnValue(true);
		extractMetadataMock.mockRejectedValue(new Error("extraction failed"));

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "bad.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 100,
			mtimeMs: 100,
		} as fs.Stats);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		// Error was caught, file not added
		expect(result.added).toBe(0);
	});

	test("catches error when book record is deleted during processUpdatedFile", async () => {
		const filePath = path.join("data", "library", "book.epub");
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue({
			id: 1,
			bookId: 10,
			filePath,
			fileHash: "old-hash",
		});
		// Book record not found (deleted between finding the file and updating)
		booksFindFirst.mockResolvedValue(null);

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ filePath }]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		isSupportedFormatMock.mockReturnValue(true);
		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "Test",
				authors: [],
				series: null,
			},
			cover: null,
		});

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["content"]) as fs.ReadStream,
		);

		const { scanLibrary } = await import("src/server/scanner");

		// The error should be caught (non-fatal), so scanning continues
		const result = await scanLibrary(1);

		expect(result.updated).toBe(0);
	});

	test("continues scanning after processUpdatedFile errors", async () => {
		const filePath = path.join("data", "library", "book.epub");
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue({
			id: 1,
			bookId: 10,
			filePath,
			fileHash: "old-hash",
		});

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{ filePath }]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		isSupportedFormatMock.mockReturnValue(true);
		extractMetadataMock.mockRejectedValue(new Error("extraction failed"));

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		// Error was caught, file not updated
		expect(result.updated).toBe(0);
	});

	test("handles walkDir with unreadable directory", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		vi.spyOn(fs, "readdirSync").mockImplementation(() => {
			throw new Error("EACCES");
		});

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.added).toBe(0);
		expect(result.updated).toBe(0);
		expect(result.missing).toBe(0);
	});

	test("walks subdirectories recursively", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue(null);
		authorsFindFirst.mockResolvedValue({ id: 1 });

		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});
		dbInsert.mockImplementation((table) => ({
			values: () => {
				if (table === books) {
					return { returning: () => Promise.resolve([{ id: 100 }]) };
				}
				return {
					returning: () => Promise.resolve([{ id: 50 }]),
					run: () => undefined,
				};
			},
			run: () => undefined,
		}));

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "A Book Title",
				authors: [],
				tags: [],
				series: null,
				seriesIndex: null,
			},
			cover: null,
		});
		isSupportedFormatMock.mockReturnValue(true);

		let callCount = 0;
		vi.spyOn(fs, "readdirSync").mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return [
					{
						name: "subdir",
						isDirectory: () => true,
						isFile: () => false,
					},
				] as unknown as ReturnType<typeof fs.readdirSync>;
			}
			return [
				{
					name: "deep.epub",
					isDirectory: () => false,
					isFile: () => true,
				},
			] as unknown as ReturnType<typeof fs.readdirSync>;
		});
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 100,
			mtimeMs: 100,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["content"]) as fs.ReadStream,
		);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.added).toBe(1);
	});
});

describe("scanAllLibraries", () => {
	test("scans all libraries and aggregates results", async () => {
		dbSelect.mockReturnValue({
			from: () =>
				Promise.resolve([
					{ id: 1, scanPaths: ["lib1"] },
					{ id: 2, scanPaths: ["lib2"] },
				]),
		});
		librariesFindFirst.mockImplementation(async () => ({
			id: 1,
			name: "Lib",
			type: "book",
			scanPaths: ["lib"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		}));

		// Make scanLibrary return quickly with no files
		vi.spyOn(fs, "readdirSync").mockImplementation(() => {
			throw new Error("EACCES");
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});
		// For allLibraryFiles query in scanLibrary
		const selectFromInnerJoinWhere = {
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		};
		// First call returns libraries list, subsequent calls return files
		let selectCallCount = 0;
		dbSelect.mockImplementation(() => {
			selectCallCount++;
			if (selectCallCount === 1) {
				return {
					from: () =>
						Promise.resolve([
							{ id: 1, scanPaths: ["lib1"] },
							{ id: 2, scanPaths: ["lib2"] },
						]),
				};
			}
			return selectFromInnerJoinWhere;
		});

		const { scanAllLibraries } = await import("src/server/scanner");

		const result = await scanAllLibraries();

		expect(result.added).toBe(0);
		expect(result.updated).toBe(0);
		expect(result.missing).toBe(0);
	});
});

describe("buildSortTitle", () => {
	test("strips 'The ' prefix", async () => {
		const { scanLibrary } = await import("src/server/scanner");

		// Indirectly test via the new file path
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue(null);
		authorsFindFirst.mockResolvedValue({ id: 1 });

		const insertCalls: Array<{ table: unknown; values: unknown }> = [];
		dbInsert.mockImplementation((table) => ({
			values: (values: unknown) => {
				insertCalls.push({ table, values });
				if (table === books) {
					return { returning: () => Promise.resolve([{ id: 100 }]) };
				}
				return {
					returning: () => Promise.resolve([{ id: 50 }]),
					run: () => undefined,
				};
			},
			run: () => undefined,
		}));
		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => Promise.resolve(),
			}),
		});

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "An Amazing Book",
				authors: [],
				series: null,
			},
			cover: null,
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 100,
			mtimeMs: 100,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["c"]) as fs.ReadStream,
		);

		await scanLibrary(1);

		const bookInsert = insertCalls.find((c) => c.table === books);
		// "An Amazing Book" → strips "An " → "Amazing Book"
		expect((bookInsert?.values as Record<string, unknown>).sortTitle).toBe(
			"Amazing Book",
		);
	});
});

describe("single-name authors and existing entities", () => {
	test("handles single-name author (no space) in buildAuthorSortName", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue(null);
		// Author not found - triggers create with buildAuthorSortName
		authorsFindFirst.mockResolvedValue(null);
		tagsFindFirst.mockResolvedValue(null);

		const insertCalls: Array<{ table: unknown; values: unknown }> = [];
		dbInsert.mockImplementation((table) => ({
			values: (values: unknown) => {
				insertCalls.push({ table, values });
				if (table === books) {
					return { returning: () => Promise.resolve([{ id: 100 }]) };
				}
				if (table === authors) {
					return { returning: () => Promise.resolve([{ id: 200 }]) };
				}
				if (table === tags) {
					return { returning: () => Promise.resolve([{ id: 300 }]) };
				}
				return {
					returning: () => Promise.resolve([{ id: 50 }]),
					run: () => undefined,
				};
			},
			run: () => undefined,
		}));
		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({ where: () => Promise.resolve() }),
		});

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "A Book",
				authors: ["Madonna"],
				tags: [],
				series: null,
				seriesIndex: null,
			},
			cover: null,
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 100,
			mtimeMs: 100,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["c"]) as fs.ReadStream,
		);

		const { scanLibrary } = await import("src/server/scanner");

		await scanLibrary(1);

		// Single-name author: sortName should be the same as name
		const authorInsert = insertCalls.find((c) => c.table === authors);
		expect(authorInsert).toBeDefined();
		expect((authorInsert?.values as Record<string, unknown>).sortName).toBe(
			"Madonna",
		);
	});

	test("uses existing author and series when they already exist", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["library"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		bookFilesFindFirst.mockResolvedValue(null);
		// Author exists
		authorsFindFirst.mockResolvedValue({ id: 42 });
		// Series exists
		seriesFindFirst.mockResolvedValue({ id: 99 });
		tagsFindFirst.mockResolvedValue({ id: 77 });

		const insertCalls: Array<{ table: unknown; values: unknown }> = [];
		dbInsert.mockImplementation((table) => ({
			values: (values: unknown) => {
				insertCalls.push({ table, values });
				if (table === books) {
					return { returning: () => Promise.resolve([{ id: 100 }]) };
				}
				return {
					returning: () => Promise.resolve([{ id: 50 }]),
					run: () => undefined,
				};
			},
			run: () => undefined,
		}));
		dbSelect.mockReturnValue({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({ where: () => Promise.resolve() }),
		});

		extractMetadataMock.mockResolvedValue({
			metadata: {
				title: "Series Book",
				authors: ["Known Author"],
				tags: ["Existing Tag"],
				series: "Known Series",
				seriesIndex: 2,
			},
			cover: null,
		});
		isSupportedFormatMock.mockReturnValue(true);

		vi.spyOn(fs, "readdirSync").mockReturnValue([
			{
				name: "book.epub",
				isDirectory: () => false,
				isFile: () => true,
			},
		] as unknown as ReturnType<typeof fs.readdirSync>);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 100,
			mtimeMs: 100,
		} as fs.Stats);
		vi.spyOn(fs, "createReadStream").mockReturnValue(
			Readable.from(["c"]) as fs.ReadStream,
		);

		const { scanLibrary } = await import("src/server/scanner");

		const result = await scanLibrary(1);

		expect(result.added).toBe(1);
		// Book should have the existing series ID
		const bookInsert = insertCalls.find((c) => c.table === books);
		expect((bookInsert?.values as Record<string, unknown>).seriesId).toBe(99);
		// No new author or series should be inserted
		expect(insertCalls.filter((c) => c.table === authors)).toHaveLength(0);
		expect(insertCalls.filter((c) => c.table === series)).toHaveLength(0);
	});
});
