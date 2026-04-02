import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "src/db";
import { books, readingProgress } from "src/db/schema";
import { authenticateKobo, buildReadingState } from "src/server/kobo";

type ReadingStateBody = {
	ReadingStates?: Array<{
		EntitlementId?: string;
		CurrentBookmark?: {
			ProgressPercent?: number;
			ContentSourceProgressPercent?: number;
		};
		StatusInfo?: {
			Status?: string;
		};
	}>;
};

export const Route = createFileRoute(
	"/api/kobo/$token/v1/library/$bookId/state",
)({
	server: {
		handlers: {
			GET: async ({
				params,
			}: {
				params: { token: string; bookId: string };
			}) => {
				const auth = await authenticateKobo(params.token);
				if (!auth) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				const bookId = Number(params.bookId);
				if (Number.isNaN(bookId)) {
					return Response.json({ error: "Invalid book ID" }, { status: 400 });
				}

				const book = await db.query.books.findFirst({
					where: eq(books.id, bookId),
					columns: { id: true },
				});

				if (!book) {
					return Response.json({ error: "Not found" }, { status: 404 });
				}

				const progress = await db.query.readingProgress.findFirst({
					where: and(
						eq(readingProgress.userId, auth.userId),
						eq(readingProgress.bookId, bookId),
						eq(readingProgress.deviceType, "kobo"),
					),
				});

				const state = buildReadingState(progress, bookId);
				return Response.json([state]);
			},

			PUT: async ({
				request,
				params,
			}: {
				request: Request;
				params: { token: string; bookId: string };
			}) => {
				const auth = await authenticateKobo(params.token);
				if (!auth) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				const bookId = Number(params.bookId);
				if (Number.isNaN(bookId)) {
					return Response.json({ error: "Invalid book ID" }, { status: 400 });
				}

				const book = await db.query.books.findFirst({
					where: eq(books.id, bookId),
					columns: { id: true },
				});

				if (!book) {
					return Response.json({ error: "Not found" }, { status: 404 });
				}

				let body: ReadingStateBody;
				try {
					body = (await request.json()) as ReadingStateBody;
				} catch {
					return Response.json(
						{ error: "Invalid request body" },
						{ status: 400 },
					);
				}

				const readingState = body.ReadingStates?.[0];
				const koboStatus = readingState?.StatusInfo?.Status ?? "ReadyToRead";
				const progressPercent =
					readingState?.CurrentBookmark?.ProgressPercent ?? 0;

				let progressValue = 0;
				let isFinished = false;

				if (koboStatus === "Finished") {
					progressValue = 1;
					isFinished = true;
				} else if (koboStatus === "Reading") {
					progressValue = progressPercent / 100;
				}
				// "ReadyToRead" => progress stays 0

				const now = new Date();
				const existing = await db.query.readingProgress.findFirst({
					where: and(
						eq(readingProgress.userId, auth.userId),
						eq(readingProgress.bookId, bookId),
						eq(readingProgress.deviceType, "kobo"),
					),
				});

				await (existing
					? db
							.update(readingProgress)
							.set({ progress: progressValue, isFinished, updatedAt: now })
							.where(eq(readingProgress.id, existing.id))
					: db.insert(readingProgress).values({
							userId: auth.userId,
							bookId,
							deviceType: "kobo",
							progress: progressValue,
							isFinished,
							updatedAt: now,
						}));

				const entitlementId = readingState?.EntitlementId ?? String(bookId);

				return Response.json({
					RequestResult: "Success",
					UpdateResults: [
						{
							EntitlementId: entitlementId,
							CurrentBookmarkResult: { Result: "Success" },
							StatusInfoResult: { Result: "Success" },
							StatisticsResult: { Result: "Success" },
						},
					],
				});
			},
		},
	},
});
