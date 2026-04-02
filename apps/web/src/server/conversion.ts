// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "src/db";
import { bookFiles, jobs } from "src/db/schema";
import { getSupportedConversions } from "src/server/converter";
import { requireAdmin, requireAuth } from "src/server/middleware";
import { z } from "zod";

export const requestConversionFn = createServerFn({ method: "POST" })
	.validator((raw: unknown) =>
		z
			.object({
				bookFileId: z.number().int(),
				targetFormat: z.string(),
			})
			.parse(raw),
	)
	.handler(async ({ data }) => {
		await requireAuth();

		const bookFile = await db.query.bookFiles.findFirst({
			where: eq(bookFiles.id, data.bookFileId),
		});

		if (!bookFile) {
			throw new Error(`BookFile ${data.bookFileId} not found`);
		}

		const supported = getSupportedConversions(bookFile.format);
		if (!supported.includes(data.targetFormat.toLowerCase())) {
			throw new Error(
				`Cannot convert ${bookFile.format} to ${data.targetFormat}`,
			);
		}

		const [job] = await db
			.insert(jobs)
			.values({
				type: "convert",
				payload: {
					bookFileId: data.bookFileId,
					targetFormat: data.targetFormat.toLowerCase(),
				},
			})
			.returning();

		return job;
	});

export const getSupportedConversionsFn = createServerFn({ method: "GET" })
	.validator((raw: unknown) => z.object({ format: z.string() }).parse(raw))
	.handler(({ data }) => {
		return getSupportedConversions(data.format);
	});

export const getJobsForBookFn = createServerFn({ method: "GET" })
	.validator((raw: unknown) =>
		z.object({ bookId: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		await requireAuth();

		const files = await db
			.select({ id: bookFiles.id })
			.from(bookFiles)
			.where(eq(bookFiles.bookId, data.bookId));

		if (files.length === 0) {
			return [];
		}

		const fileIds = files.map((f) => f.id);

		const results = await db
			.select()
			.from(jobs)
			.where(
				inArray(sql`json_extract(${jobs.payload}, '$.bookFileId')`, fileIds),
			)
			.orderBy(desc(jobs.createdAt))
			.limit(10);

		return results;
	});

export const getRecentJobsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireAdmin();

		return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(50);
	},
);
