import { describe, expect, test } from "vitest";
import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
	test("has all expected top-level namespaces", () => {
		const expectedNamespaces = [
			"books",
			"libraries",
			"shelves",
			"collections",
			"readingLists",
			"authors",
			"series",
			"search",
			"continueReading",
			"jobs",
			"scan",
			"reading",
		];
		for (const ns of expectedNamespaces) {
			expect(queryKeys).toHaveProperty(ns);
		}
	});

	describe("libraries", () => {
		test("all returns base key", () => {
			expect(queryKeys.libraries.all).toEqual(["libraries"]);
		});

		test("list returns list key", () => {
			expect(queryKeys.libraries.list()).toEqual(["libraries", "list"]);
		});

		test("detail includes id", () => {
			expect(queryKeys.libraries.detail(5)).toEqual(["libraries", "detail", 5]);
		});
	});

	describe("books", () => {
		test("all returns base key", () => {
			expect(queryKeys.books.all).toEqual(["books"]);
		});

		test("list returns key with libraryId", () => {
			expect(queryKeys.books.list(1)).toEqual(["books", "list", 1]);
		});

		test("list returns key with libraryId and search", () => {
			expect(queryKeys.books.list(1, "tolkien")).toEqual([
				"books",
				"list",
				1,
				"tolkien",
			]);
		});

		test("list omits search when undefined", () => {
			expect(queryKeys.books.list(1, undefined)).toEqual(["books", "list", 1]);
		});

		test("detail includes id", () => {
			expect(queryKeys.books.detail(42)).toEqual(["books", "detail", 42]);
		});

		test("recent uses default limit of 12", () => {
			expect(queryKeys.books.recent()).toEqual(["books", "recent", 12]);
		});

		test("recent uses provided limit", () => {
			expect(queryKeys.books.recent(5)).toEqual(["books", "recent", 5]);
		});
	});

	describe("authors", () => {
		test("all returns base key", () => {
			expect(queryKeys.authors.all).toEqual(["authors"]);
		});

		test("detail includes id", () => {
			expect(queryKeys.authors.detail(3)).toEqual(["authors", "detail", 3]);
		});
	});

	describe("series", () => {
		test("all returns base key", () => {
			expect(queryKeys.series.all).toEqual(["series"]);
		});

		test("detail includes id", () => {
			expect(queryKeys.series.detail(7)).toEqual(["series", "detail", 7]);
		});
	});

	describe("shelves", () => {
		test("all returns base key", () => {
			expect(queryKeys.shelves.all).toEqual(["shelves"]);
		});

		test("list returns list key", () => {
			expect(queryKeys.shelves.list()).toEqual(["shelves", "list"]);
		});

		test("detail includes id", () => {
			expect(queryKeys.shelves.detail(2)).toEqual(["shelves", "detail", 2]);
		});

		test("books includes shelf id", () => {
			expect(queryKeys.shelves.books(2)).toEqual(["shelves", "books", 2]);
		});
	});

	describe("collections", () => {
		test("all returns base key", () => {
			expect(queryKeys.collections.all).toEqual(["collections"]);
		});

		test("list returns list key", () => {
			expect(queryKeys.collections.list()).toEqual(["collections", "list"]);
		});

		test("detail includes id", () => {
			expect(queryKeys.collections.detail(4)).toEqual([
				"collections",
				"detail",
				4,
			]);
		});

		test("books includes collection id", () => {
			expect(queryKeys.collections.books(4)).toEqual([
				"collections",
				"books",
				4,
			]);
		});
	});

	describe("readingLists", () => {
		test("all returns base key", () => {
			expect(queryKeys.readingLists.all).toEqual(["readingLists"]);
		});

		test("list returns list key", () => {
			expect(queryKeys.readingLists.list()).toEqual(["readingLists", "list"]);
		});

		test("detail includes id", () => {
			expect(queryKeys.readingLists.detail(6)).toEqual([
				"readingLists",
				"detail",
				6,
			]);
		});

		test("books includes reading list id", () => {
			expect(queryKeys.readingLists.books(6)).toEqual([
				"readingLists",
				"books",
				6,
			]);
		});
	});

	describe("search", () => {
		test("results includes query", () => {
			expect(queryKeys.search.results("fantasy")).toEqual([
				"search",
				"results",
				"fantasy",
			]);
		});
	});

	describe("continueReading", () => {
		test("list returns list key", () => {
			expect(queryKeys.continueReading.list()).toEqual([
				"continueReading",
				"list",
			]);
		});
	});

	describe("jobs", () => {
		test("all returns base key", () => {
			expect(queryKeys.jobs.all).toEqual(["jobs"]);
		});

		test("list returns list key", () => {
			expect(queryKeys.jobs.list()).toEqual(["jobs", "list"]);
		});
	});

	describe("scan", () => {
		test("status includes library id", () => {
			expect(queryKeys.scan.status(10)).toEqual(["scan", "status", 10]);
		});
	});

	describe("reading", () => {
		test("progress includes book id", () => {
			expect(queryKeys.reading.progress(99)).toEqual([
				"reading",
				"progress",
				99,
			]);
		});
	});

	describe("key uniqueness", () => {
		test("all base keys are unique across namespaces", () => {
			const allKeys = Object.values(queryKeys).map((ns) => {
				if ("all" in ns) return (ns as { all: readonly string[] }).all[0];
				// Namespaces without 'all' use their first key factory
				const firstFactory = Object.values(ns)[0];
				if (typeof firstFactory === "function") {
					const result = firstFactory(1);
					return result[0];
				}
				return undefined;
			});
			const uniqueKeys = new Set(allKeys);
			expect(uniqueKeys.size).toBe(allKeys.length);
		});
	});
});
