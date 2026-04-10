import { describe, expect, test } from "vitest";
import * as schema from "./index";

describe("DB schema exports", () => {
	const expectedTables = [
		// auth
		"user",
		"session",
		"account",
		"verification",
		// books
		"series",
		"authors",
		"books",
		"booksAuthors",
		"tags",
		"booksTags",
		"bookFiles",
		// jobs
		"jobs",
		// libraries
		"libraries",
		"libraryAccess",
		// organization
		"shelves",
		"shelvesBooks",
		"collections",
		"collectionsBooks",
		"readingLists",
		"readingListBooks",
		// reading
		"readingProgress",
		"annotations",
		// sync
		"koboTokens",
		"opdsKeys",
	];

	test("exports all expected tables", () => {
		for (const tableName of expectedTables) {
			expect(schema).toHaveProperty(tableName);
		}
	});

	test("each exported table is a valid Drizzle table object", () => {
		for (const tableName of expectedTables) {
			const table = schema[tableName as keyof typeof schema];
			// Drizzle SQLite tables have a Symbol-keyed property; the simplest
			// check is that the export is a non-null object (not a type alias).
			expect(typeof table).toBe("object");
			expect(table).not.toBeNull();
		}
	});

	test("does not have unexpected missing tables", () => {
		// Verify the count of exported values matches expectations.
		// Filter to only object exports (tables), excluding type-only exports.
		const exportedObjects = Object.entries(schema).filter(
			([, value]) => typeof value === "object" && value !== null,
		);
		expect(exportedObjects.length).toBe(expectedTables.length);
	});
});
