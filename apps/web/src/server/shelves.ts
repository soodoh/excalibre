// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { eq, like, and, or, asc, gt, lt, inArray, exists } from "drizzle-orm";
import { z } from "zod";
import { db } from "src/db";
import {
  books,
  authors,
  booksAuthors,
  tags,
  booksTags,
  libraries,
  libraryAccess,
  shelves,
  shelvesBooks,
  collections,
  collectionsBooks,
  readingLists,
  readingListBooks,
} from "src/db/schema";
import { requireAuth } from "src/server/middleware";

type FilterCondition = {
  field:
    | "title"
    | "author"
    | "language"
    | "publisher"
    | "tag"
    | "series"
    | "rating"
    | "hasProgress"
    | "isFinished";
  op:
    | "contains"
    | "equals"
    | "startsWith"
    | "greaterThan"
    | "lessThan"
    | "exists";
  value: string | number | boolean;
};

type FilterRules = {
  operator: "and" | "or";
  conditions: FilterCondition[];
};

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

function buildFilterCondition(condition: FilterCondition) {
  const { field, op, value } = condition;

  switch (field) {
    case "title": {
      const strVal = String(value);
      if (op === "contains") {
        return like(books.title, `%${strVal}%`);
      }
      if (op === "equals") {
        return eq(books.title, strVal);
      }
      if (op === "startsWith") {
        return like(books.title, `${strVal}%`);
      }
      return undefined;
    }
    case "language": {
      const strVal = String(value);
      if (op === "equals") {
        return eq(books.language, strVal);
      }
      if (op === "contains") {
        return like(books.language, `%${strVal}%`);
      }
      return undefined;
    }
    case "publisher": {
      const strVal = String(value);
      if (op === "contains") {
        return like(books.publisher, `%${strVal}%`);
      }
      if (op === "equals") {
        return eq(books.publisher, strVal);
      }
      if (op === "startsWith") {
        return like(books.publisher, `${strVal}%`);
      }
      return undefined;
    }
    case "rating": {
      const numVal = Number(value);
      if (op === "greaterThan") {
        return gt(books.rating, numVal);
      }
      if (op === "lessThan") {
        return lt(books.rating, numVal);
      }
      if (op === "equals") {
        return eq(books.rating, numVal);
      }
      return undefined;
    }
    case "tag": {
      const strVal = String(value);
      const subquery = db
        .select({ id: booksTags.bookId })
        .from(booksTags)
        .innerJoin(tags, eq(booksTags.tagId, tags.id))
        .where(
          and(
            eq(booksTags.bookId, books.id),
            op === "contains"
              ? like(tags.name, `%${strVal}%`)
              : eq(tags.name, strVal),
          ),
        );
      return exists(subquery);
    }
    case "author": {
      const strVal = String(value);
      const subquery = db
        .select({ id: booksAuthors.bookId })
        .from(booksAuthors)
        .innerJoin(authors, eq(booksAuthors.authorId, authors.id))
        .where(
          and(
            eq(booksAuthors.bookId, books.id),
            op === "contains"
              ? like(authors.name, `%${strVal}%`)
              : eq(authors.name, strVal),
          ),
        );
      return exists(subquery);
    }
    default:
      return undefined;
  }
}

async function evaluateSmartShelf(
  filterRules: Record<string, unknown>,
  accessibleLibraryIds: number[],
) {
  if (accessibleLibraryIds.length === 0) {
    return [];
  }

  const rules = filterRules as unknown as FilterRules;
  if (!rules?.conditions?.length) {
    return db
      .select()
      .from(books)
      .where(inArray(books.libraryId, accessibleLibraryIds));
  }

  const builtConditions = rules.conditions
    .map(buildFilterCondition)
    .filter((c) => c !== undefined);

  const libraryCondition = inArray(books.libraryId, accessibleLibraryIds);

  let whereClause;
  if (builtConditions.length === 0) {
    whereClause = libraryCondition;
  } else if (rules.operator === "or") {
    whereClause = and(libraryCondition, or(...builtConditions));
  } else {
    whereClause = and(libraryCondition, ...builtConditions);
  }

  return db.select().from(books).where(whereClause);
}

export const getShelvesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await requireAuth();
    return db
      .select()
      .from(shelves)
      .where(eq(shelves.userId, session.user.id))
      .orderBy(asc(shelves.sortOrder));
  },
);

export const getShelfBooksFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ shelfId: z.number().int() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const shelf = await db.query.shelves.findFirst({
      where: and(
        eq(shelves.id, data.shelfId),
        eq(shelves.userId, session.user.id),
      ),
    });

    if (!shelf) {
      throw new Error("Shelf not found");
    }

    const accessibleLibraryIds = await getAccessibleLibraryIds(
      session.user.id,
      session.user.role,
    );

    if (shelf.type === "smart" && shelf.filterRules) {
      return evaluateSmartShelf(shelf.filterRules, accessibleLibraryIds);
    }

    // Manual shelf: join shelvesBooks → books, filtered by accessible libraries
    if (accessibleLibraryIds.length === 0) {
      return [];
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
      })
      .from(shelvesBooks)
      .innerJoin(books, eq(shelvesBooks.bookId, books.id))
      .where(
        and(
          eq(shelvesBooks.shelfId, data.shelfId),
          inArray(books.libraryId, accessibleLibraryIds),
        ),
      );
  });

export const createShelfFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        name: z.string().min(1, "Name is required"),
        type: z.enum(["smart", "manual"]),
        filterRules: z.record(z.unknown()).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const [shelf] = await db
      .insert(shelves)
      .values({
        name: data.name,
        type: data.type,
        filterRules: data.filterRules,
        userId: session.user.id,
      })
      .returning();
    return shelf;
  });

export const updateShelfFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: z.number().int(),
        name: z.string().min(1).optional(),
        filterRules: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    const { id, ...updates } = data;
    const [shelf] = await db
      .update(shelves)
      .set(updates)
      .where(and(eq(shelves.id, id), eq(shelves.userId, session.user.id)))
      .returning();
    if (!shelf) {
      throw new Error("Shelf not found");
    }
    return shelf;
  });

export const deleteShelfFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
  .handler(async ({ data }) => {
    const session = await requireAuth();
    await db
      .delete(shelves)
      .where(and(eq(shelves.id, data.id), eq(shelves.userId, session.user.id)));
    return { success: true };
  });

export const addBookToShelfFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ shelfId: z.number().int(), bookId: z.number().int() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    // Verify shelf ownership and manual type
    const shelf = await db.query.shelves.findFirst({
      where: and(
        eq(shelves.id, data.shelfId),
        eq(shelves.userId, session.user.id),
      ),
    });
    if (!shelf) {
      throw new Error("Shelf not found");
    }
    if (shelf.type !== "manual") {
      throw new Error("Cannot manually add books to a smart shelf");
    }

    await db
      .insert(shelvesBooks)
      .values({ shelfId: data.shelfId, bookId: data.bookId })
      .onConflictDoNothing();
    return { success: true };
  });

export const removeBookFromShelfFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ shelfId: z.number().int(), bookId: z.number().int() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    // Verify shelf ownership
    const shelf = await db.query.shelves.findFirst({
      where: and(
        eq(shelves.id, data.shelfId),
        eq(shelves.userId, session.user.id),
      ),
    });
    if (!shelf) {
      throw new Error("Shelf not found");
    }

    await db
      .delete(shelvesBooks)
      .where(
        and(
          eq(shelvesBooks.shelfId, data.shelfId),
          eq(shelvesBooks.bookId, data.bookId),
        ),
      );
    return { success: true };
  });

/**
 * Returns which shelves (manual only), collections, and reading lists
 * already contain the given book for the current user.
 */
export const getBookMembershipFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ bookId: z.number().int() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const [shelfRows, collectionRows, listRows] = await Promise.all([
      db
        .select({ shelfId: shelvesBooks.shelfId })
        .from(shelvesBooks)
        .innerJoin(
          shelves,
          and(
            eq(shelvesBooks.shelfId, shelves.id),
            eq(shelves.userId, session.user.id),
            eq(shelves.type, "manual"),
          ),
        )
        .where(eq(shelvesBooks.bookId, data.bookId)),

      db
        .select({ collectionId: collectionsBooks.collectionId })
        .from(collectionsBooks)
        .innerJoin(
          collections,
          and(
            eq(collectionsBooks.collectionId, collections.id),
            eq(collections.userId, session.user.id),
          ),
        )
        .where(eq(collectionsBooks.bookId, data.bookId)),

      db
        .select({ readingListId: readingListBooks.readingListId })
        .from(readingListBooks)
        .innerJoin(
          readingLists,
          and(
            eq(readingListBooks.readingListId, readingLists.id),
            eq(readingLists.userId, session.user.id),
          ),
        )
        .where(eq(readingListBooks.bookId, data.bookId)),
    ]);

    return {
      shelfIds: shelfRows.map((r) => r.shelfId),
      collectionIds: collectionRows.map((r) => r.collectionId),
      readingListIds: listRows.map((r) => r.readingListId),
    };
  });
