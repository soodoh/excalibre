import fs from "node:fs";
import { createLibrarySchema } from "src/lib/validators";
import { resolveLibraryScanPath } from "src/server/path-safety";
import { afterEach, describe, expect, test, vi } from "vitest";

const librariesFindFirst = vi.fn();
const dbSelect = vi.fn();
const dbUpdate = vi.fn();

vi.mock("src/db", () => ({
	db: {
		select: dbSelect,
		update: dbUpdate,
		query: {
			libraries: {
				findFirst: librariesFindFirst,
			},
		},
	},
}));

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetAllMocks();
	dbSelect.mockReset();
	dbUpdate.mockReset();
});

describe("resolveLibraryScanPath", () => {
	test("rejects absolute scan paths", () => {
		expect(() => resolveLibraryScanPath("data", "/etc")).toThrow(/absolute/i);
	});

	test("rejects parent traversal", () => {
		expect(() => resolveLibraryScanPath("data", "../private")).toThrow(
			/escape/i,
		);
	});

	test("rejects Windows drive-letter absolute paths", () => {
		expect(() => resolveLibraryScanPath("data", "C:\\private")).toThrow(
			/absolute/i,
		);
	});

	test("rejects UNC absolute paths", () => {
		expect(() => resolveLibraryScanPath("data", "\\\\server\\share")).toThrow(
			/absolute/i,
		);
	});

	test("allows normalized relative paths", () => {
		expect(resolveLibraryScanPath("data", "books/fiction")).toBe(
			"data/books/fiction",
		);
	});
});

describe("createLibrarySchema", () => {
	test("rejects absolute scan paths", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["/etc"],
				scanInterval: 30,
			}),
		).toThrow(/DATA_DIR/);
	});

	test("rejects parent traversal scan paths", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["../private"],
				scanInterval: 30,
			}),
		).toThrow(/DATA_DIR/);
	});

	test("rejects Windows drive-letter scan paths", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["C:\\private"],
				scanInterval: 30,
			}),
		).toThrow(/DATA_DIR/);
	});
});

describe("scanLibrary", () => {
	test("rejects a persisted invalid scan path before traversing the filesystem", async () => {
		librariesFindFirst.mockResolvedValue({
			id: 1,
			name: "Library",
			type: "book",
			scanPaths: ["C:\\private"],
			scanInterval: 30,
			lastScannedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const readdirSpy = vi.spyOn(fs, "readdirSync").mockReturnValue([]);
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

		const { scanLibrary } = await import("src/server/scanner");

		await expect(scanLibrary(1)).rejects.toThrow(/absolute/i);
		expect(readdirSpy).not.toHaveBeenCalled();
	});
});
