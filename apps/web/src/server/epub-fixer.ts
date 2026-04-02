import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles } from "src/db/schema";

const EXCALIBRE_DIR = process.env.EXCALIBRE_DIR ?? "data/excalibre";

const EPUB_CONTENT_EXTENSIONS = new Set([".xhtml", ".html", ".htm"]);
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

function stripNullBytes(content: string): string {
	// eslint-disable-next-line no-control-regex
	return content.replaceAll("\0", "");
}

function addXmlDeclarationIfMissing(content: string): string {
	const trimmed = content.trimStart();
	if (trimmed.startsWith("<?xml")) {
		return content;
	}
	return XML_DECLARATION + content;
}

function addXmlLangIfMissing(content: string): string {
	// If the <html> tag already has xml:lang, leave it alone
	if (/<html[^>]*xml:lang/i.test(content)) {
		return content;
	}
	// Add xml:lang="en" to the opening <html> tag
	return content.replace(/<html(\s|>)/i, '<html xml:lang="en"$1');
}

function fixEntryContent(original: string): {
	content: string;
	changed: boolean;
} {
	let content = original;

	content = stripNullBytes(content);
	content = addXmlDeclarationIfMissing(content);
	content = addXmlLangIfMissing(content);

	return { content, changed: content !== original };
}

export async function fixEpub(
	bookFileId: number,
): Promise<typeof bookFiles.$inferSelect | null> {
	const bookFile = await db.query.bookFiles.findFirst({
		where: eq(bookFiles.id, bookFileId),
	});

	if (!bookFile) {
		throw new Error(`BookFile ${bookFileId} not found`);
	}

	if (bookFile.format.toLowerCase() !== "epub") {
		throw new Error(
			`BookFile ${bookFileId} is not an EPUB (format: ${bookFile.format})`,
		);
	}

	const zip = new AdmZip(bookFile.filePath);
	const entries = zip.getEntries();

	let anyChanged = false;

	for (const entry of entries) {
		if (entry.isDirectory) {
			continue;
		}

		const ext = path.extname(entry.entryName).toLowerCase();
		if (!EPUB_CONTENT_EXTENSIONS.has(ext)) {
			continue;
		}

		const original = entry.getData().toString("utf8");
		const { content, changed } = fixEntryContent(original);

		if (changed) {
			zip.updateFile(entry.entryName, Buffer.from(content, "utf8"));
			anyChanged = true;
		}
	}

	if (!anyChanged) {
		return null;
	}

	const bookId = bookFile.bookId;
	const outputDir = path.join(EXCALIBRE_DIR, "fixed", String(bookId));
	fs.mkdirSync(outputDir, { recursive: true });

	const outputFilename = path.basename(bookFile.filePath);
	const outputPath = path.join(outputDir, outputFilename);

	zip.writeZip(outputPath);

	const stat = fs.statSync(outputPath);

	const [newRecord] = await db
		.insert(bookFiles)
		.values({
			bookId,
			filePath: outputPath,
			format: "epub",
			fileSize: stat.size,
			source: "converted",
			volumeType: "excalibre",
			modifiedAt: new Date(stat.mtimeMs),
		})
		.returning();

	return newRecord;
}
