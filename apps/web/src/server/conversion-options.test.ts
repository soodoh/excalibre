import { getSupportedConversions } from "src/server/conversion-options";
import { describe, expect, test } from "vitest";

describe("getSupportedConversions", () => {
	test("returns pandoc targets plus kepub for epub source", () => {
		const result = getSupportedConversions("epub");
		expect(result).toContain("kepub");
		expect(result).toContain("mobi");
		expect(result).toContain("pdf");
		expect(result).toContain("docx");
		expect(result).toContain("html");
		expect(result).toContain("txt");
		expect(result).toHaveLength(6);
	});

	test("returns pandoc targets without kepub for mobi source", () => {
		const result = getSupportedConversions("mobi");
		expect(result).not.toContain("kepub");
		expect(result).toContain("epub");
		expect(result).toContain("pdf");
		expect(result).toContain("docx");
		expect(result).toContain("html");
		expect(result).toContain("txt");
		expect(result).toHaveLength(5);
	});

	test("handles docx source format", () => {
		const result = getSupportedConversions("docx");
		expect(result).toEqual(
			expect.arrayContaining(["epub", "pdf", "html", "txt"]),
		);
		expect(result).toHaveLength(4);
	});

	test("handles html source format", () => {
		const result = getSupportedConversions("html");
		expect(result).toEqual(
			expect.arrayContaining(["epub", "pdf", "docx", "txt"]),
		);
		expect(result).toHaveLength(4);
	});

	test("handles txt source format", () => {
		const result = getSupportedConversions("txt");
		expect(result).toEqual(expect.arrayContaining(["epub", "html", "docx"]));
		expect(result).toHaveLength(3);
	});

	test("returns empty array for unknown format", () => {
		expect(getSupportedConversions("xyz")).toEqual([]);
		expect(getSupportedConversions("mp3")).toEqual([]);
	});

	test("is case-insensitive", () => {
		const lower = getSupportedConversions("epub");
		const upper = getSupportedConversions("EPUB");
		const mixed = getSupportedConversions("Epub");
		expect(upper).toEqual(lower);
		expect(mixed).toEqual(lower);
	});

	test("kepub appears first for epub (added before pandoc targets)", () => {
		const result = getSupportedConversions("epub");
		expect(result[0]).toBe("kepub");
	});
});
