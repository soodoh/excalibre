import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "src/db";
import { jobs } from "src/db/schema";
import { convertBook } from "src/server/converter";
import { fixEpub } from "src/server/epub-fixer";

const POLL_INTERVAL_MS = 5000; // 5 seconds when idle
const BUSY_INTERVAL_MS = 100; // 100ms when there was work

let workerStarted = false;

function selectNextPendingJob() {
	return db
		.select()
		.from(jobs)
		.where(and(eq(jobs.status, "pending"), lt(jobs.attempts, jobs.maxAttempts)))
		.orderBy(asc(jobs.priority), asc(jobs.createdAt))
		.limit(1)
		.get();
}

type PendingJob = NonNullable<ReturnType<typeof selectNextPendingJob>>;

type ClaimResult =
	| {
			status: "claimed";
			job: PendingJob & {
				status: "running";
				startedAt: Date;
				attempts: number;
			};
	  }
	| { status: "contended" | "empty" };

function claimNextJobResult(): ClaimResult {
	// Find the oldest pending job that hasn't exceeded maxAttempts.
	const job = selectNextPendingJob();

	if (!job) {
		return { status: "empty" };
	}

	const claimedJob = {
		...job,
		status: "running" as const,
		attempts: job.attempts + 1,
		startedAt: new Date(),
	};

	const result = db
		.update(jobs)
		.set({
			status: claimedJob.status,
			attempts: claimedJob.attempts,
			startedAt: claimedJob.startedAt,
		})
		.where(and(eq(jobs.id, job.id), eq(jobs.status, "pending")))
		.run() as unknown;

	const changes =
		typeof result === "object" &&
		result !== null &&
		"changes" in result &&
		typeof result.changes === "number"
			? result.changes
			: 0;

	if (changes === 0) {
		return { status: "contended" };
	}

	return {
		status: "claimed",
		job: claimedJob,
	};
}

export function claimNextJob() {
	const result = claimNextJobResult();
	return result.status === "claimed" ? result.job : null;
}

export async function processNextJob(): Promise<boolean> {
	const result = claimNextJobResult();
	switch (result.status) {
		case "empty":
			return false;
		case "contended":
			return selectNextPendingJob() !== null;
	}
	const job = result.job;

	const isFinalAttempt = job.attempts >= job.maxAttempts;

	try {
		// biome-ignore lint/complexity/noBannedTypes: Matches the current jobs table JSON typing.
		let result: Record<string, {}> = {};

		if (job.type === "convert") {
			const payload = job.payload as {
				bookFileId: number;
				targetFormat: string;
			};
			const newBookFile = await convertBook(
				payload.bookFileId,
				payload.targetFormat,
			);
			result = { bookFileId: newBookFile.id };
		} else if (job.type === "epub_fix") {
			const payload = job.payload as { bookFileId: number };
			const newBookFile = await fixEpub(payload.bookFileId);
			result = newBookFile ? { bookFileId: newBookFile.id } : { skipped: true };
		} else {
			throw new Error(`Unknown job type: ${String(job.type)}`);
		}

		db.update(jobs)
			.set({
				status: "completed",
				result,
				completedAt: new Date(),
			})
			.where(eq(jobs.id, job.id))
			.run();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		db.update(jobs)
			.set({
				status: isFinalAttempt ? "failed" : "pending",
				error: errorMessage,
				startedAt: null,
			})
			.where(eq(jobs.id, job.id))
			.run();
	}

	return true;
}

async function runWorkerLoop(): Promise<void> {
	const hadWork = await processNextJob();
	const delay = hadWork ? BUSY_INTERVAL_MS : POLL_INTERVAL_MS;
	setTimeout(() => void runWorkerLoop(), delay);
}

export function ensureJobWorkerStarted(): void {
	if (workerStarted) {
		return;
	}
	workerStarted = true;
	void runWorkerLoop();
}
