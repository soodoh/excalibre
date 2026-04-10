import { describe, expect, test, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("src/db", () => ({
	db: {
		query: {
			opdsKeys: { findFirst: vi.fn() },
		},
	},
}));

vi.mock("src/server/access-control", () => ({
	getAccessibleLibraries: vi.fn(),
	getAccessibleLibraryIds: vi.fn(),
}));

vi.mock("src/server/kosync", () => ({
	verifyStatelessCredentials: vi.fn(),
}));

import {
	BOOK_MIME_TYPES,
	escapeXml,
	opdsBookEntry,
	opdsFooter,
	opdsHeader,
	opdsNavigationEntry,
	opdsXmlResponse,
} from "src/server/opds";

describe("opdsXmlResponse", () => {
	test("returns a Response with atom+xml content type", () => {
		const response = opdsXmlResponse("<feed/>");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(
			"application/atom+xml; charset=utf-8",
		);
	});
});

describe("escapeXml", () => {
	test("escapes ampersands", () => {
		expect(escapeXml("a&b")).toBe("a&amp;b");
	});

	test("escapes angle brackets", () => {
		expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
	});

	test("escapes double quotes", () => {
		expect(escapeXml('"hello"')).toBe("&quot;hello&quot;");
	});

	test("escapes single quotes", () => {
		expect(escapeXml("it's")).toBe("it&apos;s");
	});

	test("escapes all special characters together", () => {
		expect(escapeXml('a & b < c > d "e" f\'g')).toBe(
			"a &amp; b &lt; c &gt; d &quot;e&quot; f&apos;g",
		);
	});

	test("returns unchanged string when no special characters", () => {
		expect(escapeXml("hello world")).toBe("hello world");
	});
});

describe("opdsHeader", () => {
	test("builds a valid feed header with self, start, and search links", () => {
		const xml = opdsHeader(
			"urn:excalibre:root",
			"Root Feed",
			"https://example.com/api/opds",
			"https://example.com",
			undefined,
			new Date("2026-04-01T00:00:00.000Z"),
		);

		expect(xml).toContain("<id>urn:excalibre:root</id>");
		expect(xml).toContain("<title>Root Feed</title>");
		expect(xml).toContain("<updated>2026-04-01T00:00:00.000Z</updated>");
		expect(xml).toContain('rel="self"');
		expect(xml).toContain('rel="start"');
		expect(xml).toContain('rel="search"');
	});

	test("appends apikey when requestAuth is opds with apiKey", () => {
		const xml = opdsHeader(
			"urn:excalibre:root",
			"Root",
			"https://example.com/api/opds",
			"https://example.com",
			{ mode: "opds", userId: "u1", apiKey: "secret" },
		);

		expect(xml).toContain("apikey=secret");
	});

	test("uses current date when updated is not provided", () => {
		const xml = opdsHeader(
			"urn:test",
			"Test",
			"https://example.com",
			"https://example.com",
		);

		expect(xml).toContain("<updated>");
	});
});

describe("opdsFooter", () => {
	test("returns closing feed tag", () => {
		expect(opdsFooter()).toBe("</feed>");
	});
});

describe("opdsNavigationEntry", () => {
	test("builds an entry with subsection link", () => {
		const xml = opdsNavigationEntry(
			"urn:excalibre:lib:1",
			"My Library",
			"https://example.com/api/opds/libraries/1",
		);

		expect(xml).toContain("<id>urn:excalibre:lib:1</id>");
		expect(xml).toContain("<title>My Library</title>");
		expect(xml).toContain('rel="subsection"');
	});

	test("includes content element when provided", () => {
		const xml = opdsNavigationEntry(
			"urn:test",
			"Title",
			"https://example.com",
			undefined,
			"Some description",
		);

		expect(xml).toContain('<content type="text">Some description</content>');
	});

	test("omits content element when not provided", () => {
		const xml = opdsNavigationEntry("urn:test", "Title", "https://example.com");

		expect(xml).not.toContain("<content");
	});

	test("appends apikey when requestAuth is opds", () => {
		const xml = opdsNavigationEntry(
			"urn:test",
			"Title",
			"https://example.com/api/opds/lib/1",
			{ mode: "opds", userId: "u1", apiKey: "key123" },
		);

		expect(xml).toContain("apikey=key123");
	});
});

describe("opdsBookEntry", () => {
	const baseBook = {
		id: 42,
		title: "Test Book",
		description: "A great book",
		language: "en",
		publisher: "Publisher Inc",
		coverPath: "/covers/42.jpg",
		updatedAt: new Date("2026-04-01T00:00:00.000Z"),
		pageCount: null,
	};

	const baseFile = {
		id: 10,
		format: "epub",
		filePath: "/books/test.epub",
	};

	const baseAuthor = {
		id: 1,
		name: "Jane Author",
		role: "author",
	};

	test("builds a book entry with authors, language, publisher, and description", () => {
		const xml = opdsBookEntry(
			baseBook as never,
			[baseFile] as never,
			[baseAuthor],
			"https://example.com",
		);

		expect(xml).toContain("<id>urn:excalibre:book:42</id>");
		expect(xml).toContain("<title>Test Book</title>");
		expect(xml).toContain("<name>Jane Author</name>");
		expect(xml).toContain("<dc:language>en</dc:language>");
		expect(xml).toContain("<dc:publisher>Publisher Inc</dc:publisher>");
		expect(xml).toContain("<summary>A great book</summary>");
		expect(xml).toContain('rel="http://opds-spec.org/image"');
		expect(xml).toContain("application/epub+zip");
	});

	test("omits optional elements when not present", () => {
		const book = {
			...baseBook,
			description: null,
			language: null,
			publisher: null,
			coverPath: null,
		};

		const xml = opdsBookEntry(
			book as never,
			[baseFile] as never,
			[],
			"https://example.com",
		);

		expect(xml).not.toContain("<summary>");
		expect(xml).not.toContain("<dc:language>");
		expect(xml).not.toContain("<dc:publisher>");
		expect(xml).not.toContain('rel="http://opds-spec.org/image"');
	});

	test("uses fallback MIME type for unknown formats", () => {
		const file = { ...baseFile, format: "xyz" };

		const xml = opdsBookEntry(
			baseBook as never,
			[file] as never,
			[],
			"https://example.com",
		);

		expect(xml).toContain("application/octet-stream");
	});

	test("includes PSE stream link for CBZ with pageCount", () => {
		const book = { ...baseBook, pageCount: 24 };
		const file = { ...baseFile, id: 20, format: "cbz" };

		const xml = opdsBookEntry(
			book as never,
			[file] as never,
			[],
			"https://example.com",
		);

		expect(xml).toContain("http://vaemendis.net/opds-pse/stream");
		expect(xml).toContain('pse:count="24"');
	});

	test("appends apikey to acquisition URLs when requestAuth is opds", () => {
		const xml = opdsBookEntry(
			baseBook as never,
			[baseFile] as never,
			[],
			"https://example.com",
			{ mode: "opds", userId: "u1", apiKey: "secret" },
		);

		expect(xml).toContain("apikey=secret");
	});

	test("handles multiple authors", () => {
		const authorsList = [
			{ id: 1, name: "First Author", role: "author" },
			{ id: 2, name: "Second Author", role: "author" },
		];

		const xml = opdsBookEntry(
			baseBook as never,
			[baseFile] as never,
			authorsList,
			"https://example.com",
		);

		expect(xml).toContain("<name>First Author</name>");
		expect(xml).toContain("<name>Second Author</name>");
	});

	test("handles multiple files with different formats", () => {
		const files = [
			{ id: 10, format: "epub", filePath: "/books/test.epub" },
			{ id: 11, format: "pdf", filePath: "/books/test.pdf" },
		];

		const xml = opdsBookEntry(
			baseBook as never,
			files as never,
			[],
			"https://example.com",
		);

		expect(xml).toContain("application/epub+zip");
		expect(xml).toContain("application/pdf");
	});
});

describe("BOOK_MIME_TYPES", () => {
	test("has expected format mappings", () => {
		expect(BOOK_MIME_TYPES.epub).toBe("application/epub+zip");
		expect(BOOK_MIME_TYPES.pdf).toBe("application/pdf");
		expect(BOOK_MIME_TYPES.mobi).toBe("application/x-mobipocket-ebook");
		expect(BOOK_MIME_TYPES.cbz).toBe("application/x-cbz");
	});
});
