import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";
import { extractCbz } from "src/server/extractors/cbz";
import { extractEpub } from "src/server/extractors/epub";
import {
	extractMetadata,
	getFileFormat,
	isSupportedFormat,
} from "src/server/extractors/index";
import { extractPdf } from "src/server/extractors/pdf";
import { afterEach, describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Helpers for creating fixture files in memory
// ---------------------------------------------------------------------------

function buildEpub(options: {
	title?: string;
	author?: string;
	language?: string;
	description?: string;
	coverData?: Buffer;
	includeCover?: boolean;
}): Buffer {
	const {
		title = "Test Title",
		author = "Test Author",
		language = "en",
		description,
		coverData,
		includeCover = false,
	} = options;

	const zip = new AdmZip();

	// mimetype (must be first, uncompressed)
	zip.addFile("mimetype", Buffer.from("application/epub+zip"));

	// META-INF/container.xml
	const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
	zip.addFile("META-INF/container.xml", Buffer.from(containerXml));

	// Build OPF
	const descriptionTag = description
		? `<dc:description>${description}</dc:description>`
		: "";
	const coverManifestItem = includeCover
		? `<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>`
		: "";
	const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>${language}</dc:language>
    ${descriptionTag}
  </metadata>
  <manifest>
    ${coverManifestItem}
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
</package>`;
	zip.addFile("OEBPS/content.opf", Buffer.from(opfXml));

	if (includeCover && coverData) {
		zip.addFile("OEBPS/cover.jpg", coverData);
	}

	return zip.toBuffer();
}

function buildCbz(options: {
	comicInfo?: string;
	images?: Array<{ name: string; data: Buffer }>;
}): Buffer {
	const { comicInfo, images = [] } = options;
	const zip = new AdmZip();

	if (comicInfo) {
		zip.addFile("ComicInfo.xml", Buffer.from(comicInfo));
	}

	for (const img of images) {
		zip.addFile(img.name, img.data);
	}

	return zip.toBuffer();
}

async function buildPdf(options: {
	title?: string;
	author?: string;
	subject?: string;
	pageCount?: number;
}): Promise<Buffer> {
	const { title, author, subject, pageCount = 1 } = options;
	const pdfDoc = await PDFDocument.create();

	if (title) {
		pdfDoc.setTitle(title);
	}
	if (author) {
		pdfDoc.setAuthor(author);
	}
	if (subject) {
		pdfDoc.setSubject(subject);
	}

	for (let i = 0; i < pageCount; i += 1) {
		pdfDoc.addPage([612, 792]);
	}

	const bytes = await pdfDoc.save();
	return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// Temp directory management
// ---------------------------------------------------------------------------

let tempDir: string;

async function setupTempDir(): Promise<string> {
	const dir = path.join(os.tmpdir(), `extractor-test-${Date.now()}`);
	await mkdir(dir, { recursive: true });
	tempDir = dir;
	return dir;
}

async function cleanupTempDir() {
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
	}
}

// ---------------------------------------------------------------------------
// EPUB tests
// ---------------------------------------------------------------------------

describe("EPUB extractor", () => {
	afterEach(cleanupTempDir);

	test("extracts title and author", async () => {
		const dir = await setupTempDir();
		const epubBuf = buildEpub({ title: "My Book", author: "Jane Doe" });
		const filePath = path.join(dir, "test.epub");
		await writeFile(filePath, epubBuf);

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("My Book");
		expect(result.metadata.authors).toContain("Jane Doe");
	});

	test("extracts language", async () => {
		const dir = await setupTempDir();
		const epubBuf = buildEpub({ language: "fr" });
		const filePath = path.join(dir, "test.epub");
		await writeFile(filePath, epubBuf);

		const result = extractEpub(filePath);

		expect(result.metadata.language).toBe("fr");
	});

	test("handles missing metadata gracefully", async () => {
		const dir = await setupTempDir();
		// Minimal EPUB with no title/author in OPF
		const zip = new AdmZip();
		zip.addFile("mimetype", Buffer.from("application/epub+zip"));
		zip.addFile(
			"META-INF/container.xml",
			Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
		);
		zip.addFile(
			"content.opf",
			Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"></metadata>
  <manifest></manifest>
</package>`),
		);

		const filePath = path.join(dir, "empty.epub");
		await writeFile(filePath, zip.toBuffer());

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("Unknown");
		expect(result.metadata.authors).toContain("Unknown");
		expect(result.cover).toBeUndefined();
	});

	test("extracts cover image when present", async () => {
		const dir = await setupTempDir();
		// Minimal 1x1 white JPEG (valid JFIF)
		const fakeJpeg = Buffer.from(
			"ffd8ffe000104a46494600010100000100010000ffdb00430001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda00080101000000013f00ffd9",
			"hex",
		);
		const epubBuf = buildEpub({
			title: "Cover Book",
			includeCover: true,
			coverData: fakeJpeg,
		});
		const filePath = path.join(dir, "cover.epub");
		await writeFile(filePath, epubBuf);

		const result = extractEpub(filePath);

		expect(result.cover).toBeDefined();
		expect(result.cover?.mimeType).toBe("image/jpeg");
		expect(result.cover?.extension).toBe("jpg");
		expect(result.cover?.data).toBeInstanceOf(Buffer);
	});
});

// ---------------------------------------------------------------------------
// PDF tests
// ---------------------------------------------------------------------------

describe("PDF extractor", () => {
	afterEach(cleanupTempDir);

	test("extracts title, author, and page count", async () => {
		const dir = await setupTempDir();
		const pdfBuf = await buildPdf({
			title: "PDF Title",
			author: "PDF Author",
			pageCount: 5,
		});
		const filePath = path.join(dir, "test.pdf");
		await writeFile(filePath, pdfBuf);

		const result = await extractPdf(filePath);

		expect(result.metadata.title).toBe("PDF Title");
		expect(result.metadata.authors).toContain("PDF Author");
		expect(result.metadata.pageCount).toBe(5);
	});

	test("extracts subject as description", async () => {
		const dir = await setupTempDir();
		const pdfBuf = await buildPdf({
			title: "A Book",
			subject: "A fascinating subject",
		});
		const filePath = path.join(dir, "subject.pdf");
		await writeFile(filePath, pdfBuf);

		const result = await extractPdf(filePath);

		expect(result.metadata.description).toBe("A fascinating subject");
	});

	test("falls back to Unknown when no title/author", async () => {
		const dir = await setupTempDir();
		const pdfBuf = await buildPdf({});
		const filePath = path.join(dir, "empty.pdf");
		await writeFile(filePath, pdfBuf);

		const result = await extractPdf(filePath);

		expect(result.metadata.title).toBe("Unknown");
		expect(result.metadata.authors).toContain("Unknown");
	});
});

// ---------------------------------------------------------------------------
// CBZ tests
// ---------------------------------------------------------------------------

describe("CBZ extractor", () => {
	afterEach(cleanupTempDir);

	test("extracts metadata from ComicInfo.xml", async () => {
		const dir = await setupTempDir();
		const comicInfo = `<?xml version="1.0"?>
<ComicInfo>
  <Title>My Comic</Title>
  <Writer>Comic Author</Writer>
  <Summary>An exciting story</Summary>
  <Publisher>Comics Inc</Publisher>
  <Year>2023</Year>
  <Series>The Series</Series>
  <Number>3</Number>
  <Genre>Action, Adventure</Genre>
  <LanguageISO>en</LanguageISO>
  <PageCount>24</PageCount>
</ComicInfo>`;

		const fakeImage = Buffer.from([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
		]);
		const cbzBuf = buildCbz({
			comicInfo,
			images: [{ name: "001.jpg", data: fakeImage }],
		});
		const filePath = path.join(dir, "test.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.title).toBe("My Comic");
		expect(result.metadata.authors).toContain("Comic Author");
		expect(result.metadata.description).toBe("An exciting story");
		expect(result.metadata.publisher).toBe("Comics Inc");
		expect(result.metadata.series).toBe("The Series");
		expect(result.metadata.seriesIndex).toBe(3);
		expect(result.metadata.tags).toContain("Action");
		expect(result.metadata.tags).toContain("Adventure");
		expect(result.metadata.language).toBe("en");
		expect(result.metadata.pageCount).toBe(24);
	});

	test("extracts first image as cover", async () => {
		const dir = await setupTempDir();
		const fakeJpeg = Buffer.from([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
		]);
		const cbzBuf = buildCbz({
			images: [
				{ name: "001.jpg", data: fakeJpeg },
				{ name: "002.jpg", data: fakeJpeg },
			],
		});
		const filePath = path.join(dir, "cover.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.cover).toBeDefined();
		expect(result.cover?.mimeType).toBe("image/jpeg");
		expect(result.cover?.extension).toBe("jpg");
	});

	test("falls back to filename when no ComicInfo.xml", async () => {
		const dir = await setupTempDir();
		const fakeImage = Buffer.from([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
		]);
		const cbzBuf = buildCbz({
			images: [{ name: "page01.jpg", data: fakeImage }],
		});
		const filePath = path.join(dir, "my-comic-title.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.title).toBe("my-comic-title");
	});
});

// ---------------------------------------------------------------------------
// Format dispatcher tests
// ---------------------------------------------------------------------------

describe("Format dispatcher", () => {
	afterEach(cleanupTempDir);

	test("isSupportedFormat identifies supported extensions", () => {
		expect(isSupportedFormat("book.epub")).toBe(true);
		expect(isSupportedFormat("book.pdf")).toBe(true);
		expect(isSupportedFormat("book.cbz")).toBe(true);
		expect(isSupportedFormat("book.mobi")).toBe(true);
		expect(isSupportedFormat("book.txt")).toBe(true);
	});

	test("isSupportedFormat rejects unsupported extensions", () => {
		expect(isSupportedFormat("book.xyz")).toBe(false);
		expect(isSupportedFormat("book.exe")).toBe(false);
		expect(isSupportedFormat("book.mp3")).toBe(false);
	});

	test("getFileFormat returns lowercase extension", () => {
		expect(getFileFormat("book.EPUB")).toBe("epub");
		expect(getFileFormat("book.PDF")).toBe("pdf");
		expect(getFileFormat("archive/book.CBZ")).toBe("cbz");
	});

	test("extractMetadata falls back to filename for unsupported formats", async () => {
		const dir = await setupTempDir();
		const filePath = path.join(dir, "My Awesome Book.mobi");
		// Create a minimal placeholder file
		await writeFile(filePath, Buffer.from("placeholder"));

		const result = await extractMetadata(filePath);

		expect(result.metadata.title).toBe("My Awesome Book");
		expect(result.metadata.authors).toContain("Unknown");
	});

	test("extractMetadata dispatches to EPUB extractor", async () => {
		const dir = await setupTempDir();
		const epubBuf = buildEpub({ title: "Dispatched EPUB", author: "Author" });
		const filePath = path.join(dir, "dispatched.epub");
		await writeFile(filePath, epubBuf);

		const result = await extractMetadata(filePath);

		expect(result.metadata.title).toBe("Dispatched EPUB");
	});

	test("extractMetadata dispatches to PDF extractor", async () => {
		const dir = await setupTempDir();
		const pdfBuf = await buildPdf({ title: "Dispatched PDF" });
		const filePath = path.join(dir, "dispatched.pdf");
		await writeFile(filePath, pdfBuf);

		const result = await extractMetadata(filePath);

		expect(result.metadata.title).toBe("Dispatched PDF");
	});

	test("extractMetadata dispatches CBR to CBZ extractor", async () => {
		const dir = await setupTempDir();
		const fakeImage = Buffer.from([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
		]);
		const cbzBuf = buildCbz({
			images: [{ name: "page01.jpg", data: fakeImage }],
		});
		const filePath = path.join(dir, "comic.cbr");
		await writeFile(filePath, cbzBuf);

		const result = await extractMetadata(filePath);

		expect(result.metadata.title).toBe("comic");
	});

	test("extractMetadata dispatches CB7 to CBZ extractor", async () => {
		const dir = await setupTempDir();
		const fakeImage = Buffer.from([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
		]);
		const cbzBuf = buildCbz({
			images: [{ name: "page01.jpg", data: fakeImage }],
		});
		const filePath = path.join(dir, "comic.cb7");
		await writeFile(filePath, cbzBuf);

		const result = await extractMetadata(filePath);

		expect(result.metadata.title).toBe("comic");
	});
});

// ---------------------------------------------------------------------------
// EPUB edge-case branch coverage
// ---------------------------------------------------------------------------

describe("EPUB extractor edge cases", () => {
	afterEach(cleanupTempDir);

	test("handles OPF with calibre series metadata", async () => {
		const dir = await setupTempDir();
		const zip = new AdmZip();
		zip.addFile("mimetype", Buffer.from("application/epub+zip"));
		zip.addFile(
			"META-INF/container.xml",
			Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
		);
		zip.addFile(
			"content.opf",
			Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Series Book</dc:title>
    <dc:creator>Author X</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>My Publisher</dc:publisher>
    <dc:date>2025-01-15</dc:date>
    <dc:subject>Fantasy</dc:subject>
    <dc:subject>Adventure</dc:subject>
    <dc:identifier opf:scheme="ISBN">978-1234567890</dc:identifier>
    <meta name="calibre:series" content="My Series"/>
    <meta name="calibre:series_index" content="3.5"/>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="cover.png" media-type="image/png"/>
  </manifest>
</package>`),
		);
		// Add a cover image
		zip.addFile("cover.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));

		const filePath = path.join(dir, "series.epub");
		await writeFile(filePath, zip.toBuffer());

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("Series Book");
		expect(result.metadata.authors).toContain("Author X");
		expect(result.metadata.publisher).toBe("My Publisher");
		expect(result.metadata.publishDate).toBe("2025-01-15");
		expect(result.metadata.tags).toEqual(["Fantasy", "Adventure"]);
		expect(result.metadata.isbn).toBe("978-1234567890");
		expect(result.metadata.series).toBe("My Series");
		expect(result.metadata.seriesIndex).toBe(3.5);
		expect(result.cover).toBeDefined();
		expect(result.cover?.mimeType).toBe("image/png");
		expect(result.cover?.extension).toBe("png");
	});

	test("returns UNKNOWN_RESULT when no OPF path found", async () => {
		const dir = await setupTempDir();
		const zip = new AdmZip();
		zip.addFile("mimetype", Buffer.from("application/epub+zip"));
		// No container.xml
		const filePath = path.join(dir, "no-opf.epub");
		await writeFile(filePath, zip.toBuffer());

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("Unknown");
		expect(result.metadata.authors).toContain("Unknown");
	});

	test("returns UNKNOWN_RESULT when OPF entry not found in ZIP", async () => {
		const dir = await setupTempDir();
		const zip = new AdmZip();
		zip.addFile("mimetype", Buffer.from("application/epub+zip"));
		zip.addFile(
			"META-INF/container.xml",
			Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="nonexistent.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
		);
		const filePath = path.join(dir, "missing-opf.epub");
		await writeFile(filePath, zip.toBuffer());

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("Unknown");
	});

	test("finds cover by common filename when not in manifest", async () => {
		const dir = await setupTempDir();
		const zip = new AdmZip();
		zip.addFile("mimetype", Buffer.from("application/epub+zip"));
		zip.addFile(
			"META-INF/container.xml",
			Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
		);
		zip.addFile(
			"content.opf",
			Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Common Cover</dc:title>
  </metadata>
  <manifest></manifest>
</package>`),
		);
		// cover.jpg at a common location
		zip.addFile("cover.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

		const filePath = path.join(dir, "common-cover.epub");
		await writeFile(filePath, zip.toBuffer());

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("Common Cover");
		expect(result.cover).toBeDefined();
		expect(result.cover?.extension).toBe("jpg");
	});

	test("handles description in metadata", async () => {
		const dir = await setupTempDir();
		const epubBuf = buildEpub({
			title: "Desc Book",
			author: "Auth",
			description: "A great story",
		});
		const filePath = path.join(dir, "desc.epub");
		await writeFile(filePath, epubBuf);

		const result = extractEpub(filePath);

		expect(result.metadata.description).toBe("A great story");
	});

	test("handles rootfile as array in container.xml", async () => {
		const dir = await setupTempDir();
		const zip = new AdmZip();
		zip.addFile("mimetype", Buffer.from("application/epub+zip"));
		zip.addFile(
			"META-INF/container.xml",
			Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
    <rootfile full-path="alt.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
		);
		zip.addFile(
			"content.opf",
			Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Array Rootfile</dc:title>
  </metadata>
  <manifest></manifest>
</package>`),
		);

		const filePath = path.join(dir, "multi-rootfile.epub");
		await writeFile(filePath, zip.toBuffer());

		const result = extractEpub(filePath);

		expect(result.metadata.title).toBe("Array Rootfile");
	});
});

// ---------------------------------------------------------------------------
// CBZ edge-case branch coverage
// ---------------------------------------------------------------------------

describe("CBZ extractor edge cases", () => {
	afterEach(cleanupTempDir);

	test("handles ComicInfo.xml with month and day in publish date", async () => {
		const dir = await setupTempDir();
		const comicInfo = `<?xml version="1.0"?>
<ComicInfo>
  <Title>Dated Comic</Title>
  <Year>2025</Year>
  <Month>3</Month>
  <Day>15</Day>
</ComicInfo>`;
		const fakeImage = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		const cbzBuf = buildCbz({
			comicInfo,
			images: [{ name: "001.png", data: fakeImage }],
		});
		const filePath = path.join(dir, "dated.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.publishDate).toBe("2025-03-15");
		expect(result.cover?.mimeType).toBe("image/png");
	});

	test("handles ComicInfo.xml with only month (no day)", async () => {
		const dir = await setupTempDir();
		const comicInfo = `<?xml version="1.0"?>
<ComicInfo>
  <Title>Month Only</Title>
  <Year>2025</Year>
  <Month>7</Month>
</ComicInfo>`;
		const cbzBuf = buildCbz({ comicInfo });
		const filePath = path.join(dir, "month.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.publishDate).toBe("2025-07");
	});

	test("handles numeric title in ComicInfo.xml", async () => {
		const dir = await setupTempDir();
		const comicInfo = `<?xml version="1.0"?>
<ComicInfo>
  <Title>42</Title>
  <Number>not-a-number</Number>
  <PageCount>0</PageCount>
</ComicInfo>`;
		const cbzBuf = buildCbz({ comicInfo });
		const filePath = path.join(dir, "numeric.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.title).toBe("42");
		expect(result.metadata.seriesIndex).toBeUndefined();
		expect(result.metadata.pageCount).toBeUndefined();
	});

	test("handles empty CBZ with no images or ComicInfo", async () => {
		const dir = await setupTempDir();
		const cbzBuf = buildCbz({});
		const filePath = path.join(dir, "empty.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.title).toBe("empty");
		expect(result.metadata.authors).toContain("Unknown");
		expect(result.cover).toBeUndefined();
	});

	test("handles ComicInfo with tag equals op for tag name", async () => {
		const dir = await setupTempDir();
		const comicInfo = `<?xml version="1.0"?>
<ComicInfo>
  <Writer>Writer1, Writer2</Writer>
</ComicInfo>`;
		const cbzBuf = buildCbz({ comicInfo });
		const filePath = path.join(dir, "multiwriter.cbz");
		await writeFile(filePath, cbzBuf);

		const result = extractCbz(filePath);

		expect(result.metadata.authors).toEqual(["Writer1", "Writer2"]);
	});
});
