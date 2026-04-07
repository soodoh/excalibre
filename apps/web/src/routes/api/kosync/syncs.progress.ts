import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { readingProgress } from "src/db/schema";
import { assertUserCanAccessBook } from "src/server/access-control";
import { ForbiddenError } from "src/server/http-errors";
import { authenticateKosync, findBookByMd5 } from "src/server/kosync";
import { normalizeReadingProgress } from "src/server/reading-utils";

type ProgressPutBody = {
	document?: string;
	progress?: string;
	percentage?: number;
	device?: string;
	device_id?: string;
};

async function upsertReadingProgress(
	userId: string,
	bookId: number,
	percentage: number | undefined,
	position: string | undefined,
	deviceId: string | undefined,
): Promise<void> {
	const now = new Date();
	const existing = await db.query.readingProgress.findFirst({
		where: and(
			eq(readingProgress.userId, userId),
			eq(readingProgress.bookId, bookId),
			eq(readingProgress.deviceType, "koreader"),
		),
	});

	await (existing
		? db
				.update(readingProgress)
				.set({
					progress: percentage ?? existing.progress,
					position: position ?? existing.position,
					deviceId: deviceId ?? existing.deviceId,
					updatedAt: now,
				})
				.where(eq(readingProgress.id, existing.id))
		: db.insert(readingProgress).values({
				userId,
				bookId,
				deviceType: "koreader",
				deviceId,
				progress: percentage ?? 0,
				position,
				updatedAt: now,
			}));
}

export const Route = createFileRoute("/api/kosync/syncs/progress")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const user = await authenticateKosync(request);
				if (!user) {
					return Response.json({ message: "Unauthorized" }, { status: 401 });
				}

				const url = new URL(request.url);
				const document = url.searchParams.get("document");
				if (!document) {
					return Response.json({});
				}

				const bookFile = await findBookByMd5(document);
				if (!bookFile) {
					return Response.json({});
				}

				try {
					await assertUserCanAccessBook(user.id, bookFile.bookId, user.role);
				} catch (error) {
					if (error instanceof ForbiddenError) {
						return Response.json(
							{ message: "Document not accessible" },
							{ status: 403 },
						);
					}
					throw error;
				}

				const progress = await db.query.readingProgress.findFirst({
					where: and(
						eq(readingProgress.userId, user.id),
						eq(readingProgress.bookId, bookFile.bookId),
						eq(readingProgress.deviceType, "koreader"),
					),
				});

				if (!progress) {
					return Response.json({});
				}

				return Response.json({
					document,
					percentage: progress.progress,
					progress: progress.position,
					device: "koreader",
					device_id: progress.deviceId,
					timestamp: Math.floor(progress.updatedAt.getTime() / 1000),
				});
			},

			PUT: async ({ request }: { request: Request }) => {
				const user = await authenticateKosync(request);
				if (!user) {
					return Response.json({ message: "Unauthorized" }, { status: 401 });
				}

				let body: ProgressPutBody;
				try {
					body = (await request.json()) as ProgressPutBody;
				} catch {
					return Response.json(
						{ message: "Invalid request body" },
						{ status: 400 },
					);
				}

				const { document, progress, percentage, device_id } = body;
				if (!document) {
					return Response.json(
						{ message: "document required" },
						{ status: 400 },
					);
				}

				const bookFile = await findBookByMd5(document);
				if (!bookFile) {
					return Response.json(
						{ message: "Document not found" },
						{ status: 403 },
					);
				}

				try {
					await assertUserCanAccessBook(user.id, bookFile.bookId, user.role);
				} catch (error) {
					if (error instanceof ForbiddenError) {
						return Response.json(
							{ message: "Document not accessible" },
							{ status: 403 },
						);
					}
					throw error;
				}

				await upsertReadingProgress(
					user.id,
					bookFile.bookId,
					percentage === undefined
						? undefined
						: normalizeReadingProgress(percentage),
					progress,
					device_id,
				);

				return Response.json({
					document,
					timestamp: Math.floor(Date.now() / 1000),
				});
			},
		},
	},
});
