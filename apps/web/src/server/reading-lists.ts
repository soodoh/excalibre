// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { eq, and, count, max, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "src/db";
import { books, readingLists, readingListBooks } from "src/db/schema";
import { requireAuth } from "src/server/middleware";

export const getReadingListsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await requireAuth();

    const rows = await db
      .select({
        id: readingLists.id,
        name: readingLists.name,
        userId: readingLists.userId,
        createdAt: readingLists.createdAt,
        bookCount: count(readingListBooks.bookId),
      })
      .from(readingLists)
      .leftJoin(
        readingListBooks,
        eq(readingLists.id, readingListBooks.readingListId),
      )
      .where(eq(readingLists.userId, session.user.id))
      .groupBy(readingLists.id);

    return rows;
  },
);

export const getReadingListBooksFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ readingListId: z.number().int() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const list = await db.query.readingLists.findFirst({
      where: and(
        eq(readingLists.id, data.readingListId),
        eq(readingLists.userId, session.user.id),
      ),
    });
    if (!list) {
      throw new Error("Reading list not found");
    }

    return db
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
        sortOrder: readingListBooks.sortOrder,
      })
      .from(readingListBooks)
      .innerJoin(books, eq(readingListBooks.bookId, books.id))
      .where(eq(readingListBooks.readingListId, data.readingListId))
      .orderBy(asc(readingListBooks.sortOrder));
  });

export const createReadingListFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ name: z.string().min(1, "Name is required") }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const [list] = await db
      .insert(readingLists)
      .values({ name: data.name, userId: session.user.id })
      .returning();
    return list;
  });

export const updateReadingListFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: z.number().int(),
        name: z.string().min(1).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const { id, ...updates } = data;
    const [list] = await db
      .update(readingLists)
      .set(updates)
      .where(
        and(eq(readingLists.id, id), eq(readingLists.userId, session.user.id)),
      )
      .returning();
    if (!list) {
      throw new Error("Reading list not found");
    }
    return list;
  });

export const deleteReadingListFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
  .handler(async ({ data }) => {
    const session = await requireAuth();
    await db
      .delete(readingLists)
      .where(
        and(
          eq(readingLists.id, data.id),
          eq(readingLists.userId, session.user.id),
        ),
      );
    return { success: true };
  });

export const addBookToReadingListFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ readingListId: z.number().int(), bookId: z.number().int() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const list = await db.query.readingLists.findFirst({
      where: and(
        eq(readingLists.id, data.readingListId),
        eq(readingLists.userId, session.user.id),
      ),
    });
    if (!list) {
      throw new Error("Reading list not found");
    }

    const maxRow = await db
      .select({ maxSort: max(readingListBooks.sortOrder) })
      .from(readingListBooks)
      .where(eq(readingListBooks.readingListId, data.readingListId));

    const nextSort = (maxRow[0]?.maxSort ?? -1) + 1;

    await db
      .insert(readingListBooks)
      .values({
        readingListId: data.readingListId,
        bookId: data.bookId,
        sortOrder: nextSort,
      })
      .onConflictDoNothing();
    return { success: true };
  });

export const removeBookFromReadingListFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ readingListId: z.number().int(), bookId: z.number().int() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const list = await db.query.readingLists.findFirst({
      where: and(
        eq(readingLists.id, data.readingListId),
        eq(readingLists.userId, session.user.id),
      ),
    });
    if (!list) {
      throw new Error("Reading list not found");
    }

    await db
      .delete(readingListBooks)
      .where(
        and(
          eq(readingListBooks.readingListId, data.readingListId),
          eq(readingListBooks.bookId, data.bookId),
        ),
      );
    return { success: true };
  });

export const reorderReadingListFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        readingListId: z.number().int(),
        bookIds: z.array(z.number().int()),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const list = await db.query.readingLists.findFirst({
      where: and(
        eq(readingLists.id, data.readingListId),
        eq(readingLists.userId, session.user.id),
      ),
    });
    if (!list) {
      throw new Error("Reading list not found");
    }

    await Promise.all(
      data.bookIds.map((bookId, index) =>
        db
          .update(readingListBooks)
          .set({ sortOrder: index })
          .where(
            and(
              eq(readingListBooks.readingListId, data.readingListId),
              eq(readingListBooks.bookId, bookId),
            ),
          ),
      ),
    );
    return { success: true };
  });
