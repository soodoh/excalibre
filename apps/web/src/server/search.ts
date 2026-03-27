// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { eq, like, and, desc, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "src/db";
import {
  books,
  authors,
  booksAuthors,
  series,
  libraries,
  libraryAccess,
  readingProgress,
} from "src/db/schema";
import { requireAuth } from "src/server/middleware";

async function getAccessibleLibraryIds(
  userId: string,
  role: string,
): Promise<number[]> {
  if (role === "admin") {
    const allLibraries = await db.select({ id: libraries.id }).from(libraries);
    return allLibraries.map((l) => l.id);
  }
  const access = await db
    .select({ libraryId: libraryAccess.libraryId })
    .from(libraryAccess)
    .where(eq(libraryAccess.userId, userId));
  return access.map((a) => a.libraryId);
}

export const searchFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        query: z.string().min(1),
        limit: z.number().int().default(20),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const accessibleLibraryIds = await getAccessibleLibraryIds(
      session.user.id,
      session.user.role,
    );

    if (accessibleLibraryIds.length === 0) {
      return { books: [], authors: [], series: [] };
    }

    const pattern = `%${data.query}%`;

    const [bookResults, seriesResults] = await Promise.all([
      db
        .select()
        .from(books)
        .where(
          and(
            like(books.title, pattern),
            inArray(books.libraryId, accessibleLibraryIds),
          ),
        )
        .limit(data.limit),
      db
        .select()
        .from(series)
        .where(
          and(
            like(series.name, pattern),
            inArray(series.libraryId, accessibleLibraryIds),
          ),
        )
        .limit(data.limit),
    ]);

    // Search authors by name — authors aren't scoped to libraries directly,
    // but we join through books to only return authors in accessible libraries
    const authorBookIds = await db
      .select({ authorId: booksAuthors.authorId })
      .from(booksAuthors)
      .innerJoin(books, eq(booksAuthors.bookId, books.id))
      .where(inArray(books.libraryId, accessibleLibraryIds))
      .groupBy(booksAuthors.authorId);

    const accessibleAuthorIds = authorBookIds.map((r) => r.authorId);

    let authorResults: Array<typeof authors.$inferSelect> = [];
    if (accessibleAuthorIds.length > 0) {
      authorResults = await db
        .select()
        .from(authors)
        .where(
          and(
            like(authors.name, pattern),
            inArray(authors.id, accessibleAuthorIds),
          ),
        )
        .limit(data.limit);
    }

    return {
      books: bookResults,
      authors: authorResults,
      series: seriesResults,
    };
  });

export const getContinueReadingFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ limit: z.number().int().default(12) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const accessibleLibraryIds = await getAccessibleLibraryIds(
      session.user.id,
      session.user.role,
    );

    if (accessibleLibraryIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        id: books.id,
        title: books.title,
        sortTitle: books.sortTitle,
        slug: books.slug,
        libraryId: books.libraryId,
        description: books.description,
        language: books.language,
        publisher: books.publisher,
        publishDate: books.publishDate,
        isbn10: books.isbn10,
        isbn13: books.isbn13,
        pageCount: books.pageCount,
        coverPath: books.coverPath,
        hardcoverId: books.hardcoverId,
        googleBooksId: books.googleBooksId,
        seriesId: books.seriesId,
        seriesIndex: books.seriesIndex,
        rating: books.rating,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        progress: readingProgress.progress,
        progressUpdatedAt: readingProgress.updatedAt,
      })
      .from(readingProgress)
      .innerJoin(books, eq(readingProgress.bookId, books.id))
      .where(
        and(
          eq(readingProgress.userId, session.user.id),
          eq(readingProgress.isFinished, false),
          gt(readingProgress.progress, 0),
          inArray(books.libraryId, accessibleLibraryIds),
        ),
      )
      .orderBy(desc(readingProgress.updatedAt))
      .limit(data.limit);

    return rows;
  });
