import fs from "node:fs";
import path from "node:path";
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

const extractMetadataMock = vi.fn();
const isSupportedFormatMock = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
		update: dbUpdate,
		insert: dbInsert,
		delete: dbDelete,
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
	getFileFormat: vi.fn(),
	isSupportedFormat: isSupportedFormatMock,
}));

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.resetAllMocks();
});

describe("scanLibrary rescans", () => {
	test("updates series, authors, tags, and slug when metadata changes", async () => {
		const filePath = path.join("data", "library", "book.epub");
		const updateCalls: Array<{ table: unknown; values: unknown }> = [];
		const insertCalls: Array<{ table: unknown; values: unknown }> = [];
		const deleteCalls: unknown[] = [];

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
			} as fs.Dirent,
		]);
		vi.spyOn(fs, "statSync").mockReturnValue({
			size: 123,
			mtimeMs: 456,
		} as fs.Stats);
		vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("content"));

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
			]),
		);
		expect(booksFindFirst).toHaveBeenCalled();
		expect(deleteCalls).toEqual(
			expect.arrayContaining([booksAuthors, booksTags]),
		);
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
});
