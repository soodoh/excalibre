import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles, books } from "src/db/schema";

const execFile = promisify(execFileCb);

const EXCALIBRE_DIR = process.env.EXCALIBRE_DIR ?? "data/excalibre";

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
