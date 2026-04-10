import { beforeEach, describe, expect, test, vi } from "vitest";

const mockIsValidLibraryScanPath = vi.hoisted(() => vi.fn());

vi.mock("src/server/path-safety", () => ({
	isValidLibraryScanPath: mockIsValidLibraryScanPath,
}));

import {
	createCollectionSchema,
	createLibrarySchema,
	createReadingListSchema,
	createShelfSchema,
	updateLibrarySchema,
} from "./validators";

beforeEach(() => {
	vi.resetAllMocks();
	mockIsValidLibraryScanPath.mockReturnValue(true);
});

describe("createShelfSchema", () => {
	test("accepts valid manual shelf", () => {
		const result = createShelfSchema.parse({
			name: "Favorites",
			type: "manual",
		});
		expect(result).toEqual({ name: "Favorites", type: "manual" });
	});

	test("accepts valid smart shelf with filter rules", () => {
		const result = createShelfSchema.parse({
			name: "Recent",
			type: "smart",
			filterRules: { author: "Sanderson" },
		});
		expect(result).toEqual({
			name: "Recent",
			type: "smart",
			filterRules: { author: "Sanderson" },
		});
	});

	test("rejects empty name", () => {
		expect(() =>
			createShelfSchema.parse({ name: "", type: "manual" }),
		).toThrow();
	});

	test("rejects invalid type", () => {
		expect(() =>
			createShelfSchema.parse({ name: "Test", type: "invalid" }),
		).toThrow();
	});

	test("filterRules is optional", () => {
		const result = createShelfSchema.parse({
			name: "My Shelf",
			type: "smart",
		});
		expect(result.filterRules).toBeUndefined();
	});
});

describe("createCollectionSchema", () => {
	test("accepts valid collection", () => {
		const result = createCollectionSchema.parse({ name: "Sci-Fi" });
		expect(result).toEqual({ name: "Sci-Fi" });
	});

	test("rejects empty name", () => {
		expect(() => createCollectionSchema.parse({ name: "" })).toThrow();
	});

	test("rejects missing name", () => {
		expect(() => createCollectionSchema.parse({})).toThrow();
	});
});

describe("createReadingListSchema", () => {
	test("accepts valid reading list", () => {
		const result = createReadingListSchema.parse({
			name: "Summer Reading",
		});
		expect(result).toEqual({ name: "Summer Reading" });
	});

	test("rejects empty name", () => {
		expect(() => createReadingListSchema.parse({ name: "" })).toThrow();
	});

	test("rejects missing name", () => {
		expect(() => createReadingListSchema.parse({})).toThrow();
	});
});

describe("createLibrarySchema", () => {
	test("accepts valid library input", () => {
		const result = createLibrarySchema.parse({
			name: "My Library",
			type: "book",
			scanPaths: ["books/fiction"],
			scanInterval: 60,
		});
		expect(result).toEqual({
			name: "My Library",
			type: "book",
			scanPaths: ["books/fiction"],
			scanInterval: 60,
		});
		expect(mockIsValidLibraryScanPath).toHaveBeenCalledWith("books/fiction");
	});

	test("applies default scanInterval of 30", () => {
		const result = createLibrarySchema.parse({
			name: "My Library",
			type: "book",
			scanPaths: ["books"],
		});
		expect(result.scanInterval).toBe(30);
	});

	test("accepts all valid library types", () => {
		for (const type of ["book", "comic", "manga"]) {
			const result = createLibrarySchema.parse({
				name: "Library",
				type,
				scanPaths: ["path"],
			});
			expect(result.type).toBe(type);
		}
	});

	test("rejects invalid library type", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "audiobook",
				scanPaths: ["path"],
			}),
		).toThrow();
	});

	test("rejects empty name", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "",
				type: "book",
				scanPaths: ["path"],
			}),
		).toThrow();
	});

	test("rejects empty scanPaths array", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: [],
			}),
		).toThrow();
	});

	test("rejects invalid scan paths via isValidLibraryScanPath", () => {
		mockIsValidLibraryScanPath.mockReturnValue(false);
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["/etc/passwd"],
			}),
		).toThrow();
	});

	test("rejects scanInterval less than 1", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["path"],
				scanInterval: 0,
			}),
		).toThrow();
	});

	test("rejects non-integer scanInterval", () => {
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["path"],
				scanInterval: 1.5,
			}),
		).toThrow();
	});

	test("validates each scan path individually", () => {
		mockIsValidLibraryScanPath
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false);
		expect(() =>
			createLibrarySchema.parse({
				name: "Library",
				type: "book",
				scanPaths: ["valid", "invalid"],
			}),
		).toThrow();
	});
});

describe("updateLibrarySchema", () => {
	test("requires id", () => {
		expect(() => updateLibrarySchema.parse({})).toThrow();
	});

	test("accepts only id with no other fields", () => {
		const result = updateLibrarySchema.parse({ id: 1 });
		expect(result.id).toBe(1);
	});

	test("accepts partial update with id", () => {
		const result = updateLibrarySchema.parse({
			id: 1,
			name: "Updated Name",
		});
		expect(result.id).toBe(1);
		expect(result.name).toBe("Updated Name");
	});

	test("validates scan paths when provided", () => {
		mockIsValidLibraryScanPath.mockReturnValue(false);
		expect(() =>
			updateLibrarySchema.parse({
				id: 1,
				scanPaths: ["/etc"],
			}),
		).toThrow();
	});

	test("rejects non-integer id", () => {
		expect(() => updateLibrarySchema.parse({ id: 1.5 })).toThrow();
	});
});
