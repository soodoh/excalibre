// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { eq, like, and, desc, inArray, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "src/db";
import {
  books,
  bookFiles,
  authors,
  booksAuthors,
  series,
  libraries,
  libraryAccess,
} from "src/db/schema";
import { requireAuth, requireLibraryAccess } from "src/server/middleware";

export const getBooksByLibraryFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        libraryId: z.number().int(),
        search: z.string().optional(),
        limit: z.number().int().default(50),
        offset: z.number().int().default(0),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    await requireLibraryAccess(data.libraryId);

    const conditions = [eq(books.libraryId, data.libraryId)];
    if (data.search) {
      conditions.push(like(books.title, `%${data.search}%`));
    }

    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(books)
        .where(where)
        .orderBy(desc(books.createdAt))
        .limit(data.limit)
        .offset(data.offset),
      db.select({ value: count() }).from(books).where(where),
    ]);

    return {
      books: rows,
      total: totalRows[0]?.value ?? 0,
    };
  });

export const getBookDetailFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
  .handler(async ({ data }) => {
    await requireAuth();

    const book = await db.query.books.findFirst({
      where: eq(books.id, data.id),
    });

    if (!book) {
      throw new Error("Book not found");
    }

    const files = await db
      .select()
      .from(bookFiles)
      .where(eq(bookFiles.bookId, data.id));

    const authorRows = await db
      .select({
        id: authors.id,
        name: authors.name,
        role: booksAuthors.role,
      })
      .from(booksAuthors)
      .innerJoin(authors, eq(booksAuthors.authorId, authors.id))
      .where(eq(booksAuthors.bookId, data.id));

    let seriesInfo: { id: number; name: string } | null = null;
    if (book.seriesId) {
      const seriesRow = await db.query.series.findFirst({
        where: eq(series.id, book.seriesId),
      });
      if (seriesRow) {
        seriesInfo = { id: seriesRow.id, name: seriesRow.name };
      }
    }

    return {
      ...book,
      files,
      authors: authorRows,
      series: seriesInfo,
    };
  });

export const getRecentBooksFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ limit: z.number().int().default(12) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    let accessibleLibraryIds: number[];

    if (session.user.role === "admin") {
      const allLibraries = await db
        .select({ id: libraries.id })
        .from(libraries);
      accessibleLibraryIds = allLibraries.map((l) => l.id);
    } else {
      const access = await db
        .select({ libraryId: libraryAccess.libraryId })
        .from(libraryAccess)
        .where(eq(libraryAccess.userId, session.user.id));
      accessibleLibraryIds = access.map((a) => a.libraryId);
    }

    if (accessibleLibraryIds.length === 0) {
      return [];
    }

    return db
      .select()
      .from(books)
      .where(inArray(books.libraryId, accessibleLibraryIds))
      .orderBy(desc(books.createdAt))
      .limit(data.limit);
  });
