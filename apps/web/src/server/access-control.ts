import { and, eq, inArray } from "drizzle-orm";
import { db } from "src/db";
import {
	authors,
	bookFiles,
	books,
	booksAuthors,
	libraries,
	libraryAccess,
	series,
	user,
} from "src/db/schema";
import { ForbiddenError, NotFoundError } from "src/server/http-errors";

type UserRole = "admin" | "user";

async function resolveUserRole(
	userId: string,
	role?: UserRole,
): Promise<UserRole> {
	if (role) {
		return role;
	}

	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: { role: true },
	});

	return userRecord?.role ?? "user";
}

export async function getAccessibleLibraryIds(
	userId: string,
	role?: UserRole,
): Promise<number[]> {
	const resolvedRole = await resolveUserRole(userId, role);

	if (resolvedRole === "admin") {
		const allLibraries = await db.select({ id: libraries.id }).from(libraries);
		return allLibraries.map((library) => library.id);
	}

	const accessRows = await db
		.select({ libraryId: libraryAccess.libraryId })
		.from(libraryAccess)
		.where(eq(libraryAccess.userId, userId));

	return accessRows.map((row) => row.libraryId);
}

export async function getAccessibleLibraries(
	userId: string,
	role?: UserRole,
): Promise<Array<typeof libraries.$inferSelect>> {
	const resolvedRole = await resolveUserRole(userId, role);

	if (resolvedRole === "admin") {
		return db.select().from(libraries);
	}

	const libraryIds = await getAccessibleLibraryIds(userId, resolvedRole);
	if (libraryIds.length === 0) {
		return [];
	}

	return db.select().from(libraries).where(inArray(libraries.id, libraryIds));
}

export async function assertUserCanAccessLibrary(
	userId: string,
	libraryId: number,
	role?: UserRole,
): Promise<typeof libraries.$inferSelect> {
	const library = await db.query.libraries.findFirst({
		where: eq(libraries.id, libraryId),
	});

	if (!library) {
		throw new NotFoundError("Library not found");
	}

	const resolvedRole = await resolveUserRole(userId, role);
	if (resolvedRole === "admin") {
		return library;
	}

	const access = await db.query.libraryAccess.findFirst({
		where: and(
			eq(libraryAccess.userId, userId),
			eq(libraryAccess.libraryId, libraryId),
		),
	});

	if (!access) {
		throw new ForbiddenError("Forbidden: no access to this library");
	}

	return library;
}

export async function assertUserCanAccessBook(
	userId: string,
	bookId: number,
	role?: UserRole,
): Promise<typeof books.$inferSelect> {
	const book = await db.query.books.findFirst({
		where: eq(books.id, bookId),
	});

	if (!book) {
		throw new NotFoundError("Book not found");
	}

	await assertUserCanAccessLibrary(userId, book.libraryId, role);
	return book;
}

export async function assertUserCanAccessBookFile(
	userId: string,
	fileId: number,
	role?: UserRole,
): Promise<typeof bookFiles.$inferSelect> {
	const file = await db.query.bookFiles.findFirst({
		where: eq(bookFiles.id, fileId),
	});

	if (!file) {
		throw new NotFoundError("Book file not found");
	}

	await assertUserCanAccessBook(userId, file.bookId, role);
	return file;
}

export async function assertUserCanAccessAuthor(
	userId: string,
	authorId: number,
	role?: UserRole,
): Promise<typeof authors.$inferSelect> {
	const author = await db.query.authors.findFirst({
		where: eq(authors.id, authorId),
	});

	if (!author) {
		throw new NotFoundError("Author not found");
	}

	const accessibleLibraryIds = await getAccessibleLibraryIds(userId, role);
	if (accessibleLibraryIds.length === 0) {
		throw new ForbiddenError("Forbidden: no access to this author");
	}

	const bookRow = await db
		.select({ id: books.id })
		.from(booksAuthors)
		.innerJoin(books, eq(booksAuthors.bookId, books.id))
		.where(
			and(
				eq(booksAuthors.authorId, authorId),
				inArray(books.libraryId, accessibleLibraryIds),
			),
		)
		.limit(1);

	if (bookRow.length === 0) {
		throw new ForbiddenError("Forbidden: no access to this author");
	}

	return author;
}

export async function assertUserCanAccessSeries(
	userId: string,
	seriesId: number,
	role?: UserRole,
): Promise<typeof series.$inferSelect> {
	const seriesRecord = await db.query.series.findFirst({
		where: eq(series.id, seriesId),
	});

	if (!seriesRecord) {
		throw new NotFoundError("Series not found");
	}

	await assertUserCanAccessLibrary(userId, seriesRecord.libraryId, role);
	return seriesRecord;
}
