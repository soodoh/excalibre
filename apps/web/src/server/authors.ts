// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "src/db";
import { authors, books, booksAuthors, series } from "src/db/schema";
import { requireAuth } from "src/server/middleware";
import { z } from "zod";

export const getAuthorDetailFn = createServerFn({ method: "GET" })
	.validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
	.handler(async ({ data }) => {
		await requireAuth();

		const author = await db.query.authors.findFirst({
			where: eq(authors.id, data.id),
		});

		if (!author) {
			throw new Error("Author not found");
		}

		const bookRows = await db
			.select({
				id: books.id,
				title: books.title,
				coverPath: books.coverPath,
				seriesIndex: books.seriesIndex,
				createdAt: books.createdAt,
			})
			.from(booksAuthors)
			.innerJoin(books, eq(booksAuthors.bookId, books.id))
			.where(eq(booksAuthors.authorId, data.id));

		return {
			...author,
			books: bookRows,
		};
	});

export const getSeriesDetailFn = createServerFn({ method: "GET" })
	.validator((raw: unknown) => z.object({ id: z.number().int() }).parse(raw))
	.handler(async ({ data }) => {
		await requireAuth();

		const seriesRow = await db.query.series.findFirst({
			where: eq(series.id, data.id),
		});

		if (!seriesRow) {
			throw new Error("Series not found");
		}

		const bookRows = await db
			.select({
				id: books.id,
				title: books.title,
				coverPath: books.coverPath,
				seriesIndex: books.seriesIndex,
				createdAt: books.createdAt,
			})
			.from(books)
			.where(eq(books.seriesId, data.id))
			.orderBy(books.seriesIndex);

		return {
			...seriesRow,
			books: bookRows,
		};
	});
