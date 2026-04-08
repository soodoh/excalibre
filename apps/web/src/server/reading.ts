// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-argument
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { readingProgress } from "src/db/schema";
import { assertUserCanAccessBook } from "src/server/access-control";
import { requireAuth } from "src/server/middleware";
import { normalizeReadingProgress } from "src/server/reading-utils";
import { z } from "zod";

export const getReadingProgressFn = createServerFn({ method: "GET" })
	.inputValidator((raw: unknown) =>
		z.object({ bookId: z.number().int() }).parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		await assertUserCanAccessBook(
			session.user.id,
			data.bookId,
			session.user.role,
		);

		return db
			.select()
			.from(readingProgress)
			.where(
				and(
					eq(readingProgress.userId, session.user.id),
					eq(readingProgress.bookId, data.bookId),
				),
			);
	});

export const saveReadingProgressFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) =>
		z
			.object({
				bookId: z.number().int(),
				deviceType: z.enum(["web", "koreader", "kobo"]),
				deviceId: z.string().optional(),
				progress: z.number(),
				position: z.string().optional(),
				isFinished: z.boolean().optional(),
			})
			.parse(raw),
	)
	.handler(async ({ data }) => {
		const session = await requireAuth();
		await assertUserCanAccessBook(
			session.user.id,
			data.bookId,
			session.user.role,
		);
		const progress = normalizeReadingProgress(data.progress);
		const isFinished = data.isFinished ?? progress >= 1;

		const existing = await db.query.readingProgress.findFirst({
			where: and(
				eq(readingProgress.userId, session.user.id),
				eq(readingProgress.bookId, data.bookId),
				eq(readingProgress.deviceType, data.deviceType),
			),
		});

		if (existing) {
			const [updated] = await db
				.update(readingProgress)
				.set({
					deviceId: data.deviceId,
					progress,
					position: data.position,
					isFinished,
					updatedAt: new Date(),
				})
				.where(eq(readingProgress.id, existing.id))
				.returning();
			return updated;
		}

		const [inserted] = await db
			.insert(readingProgress)
			.values({
				userId: session.user.id,
				bookId: data.bookId,
				deviceType: data.deviceType,
				deviceId: data.deviceId,
				progress,
				position: data.position,
				isFinished,
			})
			.returning();
		return inserted;
	});
