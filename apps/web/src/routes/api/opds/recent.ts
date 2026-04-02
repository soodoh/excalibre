import { createFileRoute } from "@tanstack/react-router";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "src/db";
import { authors, bookFiles, books, booksAuthors } from "src/db/schema";
import {
	authenticateOpds,
	getAccessibleLibraryIds,
	opdsBookEntry,
	opdsFooter,
	opdsHeader,
	opdsXmlResponse,
} from "src/server/opds";

const RECENT_LIMIT = 50;

export const Route = createFileRoute("/api/opds/recent")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const auth = await authenticateOpds(request);
				if (!auth) {
					return new Response("Unauthorized", {
						status: 401,
						headers: { "WWW-Authenticate": 'Basic realm="Excalibre OPDS"' },
					});
				}

				const url = new URL(request.url);
				const baseUrl = `${url.protocol}//${url.host}`;

				const libraryIds = await getAccessibleLibraryIds(auth.userId);

				if (libraryIds.length === 0) {
					const xml =
						opdsHeader(
							"urn:excalibre:opds:recent",
							"Recently Added",
							`${baseUrl}/api/opds/recent`,
							baseUrl,
						) + opdsFooter();
					return opdsXmlResponse(xml);
				}

				const bookRows = await db
					.select()
					.from(books)
					.where(inArray(books.libraryId, libraryIds))
					.orderBy(desc(books.createdAt))
					.limit(RECENT_LIMIT);

				const bookIds = bookRows.map((b) => b.id);
				const [allFiles, allAuthorRows] =
					bookIds.length > 0
						? await Promise.all([
								db
									.select()
									.from(bookFiles)
									.where(inArray(bookFiles.bookId, bookIds)),
								db
									.select({
										bookId: booksAuthors.bookId,
										id: authors.id,
										name: authors.name,
										role: booksAuthors.role,
									})
									.from(booksAuthors)
									.innerJoin(authors, eq(booksAuthors.authorId, authors.id))
									.where(inArray(booksAuthors.bookId, bookIds)),
							])
						: [[], []];

				let xml = opdsHeader(
					"urn:excalibre:opds:recent",
					"Recently Added",
					`${baseUrl}/api/opds/recent`,
					baseUrl,
				);

				for (const book of bookRows) {
					const files = allFiles.filter((f) => f.bookId === book.id);
					const bookAuthors = allAuthorRows.filter((a) => a.bookId === book.id);
					xml += opdsBookEntry(book, files, bookAuthors, baseUrl);
				}

				xml += opdsFooter();
				return opdsXmlResponse(xml);
			},
		},
	},
});
