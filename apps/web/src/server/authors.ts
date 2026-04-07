// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "src/db";
import { authors, books, booksAuthors, series } from "src/db/schema";
import {
	assertUserCanAccessAuthor,
	assertUserCanAccessSeries,
	getAccessibleLibraryIds,
} from "src/server/access-control";
import { requireAuth } from "src/server/middleware";
import { z } from "zod";

export const getAuthorDetailFn = createServerFn({ method: "GET" })
	.inputValidator((raw: unknown) =>
		z.object({ id: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		await assertUserCanAccessAuthor(
			session.user.id,
			data.id,
			session.user.role,
		);
		const accessibleLibraryIds = await getAccessibleLibraryIds(
			session.user.id,
			session.user.role,
		);

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
			.where(
				and(
					eq(booksAuthors.authorId, data.id),
					inArray(books.libraryId, accessibleLibraryIds),
				),
			);

		return {
			...author,
			books: bookRows,
		};
	});

export const getSeriesDetailFn = createServerFn({ method: "GET" })
	.inputValidator((raw: unknown) =>
		z.object({ id: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		await assertUserCanAccessSeries(
			session.user.id,
			data.id,
			session.user.role,
		);
		const accessibleLibraryIds = await getAccessibleLibraryIds(
			session.user.id,
			session.user.role,
		);

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
			.where(
				and(
					eq(books.seriesId, data.id),
					inArray(books.libraryId, accessibleLibraryIds),
				),
			)
			.orderBy(books.seriesIndex);

		return {
			...seriesRow,
			books: bookRows,
		};
	});
