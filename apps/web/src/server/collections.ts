// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { and, count, eq } from "drizzle-orm";
import { db } from "src/db";
import { books, collections, collectionsBooks } from "src/db/schema";
import { requireAuth } from "src/server/middleware";
import { z } from "zod";

export const getCollectionsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await requireAuth();

		const rows = await db
			.select({
				id: collections.id,
				name: collections.name,
				userId: collections.userId,
				coverImage: collections.coverImage,
				createdAt: collections.createdAt,
				bookCount: count(collectionsBooks.bookId),
			})
			.from(collections)
			.leftJoin(
				collectionsBooks,
				eq(collections.id, collectionsBooks.collectionId),
			)
			.where(eq(collections.userId, session.user.id))
			.groupBy(collections.id);

		return rows;
	},
);

export const getCollectionBooksFn = createServerFn({ method: "GET" })
	.validator((raw: unknown) =>
		z.object({ collectionId: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();

		const collection = await db.query.collections.findFirst({
			where: and(
				eq(collections.id, data.collectionId),
				eq(collections.userId, session.user.id),
			),
		});
		if (!collection) {
			throw new Error("Collection not found");
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
			.from(collectionsBooks)
			.innerJoin(books, eq(collectionsBooks.bookId, books.id))
			.where(eq(collectionsBooks.collectionId, data.collectionId));
	});

export const createCollectionFn = createServerFn({ method: "POST" })
	.validator((raw: unknown) =>
		z.object({ name: z.string().min(1, "Name is required") }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		const [collection] = await db
			.insert(collections)
			.values({ name: data.name, userId: session.user.id })
			.returning();
		return collection;
	});

export const updateCollectionFn = createServerFn({ method: "POST" })
	.validator((raw: unknown) =>
		z
			.object({
				id: z.number().int(),
				name: z.string().min(1).optional(),
				coverImage: z.string().optional(),
			})
			.parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		const { id, ...updates } = data;
		const [collection] = await db
			.update(collections)
			.set(updates)
			.where(
				and(eq(collections.id, id), eq(collections.userId, session.user.id)),
			)
			.returning();
		if (!collection) {
			throw new Error("Collection not found");
		}
		return collection;
	});

export const deleteCollectionFn = createServerFn({ method: "POST" })
	.validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
	.handler(async ({ data }) => {
		const session = await requireAuth();
		await db
			.delete(collections)
			.where(
				and(
					eq(collections.id, data.id),
					eq(collections.userId, session.user.id),
				),
			);
		return { success: true };
	});

export const addBookToCollectionFn = createServerFn({ method: "POST" })
	.validator((raw: unknown) =>
		z
			.object({ collectionId: z.number().int(), bookId: z.number().int() })
			.parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		const collection = await db.query.collections.findFirst({
			where: and(
				eq(collections.id, data.collectionId),
				eq(collections.userId, session.user.id),
			),
		});
		if (!collection) {
			throw new Error("Collection not found");
		}

		await db
			.insert(collectionsBooks)
			.values({ collectionId: data.collectionId, bookId: data.bookId })
			.onConflictDoNothing();
		return { success: true };
	});

export const removeBookFromCollectionFn = createServerFn({ method: "POST" })
	.validator((raw: unknown) =>
		z
			.object({ collectionId: z.number().int(), bookId: z.number().int() })
			.parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		const collection = await db.query.collections.findFirst({
			where: and(
				eq(collections.id, data.collectionId),
				eq(collections.userId, session.user.id),
			),
		});
		if (!collection) {
			throw new Error("Collection not found");
		}

		await db
			.delete(collectionsBooks)
			.where(
				and(
					eq(collectionsBooks.collectionId, data.collectionId),
					eq(collectionsBooks.bookId, data.bookId),
				),
			);
		return { success: true };
	});
