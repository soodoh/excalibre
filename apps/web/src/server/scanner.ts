// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import {
	authors,
	bookFiles,
	books,
	booksAuthors,
	booksTags,
	jobs,
	libraries,
	series,
	tags,
} from "src/db/schema";
import {
	extractMetadata,
	getFileFormat,
	isSupportedFormat,
} from "src/server/extractors";
import { resolveLibraryScanPath } from "src/server/path-safety";

const DATA_DIR = process.env.DATA_DIR ?? "data";
const EXCALIBRE_DIR = process.env.EXCALIBRE_DIR ?? "data/excalibre";

type ScanResult = { added: number; updated: number; missing: number };

function buildSortTitle(title: string): string {
	const lower = title.toLowerCase();
	if (lower.startsWith("the ")) {
		return title.slice(4);
	}
	if (lower.startsWith("a ")) {
		return title.slice(2);
	}
	if (lower.startsWith("an ")) {
		return title.slice(3);
	}
	return title;
}

function buildSlug(text: string): string {
	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
}

function buildAuthorSortName(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length < 2) {
		return name;
	}
	const last = parts.at(-1);
	const first = parts.slice(0, -1).join(" ");
	return `${last}, ${first}`;
}

function walkDir(dir: string): string[] {
	const results: string[] = [];
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return results;
	}
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkDir(fullPath));
		} else if (entry.isFile()) {
			results.push(fullPath);
		}
	}
	return results;
}

function computeMd5(filePath: string): string {
	const hash = createHash("md5");
	const content = fs.readFileSync(filePath);
	hash.update(content);
	return hash.digest("hex");
}

function computeFileHash(filePath: string): string {
	const stat = fs.statSync(filePath);
	return `${stat.size}:${stat.mtimeMs}`;
}

async function getOrCreateAuthor(name: string): Promise<number> {
	const existing = await db.query.authors.findFirst({
		where: eq(authors.name, name),
	});
	if (existing) {
		return existing.id;
	}

	const [created] = await db
		.insert(authors)
		.values({
			name,
			sortName: buildAuthorSortName(name),
			slug: buildSlug(name),
		})
		.returning({ id: authors.id });

	return created.id;
}

async function getOrCreateSeries(
	name: string,
	libraryId: number,
): Promise<number> {
	const existing = await db.query.series.findFirst({
		where: and(eq(series.name, name), eq(series.libraryId, libraryId)),
	});
	if (existing) {
		return existing.id;
	}

	const [created] = await db
		.insert(series)
		.values({
			name,
			sortName: name,
			libraryId,
		})
		.returning({ id: series.id });

	return created.id;
}

async function getOrCreateTag(name: string): Promise<number> {
	const existing = await db.query.tags.findFirst({
		where: eq(tags.name, name),
	});
	if (existing) {
		return existing.id;
	}

	const [created] = await db
		.insert(tags)
		.values({ name })
		.returning({ id: tags.id });

	return created.id;
}

async function processNewFile(
	filePath: string,
	libraryId: number,
): Promise<void> {
	const result = await extractMetadata(filePath);
	const { metadata, cover } = result;

	const fileHash = computeFileHash(filePath);
	const md5Hash = computeMd5(filePath);
	const stat = fs.statSync(filePath);

	// Resolve series
	let seriesId: number | null = null;
	if (metadata.series) {
		seriesId = await getOrCreateSeries(metadata.series, libraryId);
	}

	// Insert book
	const [book] = await db
		.insert(books)
		.values({
			title: metadata.title,
			sortTitle: buildSortTitle(metadata.title),
			slug: buildSlug(metadata.title),
			libraryId,
			description: metadata.description ?? null,
			language: metadata.language ?? null,
			publisher: metadata.publisher ?? null,
			publishDate: metadata.publishDate ?? null,
			pageCount: metadata.pageCount ?? null,
			seriesId,
			seriesIndex: metadata.seriesIndex ?? null,
		})
		.returning({ id: books.id });

	const bookId = book.id;

	// Save cover
	if (cover) {
		const coversDir = path.join(EXCALIBRE_DIR, "covers");
		fs.mkdirSync(coversDir, { recursive: true });
		const coverFile = path.join(coversDir, `${bookId}.${cover.extension}`);
		fs.writeFileSync(coverFile, cover.data);
		await db
			.update(books)
			.set({ coverPath: coverFile })
			.where(eq(books.id, bookId));
	}

	// Insert book file
	const format = getFileFormat(filePath);
	const [newRecord] = await db
		.insert(bookFiles)
		.values({
			bookId,
			filePath,
			format,
			fileSize: stat.size,
			fileHash,
			md5Hash,
			source: "scanned",
			volumeType: "data",
			modifiedAt: new Date(stat.mtimeMs),
		})
		.returning({ id: bookFiles.id });

	// Queue epub_fix job for EPUBs
	if (format === "epub") {
		db.insert(jobs)
			.values({
				type: "epub_fix",
				payload: { bookFileId: newRecord.id },
				priority: 1,
			})
			.run();
	}

	// Authors
	const authorNames =
		metadata.authors.length > 0 ? metadata.authors : ["Unknown"];
	for (const authorName of authorNames) {
		const authorId = await getOrCreateAuthor(authorName);
		try {
			await db
				.insert(booksAuthors)
				.values({ bookId, authorId, role: "author" });
		} catch {
			// Ignore unique constraint violations
		}
	}

	// Tags
	if (metadata.tags && metadata.tags.length > 0) {
		for (const tagName of metadata.tags) {
			const tagId = await getOrCreateTag(tagName);
			try {
				await db.insert(booksTags).values({ bookId, tagId });
			} catch {
				// Ignore unique constraint violations
			}
		}
	}
}

async function processUpdatedFile(
	filePath: string,
	existingFile: { id: number; bookId: number; fileHash: string | null },
): Promise<void> {
	const result = await extractMetadata(filePath);
	const { metadata, cover } = result;
	const fileHash = computeFileHash(filePath);
	const md5Hash = computeMd5(filePath);
	const stat = fs.statSync(filePath);
	const bookId = existingFile.bookId;

	// Update book record
	const updateValues: Partial<typeof books.$inferInsert> = {
		title: metadata.title,
		sortTitle: buildSortTitle(metadata.title),
		description: metadata.description ?? null,
		language: metadata.language ?? null,
		publisher: metadata.publisher ?? null,
		publishDate: metadata.publishDate ?? null,
		pageCount: metadata.pageCount ?? null,
		seriesIndex: metadata.seriesIndex ?? null,
		updatedAt: new Date(),
	};

	await db.update(books).set(updateValues).where(eq(books.id, bookId));

	// Update cover
	if (cover) {
		const coversDir = path.join(EXCALIBRE_DIR, "covers");
		fs.mkdirSync(coversDir, { recursive: true });
		const coverFile = path.join(coversDir, `${bookId}.${cover.extension}`);
		fs.writeFileSync(coverFile, cover.data);
		await db
			.update(books)
			.set({ coverPath: coverFile })
			.where(eq(books.id, bookId));
	}

	// Update book file record
	await db
		.update(bookFiles)
		.set({
			fileHash,
			md5Hash,
			fileSize: stat.size,
			modifiedAt: new Date(stat.mtimeMs),
		})
		.where(eq(bookFiles.id, existingFile.id));
}

export async function scanLibrary(libraryId: number): Promise<ScanResult> {
	const library = await db.query.libraries.findFirst({
		where: eq(libraries.id, libraryId),
	});

	if (!library) {
		throw new Error(`Library ${libraryId} not found`);
	}

	let added = 0;
	let updated = 0;

	// Collect all files found on disk
	const foundPaths = new Set<string>();

	for (const scanPath of library.scanPaths) {
		const fullScanPath = resolveLibraryScanPath(DATA_DIR, scanPath);
		const files = walkDir(fullScanPath);

		for (const filePath of files) {
			if (!isSupportedFormat(filePath)) {
				continue;
			}

			foundPaths.add(filePath);

			// Check if file exists in DB
			const existingFile = await db.query.bookFiles.findFirst({
				where: eq(bookFiles.filePath, filePath),
			});

			if (existingFile) {
				const currentHash = computeFileHash(filePath);
				if (currentHash !== existingFile.fileHash) {
					try {
						await processUpdatedFile(filePath, existingFile);
						updated += 1;
					} catch {
						// Non-fatal: continue scanning other files
					}
				}
			} else {
				try {
					await processNewFile(filePath, libraryId);
					added += 1;
				} catch {
					// Non-fatal: continue scanning other files
				}
			}
		}
	}

	// Count missing files (in DB but not on disk)
	const allLibraryFiles = await db
		.select({ filePath: bookFiles.filePath })
		.from(bookFiles)
		.innerJoin(books, eq(bookFiles.bookId, books.id))
		.where(eq(books.libraryId, libraryId));

	let missing = 0;
	for (const { filePath } of allLibraryFiles) {
		if (!foundPaths.has(filePath)) {
			missing += 1;
		}
	}

	// Update lastScannedAt
	await db
		.update(libraries)
		.set({ lastScannedAt: new Date(), updatedAt: new Date() })
		.where(eq(libraries.id, libraryId));

	return { added, updated, missing };
}

export async function scanAllLibraries(): Promise<ScanResult> {
	const allLibraries = await db.select().from(libraries);

	const results = { added: 0, updated: 0, missing: 0 };

	for (const library of allLibraries) {
		const result = await scanLibrary(library.id);
		results.added += result.added;
		results.updated += result.updated;
		results.missing += result.missing;
	}

	return results;
}
