import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles, books } from "src/db/schema";

const execFile = promisify(execFileCb);

const EXCALIBRE_DIR = process.env.EXCALIBRE_DIR ?? "data/excalibre";

// Maps source format -> list of supported target formats (via pandoc)
const PANDOC_CONVERSIONS: Record<string, string[]> = {
	epub: ["mobi", "pdf", "docx", "html", "txt"],
	mobi: ["epub", "pdf", "docx", "html", "txt"],
	docx: ["epub", "pdf", "html", "txt"],
	html: ["epub", "pdf", "docx", "txt"],
	txt: ["epub", "html", "docx"],
};

// Formats that kepubify can convert from
const KEPUBIFY_SOURCE_FORMATS = new Set(["epub"]);

export function getSupportedConversions(sourceFormat: string): string[] {
	const fmt = sourceFormat.toLowerCase();
	const targets = new Set<string>();

	if (KEPUBIFY_SOURCE_FORMATS.has(fmt)) {
		targets.add("kepub");
	}

	const pandocTargets = PANDOC_CONVERSIONS[fmt] ?? [];
	for (const t of pandocTargets) {
		targets.add(t);
	}

	return [...targets];
}

function sanitizeFilename(title: string): string {
	return title
		.replaceAll(/[/\\:*?"<>|]/g, "_")
		.replaceAll(/\s+/g, "_")
		.slice(0, 200);
}

export async function convertWithPandoc(
	inputPath: string,
	outputPath: string,
): Promise<void> {
	await execFile("pandoc", [inputPath, "-o", outputPath]);
}

export async function convertWithKepubify(
	inputPath: string,
	outputDir: string,
): Promise<void> {
	await execFile("kepubify", ["-o", outputDir, inputPath]);
}

export async function convertBook(
	bookFileId: number,
	targetFormat: string,
): Promise<typeof bookFiles.$inferSelect> {
	const bookFile = await db.query.bookFiles.findFirst({
		where: eq(bookFiles.id, bookFileId),
	});

	if (!bookFile) {
		throw new Error(`BookFile ${bookFileId} not found`);
	}

	const book = await db.query.books.findFirst({
		where: eq(books.id, bookFile.bookId),
	});

	const bookId = bookFile.bookId;
	const safeTitle = book ? sanitizeFilename(book.title) : `book_${bookId}`;

	const outputDir = path.join(EXCALIBRE_DIR, "conversions", String(bookId));
	fs.mkdirSync(outputDir, { recursive: true });

	const fmt = targetFormat.toLowerCase();
	let outputPath: string;

	if (fmt === "kepub") {
		// kepubify outputs <basename>.kepub.epub into the output directory
		const inputBasename = path.basename(
			bookFile.filePath,
			path.extname(bookFile.filePath),
		);
		await convertWithKepubify(bookFile.filePath, outputDir);
		outputPath = path.join(outputDir, `${inputBasename}.kepub.epub`);
	} else {
		outputPath = path.join(outputDir, `${safeTitle}.${fmt}`);
		await convertWithPandoc(bookFile.filePath, outputPath);
	}

	if (!fs.existsSync(outputPath)) {
		throw new Error(`Conversion produced no output at ${outputPath}`);
	}

	const stat = fs.statSync(outputPath);

	const [newRecord] = await db
		.insert(bookFiles)
		.values({
			bookId,
			filePath: outputPath,
			format: fmt,
			fileSize: stat.size,
			source: "converted",
			volumeType: "excalibre",
			modifiedAt: new Date(stat.mtimeMs),
		})
		.returning();

	return newRecord;
}
