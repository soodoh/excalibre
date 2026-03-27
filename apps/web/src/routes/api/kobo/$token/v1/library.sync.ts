import { createFileRoute } from "@tanstack/react-router";
import { db } from "src/db";
import {
  books,
  bookFiles,
  booksAuthors,
  authors,
  readingProgress,
} from "src/db/schema";
import { gt, inArray } from "drizzle-orm";
import {
  authenticateKobo,
  buildSyncToken,
  parseSyncToken,
  buildNewEntitlement,
} from "src/server/kobo";

const PAGE_SIZE = 100;

export const Route = createFileRoute("/api/kobo/$token/v1/library/sync")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { token: string };
      }) => {
        const auth = await authenticateKobo(params.token);
        if (!auth) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        const { userId } = auth;

        const rawSyncToken = request.headers.get("x-kobo-synctoken");
        const syncState = parseSyncToken(rawSyncToken);
        const booksAfter = new Date(syncState.booksLastModified);

        // Query all books modified after the sync token timestamp
        const allBooks = await db.query.books.findMany({
          where: gt(books.updatedAt, booksAfter),
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

        const hasMore = allBooks.length > PAGE_SIZE;
        const booksPage = hasMore ? allBooks.slice(0, PAGE_SIZE) : allBooks;

        const changes: unknown[] = [];
        const now = new Date();

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
          const authorIds = [
            ...new Set(allBooksAuthors.map((ba) => ba.authorId)),
          ];

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
          const userProgress = allProgress.filter((p) => p.userId === userId);

          // Build a full Book shape for each book page entry
          const fullBooks = await db.query.books.findMany({
            where: inArray(books.id, bookIds),
          });

          for (const book of fullBooks) {
            const bookFilesList = allFiles.filter((f) => f.bookId === book.id);
            const bookAuthorIds = new Set(
              allBooksAuthors
                .filter((ba) => ba.bookId === book.id)
                .map((ba) => ba.authorId),
            );
            const bookAuthorsList = allAuthors.filter((a) =>
              bookAuthorIds.has(a.id),
            );
            const progress = userProgress.find((p) => p.bookId === book.id);

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

        // Build updated sync token
        const newSyncToken = buildSyncToken({
          booksLastModified: now.toISOString(),
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
      },
    },
  },
});
