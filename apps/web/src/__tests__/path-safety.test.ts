import { createLibrarySchema } from "src/lib/validators";
import { resolveLibraryScanPath } from "src/server/path-safety";
import { describe, expect, test } from "vitest";

describe("resolveLibraryScanPath", () => {
	test("rejects absolute scan paths", () => {
		expect(() => resolveLibraryScanPath("data", "/etc")).toThrow(/absolute/i);
	});

	test("rejects parent traversal", () => {
		expect(() => resolveLibraryScanPath("data", "../private")).toThrow(
			/escape/i,
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
});
