import { createFileRoute } from "@tanstack/react-router";
import { and, gt, inArray } from "drizzle-orm";
import { db } from "src/db";
import {
	authors,
	bookFiles,
	books,
	booksAuthors,
	readingProgress,
} from "src/db/schema";
import { getAccessibleLibraryIds } from "src/server/access-control";
import {
	authenticateKobo,
	buildNewEntitlement,
	buildSyncToken,
	parseSyncToken,
} from "src/server/kobo";

const PAGE_SIZE = 100;

export async function handleKoboLibrarySyncRequest({
	request,
	params,
}: {
	request: Request;
	params: { token: string };
}): Promise<Response> {
	const auth = await authenticateKobo(params.token);
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;
	const accessibleLibraryIds = await getAccessibleLibraryIds(auth.userId);
	const rawSyncToken = request.headers.get("x-kobo-synctoken");
	const syncState = parseSyncToken(rawSyncToken);
	const booksAfter = new Date(syncState.booksLastModified);

	let hasMore = false;
	const changes: unknown[] = [];
	const now = new Date();

	if (accessibleLibraryIds.length > 0) {
		// Query all books modified after the sync token timestamp
		const allBooks = await db.query.books.findMany({
			where: and(
				inArray(books.libraryId, accessibleLibraryIds),
				gt(books.updatedAt, booksAfter),
			),
			limit: PAGE_SIZE + 1,
			columns: {
				id: true,
				title: true,
				sortTitle: true,
				description: true,
				language: true,
				publisher: true,
				publishDate: true,
				coverPath: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		hasMore = allBooks.length > PAGE_SIZE;
		const booksPage = hasMore ? allBooks.slice(0, PAGE_SIZE) : allBooks;

		if (booksPage.length > 0) {
			const bookIds = booksPage.map((b) => b.id);

			// Fetch files for all books
			const allFiles = await db.query.bookFiles.findMany({
				where: inArray(bookFiles.bookId, bookIds),
			});

			// Fetch author associations
			const allBooksAuthors = await db.query.booksAuthors.findMany({
				where: inArray(booksAuthors.bookId, bookIds),
			});
			const authorIds = [...new Set(allBooksAuthors.map((ba) => ba.authorId))];

			const allAuthors =
				authorIds.length > 0
					? await db.query.authors.findMany({
							where: inArray(authors.id, authorIds),
						})
					: [];

			// Fetch reading progress for current user for these books
			const allProgress = await db.query.readingProgress.findMany({
				where: inArray(readingProgress.bookId, bookIds),
			});
			const userProgress = allProgress.filter(
				(progress) => progress.userId === auth.userId,
			);

			// Build a full Book shape for each book page entry
			const fullBooks = await db.query.books.findMany({
				where: inArray(books.id, bookIds),
			});

			for (const book of fullBooks) {
				const bookFilesList = allFiles.filter(
					(file) => file.bookId === book.id,
				);
				const bookAuthorIds = new Set(
					allBooksAuthors
						.filter((booksAuthor) => booksAuthor.bookId === book.id)
						.map((booksAuthor) => booksAuthor.authorId),
				);
				const bookAuthorsList = allAuthors.filter((author) =>
					bookAuthorIds.has(author.id),
				);
				const progress = userProgress.find((item) => item.bookId === book.id);

				changes.push(
					buildNewEntitlement(
						book,
						bookFilesList,
						bookAuthorsList,
						progress,
						baseUrl,
						params.token,
					),
				);
			}
		}
	}

	// Build updated sync token
	const booksLastModified =
		accessibleLibraryIds.length === 0
			? syncState.booksLastModified
			: now.toISOString();
	const newSyncToken = buildSyncToken({
		booksLastModified,
		readingStateLastModified: now.toISOString(),
	});

	const responseHeaders: Record<string, string> = {
		"x-kobo-synctoken": newSyncToken,
	};

	if (hasMore) {
		responseHeaders["x-kobo-sync"] = "continue";
	}

	return Response.json(changes, {
		status: 200,
		headers: responseHeaders,
	});
}

export const Route = createFileRoute("/api/kobo/$token/v1/library/sync")({
	server: {
		handlers: {
			GET: handleKoboLibrarySyncRequest,
		},
	},
});
